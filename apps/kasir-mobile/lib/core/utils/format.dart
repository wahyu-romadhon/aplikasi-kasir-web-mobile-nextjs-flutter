import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

final _rupiah = NumberFormat.currency(
  locale: 'id_ID',
  symbol: 'Rp ',
  decimalDigits: 0,
);

String formatRupiah(num value) => _rupiah.format(value);

final _decimal = NumberFormat.decimalPattern('id');

/// 1000000 → "1.000.000" (tanpa "Rp").
String formatThousands(num value) => _decimal.format(value);

/// Ambil nilai numerik dari teks berformat, "1.000.000" → 1000000.
double parseMoney(String text) =>
    double.tryParse(text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;

/// Formatter TextField: menambah separator ribuan saat mengetik.
class ThousandsInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return const TextEditingValue(text: '');
    final formatted = formatThousands(int.parse(digits));
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
