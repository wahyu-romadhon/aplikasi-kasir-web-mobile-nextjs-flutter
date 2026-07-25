import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/local_db.dart';
import '../../core/database/sync_service.dart';
import 'models.dart';

final syncServiceProvider = Provider<SyncService>((ref) => SyncService());

class StoreInfo {
  final String name;
  final String footer;
  const StoreInfo({required this.name, required this.footer});
}

class QrisMethod {
  final String label;
  final String imageUrl;
  const QrisMethod({required this.label, required this.imageUrl});
}

/// Metode QRIS/e-wallet aktif milik toko (untuk ditampilkan ke pembeli).
final paymentMethodsProvider = FutureProvider<List<QrisMethod>>((ref) async {
  final sb = Supabase.instance.client;
  try {
    final rows = await sb
        .from('store_payment_methods')
        .select('label, image_url')
        .eq('is_active', true)
        .order('sort_order');
    return (rows as List)
        .map((r) => QrisMethod(
              label: r['label'] as String,
              imageUrl: r['image_url'] as String,
            ))
        .toList();
  } catch (_) {
    return const []; // tabel belum ada / offline → hanya tunai
  }
});

/// Info toko (nama + footer struk) untuk mencetak struk.
final storeInfoProvider = FutureProvider<StoreInfo>((ref) async {
  const fallback = StoreInfo(name: 'KasirKu', footer: 'Terima kasih!');
  final sb = Supabase.instance.client;
  final uid = sb.auth.currentUser?.id;
  if (uid == null) return fallback;
  final prof =
      await sb.from('profiles').select('store_id').eq('id', uid).maybeSingle();
  final storeId = prof?['store_id'];
  if (storeId == null) return fallback;
  final s = await sb
      .from('stores')
      .select('name, receipt_footer')
      .eq('id', storeId)
      .maybeSingle();
  return StoreInfo(
    name: (s?['name'] as String?) ?? 'KasirKu',
    footer: (s?['receipt_footer'] as String?) ?? 'Terima kasih!',
  );
});

/// Produk aktif dari SQLite (cache lokal). Tidak melakukan pull di sini supaya
/// refresh setelah transaksi menampilkan stok lokal yang sudah dikurangi
/// (pull dipisah ke [refreshProducts], hanya saat buka app & tarik-refresh).
final productsProvider = FutureProvider<List<Product>>((ref) async {
  final db = await LocalDb.instance;
  final rows = await db.query(
    'products',
    where: 'is_active = 1',
    orderBy: 'name COLLATE NOCASE',
  );
  return rows.map((r) => Product.fromMap(r)).toList();
});

/// Push transaksi tertunda → tarik produk terbaru dari server → refresh grid.
/// Urutan penting: sync dulu (agar stok server terpotong), baru pull.
Future<void> refreshProducts(WidgetRef ref) async {
  final sync = ref.read(syncServiceProvider);
  try {
    await sync.syncPendingTransactions();
    await sync.pullProducts();
  } catch (_) {
    // offline / gagal → pakai cache SQLite yang ada
  }
  ref.invalidate(productsProvider);
}

class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super(const []);

  /// Tambah 1 item. Return false bila melebihi stok yang tersedia.
  bool add(Product p) {
    final idx = state.indexWhere((c) => c.product.id == p.id);
    final currentQty = idx >= 0 ? state[idx].qty : 0;
    if (currentQty + 1 > p.stock) return false;
    if (idx >= 0) {
      final updated = [...state];
      updated[idx] = updated[idx].copyWith(qty: currentQty + 1);
      state = updated;
    } else {
      state = [...state, CartItem(product: p, qty: 1)];
    }
    return true;
  }

  /// Tambah qty item yang sudah ada. Return false bila melebihi stok.
  bool increment(String productId) {
    final idx = state.indexWhere((c) => c.product.id == productId);
    if (idx < 0) return false;
    final c = state[idx];
    if (c.qty + 1 > c.product.stock) return false;
    final updated = [...state];
    updated[idx] = c.copyWith(qty: c.qty + 1);
    state = updated;
    return true;
  }

  void decrement(String productId) {
    state = [
      for (final c in state)
        if (c.product.id == productId)
          c.copyWith(qty: c.qty - 1)
        else
          c,
    ].where((c) => c.qty > 0).toList();
  }

  void removeItem(String productId) {
    state = state.where((c) => c.product.id != productId).toList();
  }

  void clear() => state = const [];
}

final cartProvider =
    StateNotifierProvider<CartNotifier, List<CartItem>>((ref) => CartNotifier());

/// Total belanja saat ini.
final cartTotalProvider = Provider<double>((ref) {
  final items = ref.watch(cartProvider);
  return items.fold(0.0, (sum, c) => sum + c.subtotal);
});

/// Jumlah item (qty) di keranjang.
final cartCountProvider = Provider<int>((ref) {
  final items = ref.watch(cartProvider);
  return items.fold(0, (sum, c) => sum + c.qty);
});

/// Simpan transaksi ke SQLite (offline-first), lalu coba sync ke server.
Future<void> checkout({
  required WidgetRef ref,
  required List<CartItem> items,
  required double paid,
  required String paymentMethod,
  String? shiftId,
}) async {
  final db = await LocalDb.instance;
  final localId = const Uuid().v4();
  final subtotal = items.fold<double>(0, (s, c) => s + c.subtotal);
  const tax = 0.0;
  const discount = 0.0;
  final total = subtotal - discount + tax;
  final change = paid - total;
  final now = DateTime.now().toUtc().toIso8601String(); // simpan UTC (tz-aware)

  await db.insert('transactions', {
    'local_id': localId,
    'shift_id': shiftId,
    'subtotal': subtotal,
    'tax': tax,
    'discount': discount,
    'total': total,
    'paid': paid,
    'change': change,
    'payment_method': paymentMethod,
    'created_at': now,
    'is_synced': 0,
  });

  for (final c in items) {
    await db.insert('transaction_items', {
      'local_tx_id': localId,
      'product_id': c.product.id,
      'product_name': c.product.name,
      'price': c.product.price,
      'qty': c.qty,
      'subtotal': c.subtotal,
    });
    // Kurangi stok di cache lokal (optimistic) — server dikurangi oleh
    // trigger decrement_stock saat item ter-sync.
    await db.rawUpdate(
      'UPDATE products SET stock = stock - ? WHERE id = ?',
      [c.qty, c.product.id],
    );
  }

  // Best-effort sync (tidak menghalangi UI kalau offline).
  final sync = ref.read(syncServiceProvider);
  unawaited(sync.syncPendingTransactions());
}
