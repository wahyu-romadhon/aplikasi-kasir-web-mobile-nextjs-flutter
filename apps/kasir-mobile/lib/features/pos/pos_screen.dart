import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../core/license/license_status.dart';
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

  void _showShiftSummary() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ShiftSummarySheet(shift: widget.shift),
    );
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
    final cartItems = ref.watch(cartProvider);
    final qtyById = <String, int>{
      for (final c in cartItems) c.product.id: c.qty,
    };

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
              if (v == 'summary') _showShiftSummary();
              if (v == 'close') _closeShift();
              if (v == 'logout') _logout();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'summary',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.assessment_outlined, color: AppColors.primary),
                  title: Text('Ringkasan Shift'),
                ),
              ),
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
                maxCrossAxisExtent: 132,
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                childAspectRatio: 0.56,
              ),
              itemCount: products.length,
              itemBuilder: (context, i) {
                final p = products[i];
                return _ProductCard(
                  product: p,
                  qty: qtyById[p.id] ?? 0,
                  onAdd: () => _addToCart(p),
                  onRemove: () =>
                      ref.read(cartProvider.notifier).decrement(p.id),
                );
              },
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
      final watermark = await ref.read(licenseWatermarkProvider.future);
      await shareReceiptPdf(
        data: sale,
        storeName: store.name,
        footer: store.footer,
        watermarkText: watermark,
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
  final int qty;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  const _ProductCard({
    required this.product,
    required this.qty,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final habis = product.stock <= 0;
    final active = qty > 0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: active ? AppColors.primary : AppColors.border,
          width: active ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: active
                ? AppColors.primary.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: active ? 14 : 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Area gambar + nama + harga → ketuk untuk tambah.
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: habis ? null : onAdd,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(14)),
                            child: _ProductImage(product: product),
                          ),
                          if (habis)
                            Container(
                              decoration: const BoxDecoration(
                                color: Color(0x73000000),
                                borderRadius: BorderRadius.vertical(
                                    top: Radius.circular(14)),
                              ),
                              alignment: Alignment.center,
                              child: const Text('HABIS',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 1)),
                            )
                          else
                            Positioned(
                              top: 6,
                              left: 6,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.55),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text('Stok ${product.stock}',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 6, 8, 2),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            product.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 12.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            formatRupiah(product.price),
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Kontrol tambah / kurang.
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 2, 6, 6),
            child: SizedBox(
              height: 34,
              child: habis
                  ? const Center(
                      child: Text('Habis',
                          style: TextStyle(
                              color: AppColors.danger,
                              fontSize: 12,
                              fontWeight: FontWeight.w600)),
                    )
                  : active
                      ? DecoratedBox(
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Row(
                            children: [
                              _StepButton(
                                  icon: Icons.remove,
                                  color: AppColors.primary,
                                  onTap: onRemove),
                              Expanded(
                                child: Center(
                                  child: Text(
                                    '$qty',
                                    style: const TextStyle(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      fontFeatures: [FontFeature.tabularFigures()],
                                    ),
                                  ),
                                ),
                              ),
                              _StepButton(
                                  icon: Icons.add,
                                  color: AppColors.primary,
                                  onTap: onAdd),
                            ],
                          ),
                        )
                      : Material(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(9),
                          child: InkWell(
                            onTap: onAdd,
                            borderRadius: BorderRadius.circular(9),
                            child: const Center(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add, size: 16, color: AppColors.primary),
                                  SizedBox(width: 4),
                                  Text('Tambah',
                                      style: TextStyle(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12.5)),
                                ],
                              ),
                            ),
                          ),
                        ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _StepButton({required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(9),
        child: SizedBox(
          width: 36,
          height: 34,
          child: Icon(icon, size: 18, color: color),
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

class _PaymentSheet extends ConsumerStatefulWidget {
  final double total;
  const _PaymentSheet({required this.total});

  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  final _paidCtrl = TextEditingController();
  QrisMethod? _qris; // null = tunai

  @override
  void dispose() {
    _paidCtrl.dispose();
    super.dispose();
  }

  double get _paid => parseMoney(_paidCtrl.text);

  void _setPaid(double value) {
    _paidCtrl.text = formatThousands(value);
    setState(() {});
  }

  void _showQrisFullScreen(QrisMethod qris, double total) {
    showDialog(
      context: context,
      builder: (_) => Dialog.fullscreen(
        backgroundColor: Colors.white,
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  icon: const Icon(Icons.close, size: 28),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(qris.label,
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w700)),
                        const SizedBox(height: AppSpacing.lg),
                        Image.network(
                          qris.imageUrl,
                          width: MediaQuery.of(context).size.width * 0.85,
                          fit: BoxFit.contain,
                          errorBuilder: (_, _, _) =>
                              const Text('Gambar QRIS gagal dimuat'),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        const Text('Total Bayar',
                            style: TextStyle(color: AppColors.textSecondary)),
                        Text(
                          formatRupiah(total),
                          style: const TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        const Text('Minta pembeli scan QRIS di atas',
                            style: TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.total;
    final methods = ref.watch(paymentMethodsProvider).valueOrNull ?? const <QrisMethod>[];
    final isCash = _qris == null;
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
          // Pilih metode: Tunai + QRIS yang diupload admin.
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              ChoiceChip(
                label: const Text('Tunai'),
                selected: isCash,
                onSelected: (_) => setState(() => _qris = null),
              ),
              for (final m in methods)
                ChoiceChip(
                  label: Text(m.label),
                  selected: _qris?.imageUrl == m.imageUrl,
                  onSelected: (_) => setState(() => _qris = m),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          if (isCash) ...[
            TextField(
              controller: _paidCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [ThousandsInputFormatter()],
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
                    ? () => Navigator.pop(context, _PayResult(_paid, 'cash'))
                    : null,
                child: const Text('Konfirmasi Bayar',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ] else ...[
            // Tampilkan QRIS untuk di-scan pembeli. Ketuk → layar penuh.
            Center(
              child: GestureDetector(
                onTap: () => _showQrisFullScreen(_qris!, total),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
                        child: Image.network(
                          _qris!.imageUrl,
                          width: 240,
                          height: 240,
                          fit: BoxFit.contain,
                          loadingBuilder: (context, child, progress) =>
                              progress == null
                                  ? child
                                  : const SizedBox(
                                      width: 240,
                                      height: 240,
                                      child: Center(
                                          child: CircularProgressIndicator()),
                                    ),
                          errorBuilder: (_, _, _) => const SizedBox(
                            width: 240,
                            height: 240,
                            child: Center(child: Text('Gambar QRIS gagal dimuat')),
                          ),
                        ),
                      ),
                      Positioned(
                        right: 4,
                        bottom: 4,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.fullscreen,
                              color: Colors.white, size: 18),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Ketuk QRIS untuk layar penuh · ${_qris!.label}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, _PayResult(total, 'qris')),
                child: const Text('Konfirmasi Lunas',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Ringkasan shift: modal awal + penjualan + total + perkiraan kas di laci.
class _ShiftSummarySheet extends StatelessWidget {
  final Shift shift;
  const _ShiftSummarySheet({required this.shift});

  Widget _line(String label, String value,
      {bool bold = false, bool sub = false}) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: sub ? 1 : 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  color: sub ? AppColors.textSecondary : AppColors.textPrimary,
                  fontSize: sub ? 12 : 14.5)),
          Text(value,
              style: TextStyle(
                  fontWeight: bold
                      ? FontWeight.w700
                      : (sub ? FontWeight.w400 : FontWeight.w600),
                  fontSize: sub ? 12 : 14.5,
                  fontFeatures: const [FontFeature.tabularFigures()])),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: FutureBuilder<ShiftSummary>(
          future: fetchShiftSummary(shift.id),
          builder: (context, snap) {
            Widget body;
            if (snap.connectionState != ConnectionState.done) {
              body = const SizedBox(
                  height: 160,
                  child: Center(child: CircularProgressIndicator()));
            } else if (snap.hasError) {
              body = SizedBox(
                  height: 100,
                  child: Center(child: Text('Gagal memuat: ${snap.error}')));
            } else {
              final s = snap.data!;
              final nonCash = s.totalSales - s.cashSales;
              final total = shift.openingCash + s.totalSales;
              final cashInDrawer = shift.openingCash + s.cashSales;
              body = Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _line('Modal Awal', formatRupiah(shift.openingCash)),
                  const SizedBox(height: 6),
                  _line('Penjualan Tunai', formatRupiah(s.cashSales)),
                  if (nonCash > 0)
                    _line('Penjualan Non-Tunai (QRIS/transfer)',
                        formatRupiah(nonCash)),
                  _line('Total Penjualan (${s.count} transaksi)',
                      formatRupiah(s.totalSales),
                      bold: true),
                  const Divider(height: AppSpacing.xl),
                  _line('Total (Modal + Penjualan)', formatRupiah(total),
                      bold: true),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
                    ),
                    child: Column(
                      children: [
                        const Text('Uang Tunai di Laci (fisik)',
                            style: TextStyle(
                                color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 2),
                        Text(
                          formatRupiah(cashInDrawer),
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        const Text('modal + tunai · non-tunai masuk rekening',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: AppColors.textSecondary, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              );
            }
            return Column(
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
                Text('Ringkasan Shift',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.md),
                body,
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  height: 48,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Tutup'),
                  ),
                ),
              ],
            );
          },
        ),
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

  double get _closing => parseMoney(_ctrl.text);

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
            inputFormatters: [ThousandsInputFormatter()],
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
