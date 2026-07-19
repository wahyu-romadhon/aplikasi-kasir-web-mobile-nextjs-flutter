import 'package:flutter_test/flutter_test.dart';

import 'package:kasir_mobile/features/pos/models.dart';

void main() {
  test('CartItem menghitung subtotal dengan benar', () {
    const product = Product(
      id: 'p1',
      name: 'Es Teh',
      price: 5000,
      stock: 10,
      isActive: true,
    );
    const item = CartItem(product: product, qty: 3);
    expect(item.subtotal, 15000);
  });
}
