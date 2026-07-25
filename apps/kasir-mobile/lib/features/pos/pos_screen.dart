import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../core/utils/format.dart';
import '../receipt/receipt_service.dart';
import '../shift/shift.dart';
import 'models.dart';
import 'providers.dart';

class PosScreen extends ConsumerStatefulWidget {
  final Shift shift;
  const PosScreen({super.key, required this.shift});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  @override
  void initState() {
    super.initState();
    // Saat app dibuka: push transaksi tertunda + tarik produk terbaru.
    Future.microtask(() => refreshProducts(ref));
  }

  Future<void> _logout() async {
    await Supabase.instance.client.auth.signOut();
  }

  Future<void> _closeShift() async {
    final closing = await showModalBottomSheet<double>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CloseShiftSheet(openingCash: widget.shift.openingCash),
    );
    if (closing == null || !mounted) return;
    try {
      // Pastikan transaksi ter-sync dulu sebelum shift ditutup.
      await ref.read(syncServiceProvider).syncPendingTransactions();
      await closeShift(widget.shift.id, closing);
      ref.invalidate(activeShiftProvider); // ShiftGate → kembali ke buka shift
    } catch (e) {
      if (mounted) _snack('Gagal tutup shift: $e');
    }
  }

  void _snack(String message, {Color color = AppColors.danger}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(message),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(milliseconds: 1400),
      ));
  }

  void _addToCart(Product p) {
    if (p.stock <= 0) {
      _snack('${p.name} stok habis');
      return;
    }
    final ok = ref.read(cartProvider.notifier).add(p);
    if (!ok) {
      _snack('Stok ${p.name} tidak cukup (tersisa ${p.stock})');
    }
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(productsProvider);
    final count = ref.watch(cartCountProvider);
    final total = ref.watch(cartTotalProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kasir', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0.5,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (v) {
              if (v == 'close') _closeShift();
              if (v == 'logout') _logout();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'close',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.lock_clock, color: AppColors.secondary),
                  title: Text('Tutup Shift'),
                ),
              ),
              PopupMenuItem(
                value: 'logout',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.logout),
                  title: Text('Keluar'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: productsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          message: 'Gagal memuat produk.\n$e',
          onRetry: () => refreshProducts(ref),
        ),
        data: (products) {
          if (products.isEmpty) {
            return _ErrorState(
              message:
                  'Belum ada produk aktif.\nTambahkan produk lewat dashboard admin.',
              onRetry: () => refreshProducts(ref),
              icon: Icons.inventory_2_outlined,
            );
          }
          return RefreshIndicator(
            onRefresh: () => refreshProducts(ref),
            child: GridView.builder(
              padding: const EdgeInsets.all(AppSpacing.md),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 190,
                mainAxisSpacing: AppSpacing.md,
                crossAxisSpacing: AppSpacing.md,
                childAspectRatio: 0.74,
              ),
              itemCount: products.length,
              itemBuilder: (context, i) => _ProductCard(
                product: products[i],
                onTap: () => _addToCart(products[i]),
              ),
            ),
          );
        },
      ),
      bottomNavigationBar:
          count == 0 ? null : _CartBar(count: count, total: total, onPressed: _openCart),
    );
  }

  Future<void> _openCart() async {
    final proceed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _CartSheet(),
    );
    if (proceed == true && mounted) _openPayment();
  }

  Future<void> _openPayment() async {
    final total = ref.read(cartTotalProvider);
    final result = await showModalBottomSheet<_PayResult>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _PaymentSheet(total: total),
    );
    if (result == null || !mounted) return;

    // Salin item sebelum keranjang dikosongkan (untuk struk).
    final items = List<CartItem>.from(ref.read(cartProvider));
    await checkout(
      ref: ref,
      items: items,
      paid: result.paid,
      paymentMethod: result.method,
      shiftId: widget.shift.id,
    );
    ref.read(cartProvider.notifier).clear();
    ref.invalidate(productsProvider); // refresh stok di grid (#8)

    final sale = ReceiptData(
      items: items,
      total: total,
      paid: result.paid,
      change: result.paid - total,
      method: result.method,
      dateTime: DateTime.now(),
    );
    if (mounted) _showSuccess(sale);
  }

  Future<void> _shareReceipt(ReceiptData sale) async {
    try {
      final store = await ref.read(storeInfoProvider.future);
      await shareReceiptPdf(
        data: sale,
        storeName: store.name,
        footer: store.footer,
      );
    } catch (e) {
      if (mounted) _snack('Gagal membuat struk: $e');
    }
  }

  void _showSuccess(ReceiptData sale) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: AppColors.success, size: 52),
        title: const Text('Transaksi Berhasil'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _row('Total', formatRupiah(sale.total)),
            _row('Dibayar', formatRupiah(sale.paid)),
            const Divider(),
            _row('Kembalian', formatRupiah(sale.change), bold: true),
          ],
        ),
        actions: [
          OutlinedButton.icon(
            onPressed: () => _shareReceipt(sale),
            icon: const Icon(Icons.share_outlined, size: 18),
            label: const Text('Bagikan Struk'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Transaksi Baru'),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: TextStyle(
              fontFeatures: const [FontFeature.tabularFigures()],
              fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }
}

/// Gambar produk dengan placeholder & penanganan error.
class _ProductImage extends StatelessWidget {
  final Product product;
  const _ProductImage({required this.product});

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      color: AppColors.primaryLight,
      alignment: Alignment.center,
      child: const Icon(Icons.inventory_2_outlined,
          color: AppColors.primary, size: 32),
    );
    if (product.imageUrl == null || product.imageUrl!.isEmpty) {
      return placeholder;
    }
    return Image.network(
      product.imageUrl!,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : Container(color: AppColors.primaryLight),
      errorBuilder: (_, _, _) => placeholder,
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;
  const _ProductCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final habis = product.stock <= 0;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: habis ? null : onTap,
          borderRadius: BorderRadius.circular(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _ProductImage(product: product),
                      if (habis)
                        Container(
                          color: Colors.black.withValues(alpha: 0.45),
                          alignment: Alignment.center,
                          child: const Text('HABIS',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1)),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14, height: 1.2),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      formatRupiah(product.price),
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    Text(
                      'Stok: ${product.stock}',
                      style: TextStyle(
                        color: habis ? AppColors.danger : AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartBar extends StatelessWidget {
  final int count;
  final double total;
  final VoidCallback onPressed;
  const _CartBar({required this.count, required this.total, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Material(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(16),
          elevation: 3,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.shopping_cart_outlined,
                        color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Text('$count item',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  Text(
                    formatRupiah(total),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const Icon(Icons.arrow_forward, color: Colors.white),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CartSheet extends ConsumerWidget {
  const _CartSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(cartProvider);
    final total = ref.watch(cartTotalProvider);
    final cart = ref.read(cartProvider.notifier);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Keranjang', style: Theme.of(context).textTheme.titleMedium),
                TextButton(
                  onPressed: () {
                    cart.clear();
                    Navigator.pop(context);
                  },
                  child: const Text('Kosongkan',
                      style: TextStyle(color: AppColors.danger)),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: items.length,
                separatorBuilder: (_, _) => const Divider(height: AppSpacing.lg),
                itemBuilder: (context, i) {
                  final c = items[i];
                  return Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c.product.name,
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(formatRupiah(c.product.price),
                                style: const TextStyle(
                                    color: AppColors.textSecondary, fontSize: 12)),
                          ],
                        ),
                      ),
                      _QtyStepper(
                        qty: c.qty,
                        onMinus: () => cart.decrement(c.product.id),
                        onPlus: () {
                          final ok = cart.increment(c.product.id);
                          if (!ok) {
                            ScaffoldMessenger.of(context)
                              ..hideCurrentSnackBar()
                              ..showSnackBar(SnackBar(
                                content: Text(
                                    'Stok ${c.product.name} tidak cukup (tersisa ${c.product.stock})'),
                                backgroundColor: AppColors.danger,
                                behavior: SnackBarBehavior.floating,
                                duration: const Duration(milliseconds: 1400),
                              ));
                          }
                        },
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      SizedBox(
                        width: 90,
                        child: Text(
                          formatRupiah(c.subtotal),
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            const Divider(height: AppSpacing.xl),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total', style: Theme.of(context).textTheme.titleMedium),
                Text(
                  formatRupiah(total),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: items.isEmpty ? null : () => Navigator.pop(context, true),
                child: const Text('Lanjut Bayar',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QtyStepper extends StatelessWidget {
  final int qty;
  final VoidCallback onMinus;
  final VoidCallback onPlus;
  const _QtyStepper(
      {required this.qty, required this.onMinus, required this.onPlus});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: onMinus,
          icon: const Icon(Icons.remove_circle_outline),
          color: AppColors.danger,
          visualDensity: VisualDensity.compact,
        ),
        SizedBox(
          width: 24,
          child: Text('$qty',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
        IconButton(
          onPressed: onPlus,
          icon: const Icon(Icons.add_circle_outline),
          color: AppColors.primary,
          visualDensity: VisualDensity.compact,
        ),
      ],
    );
  }
}

class _PayResult {
  final double paid;
  final String method;
  const _PayResult(this.paid, this.method);
}

class _PaymentSheet extends StatefulWidget {
  final double total;
  const _PaymentSheet({required this.total});

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  final _paidCtrl = TextEditingController();
  String _method = 'cash';

  static const _methods = {
    'cash': 'Tunai',
    'qris': 'QRIS',
    'transfer': 'Transfer',
    'debit': 'Debit',
  };

  @override
  void dispose() {
    _paidCtrl.dispose();
    super.dispose();
  }

  double get _paid => double.tryParse(_paidCtrl.text.replaceAll('.', '')) ?? 0;

  void _setPaid(double value) {
    _paidCtrl.text = value.toStringAsFixed(0);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.total;
    final change = _paid - total;
    final enough = _paid >= total;

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text('Pembayaran', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
            ),
            child: Column(
              children: [
                const Text('Total Belanja',
                    style: TextStyle(color: AppColors.textSecondary)),
                Text(
                  formatRupiah(total),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            children: _methods.entries.map((e) {
              return ChoiceChip(
                label: Text(e.value),
                selected: _method == e.key,
                onSelected: (_) => setState(() => _method = e.key),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: _paidCtrl,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Uang diterima',
              prefixText: 'Rp ',
            ),
            style: const TextStyle(
              fontSize: 20,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              ActionChip(
                label: const Text('Uang Pas'),
                onPressed: () => _setPaid(total),
              ),
              for (final n in [20000, 50000, 100000])
                ActionChip(
                  label: Text(formatRupiah(n)),
                  onPressed: () => _setPaid(n.toDouble()),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Kembalian'),
              Text(
                formatRupiah(change < 0 ? 0 : change),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: enough
                  ? () => Navigator.pop(context, _PayResult(_paid, _method))
                  : null,
              child: const Text('Konfirmasi Bayar',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sheet tutup shift. Kasir hanya memasukkan setoran (uang di laci).
/// TIDAK menampilkan expected_cash maupun selisih (rahasia — hanya admin).
class _CloseShiftSheet extends StatefulWidget {
  final double openingCash;
  const _CloseShiftSheet({required this.openingCash});

  @override
  State<_CloseShiftSheet> createState() => _CloseShiftSheetState();
}

class _CloseShiftSheetState extends State<_CloseShiftSheet> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  double get _closing => double.tryParse(_ctrl.text.replaceAll('.', '')) ?? 0;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text('Tutup Shift', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Modal awal', style: TextStyle(color: AppColors.textSecondary)),
              Text(formatRupiah(widget.openingCash),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  )),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: _ctrl,
            keyboardType: TextInputType.number,
            autofocus: true,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Setoran (uang di laci sekarang)',
              prefixText: 'Rp ',
            ),
            style: const TextStyle(
              fontSize: 20,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Hitung total uang tunai di laci, lalu masukkan di atas.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context, _closing),
              child: const Text('Tutup Shift',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final IconData icon;
  const _ErrorState({
    required this.message,
    required this.onRetry,
    this.icon = Icons.cloud_off,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: AppSpacing.md),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.lg),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Muat Ulang'),
            ),
          ],
        ),
      ),
    );
  }
}
