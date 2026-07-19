import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class LocalDb {
  static Database? _db;

  static Future<Database> get instance async {
    if (_db != null) return _db!;
    final path = join(await getDatabasesPath(), 'kasirku.db');
    _db = await openDatabase(path, version: 1, onCreate: _createTables);
    return _db!;
  }

  static Future<void> _createTables(Database db, int version) async {
    // Cache produk (dari view products_kasir — TANPA cost_price)
    await db.execute('''
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT, barcode TEXT,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category_id TEXT, image_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    ''');
    // Transaksi lokal — antrean sync
    await db.execute('''
      CREATE TABLE transactions (
        local_id TEXT PRIMARY KEY,
        shift_id TEXT,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        paid REAL NOT NULL,
        change REAL NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        created_at TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_tx_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        qty INTEGER NOT NULL,
        subtotal REAL NOT NULL
      )
    ''');
  }
}
