import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../core/utils/format.dart';
import '../pos/models.dart';

const _methodLabel = {
  'cash': 'Tunai',
  'qris': 'QRIS',
  'transfer': 'Transfer',
  'debit': 'Debit',
};

/// Data untuk mencetak/berbagi struk.
class ReceiptData {
  final List<CartItem> items;
  final double total;
  final double paid;
  final double change;
  final String method;
  final DateTime dateTime;

  const ReceiptData({
    required this.items,
    required this.total,
    required this.paid,
    required this.change,
    required this.method,
    required this.dateTime,
  });
}

/// Garis perforasi (titik-titik) — kesan "sobek di sini".
pw.Widget _perforation() => pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 3),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: List.generate(
          22,
          (_) => pw.Container(width: 3, height: 2, color: PdfColors.grey500),
        ),
      ),
    );

/// Bangun struk sebagai PDF (ukuran roll 58mm) lalu buka share sheet.
Future<void> shareReceiptPdf({
  required ReceiptData data,
  required String storeName,
  required String footer,
  String? watermarkText,
}) async {
  final doc = pw.Document();
  // Pola numerik → tak perlu locale data (hindari LocaleDataException).
  final dateStr = DateFormat('dd/MM/yyyy HH:mm').format(data.dateTime);

  pw.Widget line(String left, String right, {bool bold = false}) => pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(left,
              style: pw.TextStyle(
                  fontSize: 8,
                  fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
          pw.Text(right,
              style: pw.TextStyle(
                  fontSize: 8,
                  fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
        ],
      );

  final divider = pw.Text('-' * 32,
      maxLines: 1, style: const pw.TextStyle(fontSize: 8));

  final content = pw.Column(
    crossAxisAlignment: pw.CrossAxisAlignment.stretch,
    children: [
      _perforation(), // garis sobek atas
      pw.SizedBox(height: 4),
      pw.Center(
        child: pw.Text(storeName,
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
      ),
      pw.SizedBox(height: 2),
      pw.Center(child: pw.Text(dateStr, style: const pw.TextStyle(fontSize: 8))),
      pw.SizedBox(height: 4),
      divider,
      pw.SizedBox(height: 2),
      ...data.items.map((c) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Text(c.product.name, style: const pw.TextStyle(fontSize: 8)),
              line('${c.qty} x ${formatRupiah(c.product.price)}',
                  formatRupiah(c.subtotal)),
              pw.SizedBox(height: 2),
            ],
          )),
      divider,
      pw.SizedBox(height: 2),
      line('Total', formatRupiah(data.total), bold: true),
      line('Bayar (${_methodLabel[data.method] ?? data.method})',
          formatRupiah(data.paid)),
      line('Kembalian', formatRupiah(data.change)),
      pw.SizedBox(height: 6),
      divider,
      pw.SizedBox(height: 4),
      pw.Center(child: pw.Text(footer, style: const pw.TextStyle(fontSize: 8))),
      pw.SizedBox(height: 4),
      _perforation(), // garis sobek bawah
    ],
  );

  doc.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.roll57,
      margin: const pw.EdgeInsets.all(8),
      build: (ctx) => watermarkText != null
          ? pw.Stack(
              alignment: pw.Alignment.center,
              children: [
                content,
                // Watermark (TRIAL / DEMO) samar di tengah.
                pw.Opacity(
                  opacity: 0.13,
                  child: pw.Transform.rotate(
                    angle: 0.6,
                    child: pw.Text(
                      watermarkText,
                      style: pw.TextStyle(
                        fontSize: 36,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.red,
                      ),
                    ),
                  ),
                ),
              ],
            )
          : content,
    ),
  );

  final bytes = await doc.save();
  final stamp = DateFormat('yyyyMMdd-HHmmss').format(data.dateTime);
  await Printing.sharePdf(bytes: bytes, filename: 'struk-$stamp.pdf');
}
