class Product {
  final String id;
  final String name;
  final String? sku;
  final String? barcode;
  final double price;
  final int stock;
  final String? categoryId;
  final String? imageUrl;
  final bool isActive;

  const Product({
    required this.id,
    required this.name,
    this.sku,
    this.barcode,
    required this.price,
    required this.stock,
    this.categoryId,
    this.imageUrl,
    required this.isActive,
  });

  factory Product.fromMap(Map<String, dynamic> m) => Product(
        id: m['id'] as String,
        name: m['name'] as String,
        sku: m['sku'] as String?,
        barcode: m['barcode'] as String?,
        price: (m['price'] as num).toDouble(),
        stock: (m['stock'] as num).toInt(),
        categoryId: m['category_id'] as String?,
        imageUrl: m['image_url'] as String?,
        isActive: (m['is_active'] as int) == 1,
      );
}

class CartItem {
  final Product product;
  final int qty;

  const CartItem({required this.product, required this.qty});

  double get subtotal => product.price * qty;

  CartItem copyWith({int? qty}) =>
      CartItem(product: product, qty: qty ?? this.qty);
}
