import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'local_db.dart';

class SyncService {
  final _supabase = Supabase.instance.client;

  Future<bool> _isOffline() async {
    final conn = await Connectivity().checkConnectivity();
    return conn.contains(ConnectivityResult.none);
  }

  /// store_id kasir yang sedang login (dari tabel profiles).
  Future<String?> _getStoreId() async {
    final uid = _supabase.auth.currentUser?.id;
    if (uid == null) return null;
    final row = await _supabase
        .from('profiles')
        .select('store_id')
        .eq('id', uid)
        .maybeSingle();
    return row?['store_id'] as String?;
  }

  /// Jumlah transaksi lokal yang belum ter-sync.
  Future<int> pendingCount() async {
    final db = await LocalDb.instance;
    final rows = await db.query('transactions', where: 'is_synced = 0');
    return rows.length;
  }

  /// Panggil: setelah tiap transaksi, saat app dibuka, dan saat internet kembali.
  Future<void> syncPendingTransactions() async {
    if (await _isOffline()) return;
    final storeId = await _getStoreId();
    if (storeId == null) return;

    final db = await LocalDb.instance;
    final pending = await db.query('transactions', where: 'is_synced = 0');

    for (final tx in pending) {
      try {
        final items = await db.query('transaction_items',
            where: 'local_tx_id = ?', whereArgs: [tx['local_id']]);

        final inserted = await _supabase.from('transactions').upsert({
          'local_id': tx['local_id'], // dedup: kolom UNIQUE di server
          'store_id': storeId,
          'cashier_id': _supabase.auth.currentUser!.id,
          'shift_id': tx['shift_id'],
          'subtotal': tx['subtotal'],
          'tax': tx['tax'],
          'discount': tx['discount'],
          'total': tx['total'],
          'paid': tx['paid'],
          'change': tx['change'],
          'payment_method': tx['payment_method'],
          'created_at': tx['created_at'],
        }, onConflict: 'local_id').select('id').single();

        await _supabase.from('transaction_items').insert(items
            .map((i) => {
                  'transaction_id': inserted['id'],
                  'product_id': i['product_id'],
                  'product_name': i['product_name'],
                  'price': i['price'],
                  'qty': i['qty'],
                  'subtotal': i['subtotal'],
                })
            .toList());

        await db.update('transactions', {'is_synced': 1},
            where: 'local_id = ?', whereArgs: [tx['local_id']]);
      } catch (_) {
        // gagal → biarkan is_synced = 0, dicoba lagi nanti
      }
    }
  }

  /// Ambil produk terbaru dari server → cache ke SQLite.
  /// Pakai VIEW products_kasir → kasir TIDAK menerima cost_price.
  Future<void> pullProducts() async {
    if (await _isOffline()) return;

    final rows = await _supabase.from('products_kasir').select();
    final db = await LocalDb.instance;
    final batch = db.batch();
    batch.delete('products');
    for (final r in rows) {
      batch.insert('products', {
        'id': r['id'],
        'name': r['name'],
        'sku': r['sku'],
        'barcode': r['barcode'],
        'price': r['price'],
        'stock': r['stock'],
        'category_id': r['category_id'],
        'image_url': r['image_url'],
        'is_active': (r['is_active'] as bool) ? 1 : 0,
      });
    }
    await batch.commit(noResult: true);
  }
}
