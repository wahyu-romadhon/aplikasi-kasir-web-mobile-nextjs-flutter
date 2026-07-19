import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/local_db.dart';
import '../../core/database/sync_service.dart';
import 'models.dart';

final syncServiceProvider = Provider<SyncService>((ref) => SyncService());

/// Produk aktif dari SQLite (setelah best-effort pull dari server).
final productsProvider = FutureProvider<List<Product>>((ref) async {
  final sync = ref.read(syncServiceProvider);
  try {
    await sync.pullProducts();
  } catch (_) {
    // offline / gagal → pakai cache SQLite yang ada
  }
  final db = await LocalDb.instance;
  final rows = await db.query(
    'products',
    where: 'is_active = 1',
    orderBy: 'name COLLATE NOCASE',
  );
  return rows.map((r) => Product.fromMap(r)).toList();
});

class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super(const []);

  void add(Product p) {
    final idx = state.indexWhere((c) => c.product.id == p.id);
    if (idx >= 0) {
      final updated = [...state];
      updated[idx] = updated[idx].copyWith(qty: updated[idx].qty + 1);
      state = updated;
    } else {
      state = [...state, CartItem(product: p, qty: 1)];
    }
  }

  void increment(String productId) {
    state = [
      for (final c in state)
        if (c.product.id == productId) c.copyWith(qty: c.qty + 1) else c,
    ];
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
}) async {
  final db = await LocalDb.instance;
  final localId = const Uuid().v4();
  final subtotal = items.fold<double>(0, (s, c) => s + c.subtotal);
  const tax = 0.0;
  const discount = 0.0;
  final total = subtotal - discount + tax;
  final change = paid - total;
  final now = DateTime.now().toIso8601String();

  await db.insert('transactions', {
    'local_id': localId,
    'shift_id': null,
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
  }

  // Best-effort sync (tidak menghalangi UI kalau offline).
  final sync = ref.read(syncServiceProvider);
  unawaited(sync.syncPendingTransactions());
}
