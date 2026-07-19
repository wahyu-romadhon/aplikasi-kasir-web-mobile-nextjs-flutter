import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../core/utils/format.dart';
import 'models.dart';
import 'providers.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  @override
  void initState() {
    super.initState();
    // Coba sinkronkan transaksi yang belum ter-upload saat app dibuka.
    Future.microtask(() => ref.read(syncServiceProvider).syncPendingTransactions());
  }

  Future<void> _logout() async {
    await Supabase.instance.client.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(productsProvider);
    final count = ref.watch(cartCountProvider);
    final total = ref.watch(cartTotalProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kasir'),
        backgroundColor: AppColors.surface,
        actions: [
          IconButton(
            tooltip: 'Keluar',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: productsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(
          message: 'Gagal memuat produk.\n$e',
          onRetry: () => ref.invalidate(productsProvider),
        ),
        data: (products) {
          if (products.isEmpty) {
            return _ErrorState(
              message: 'Belum ada produk aktif.\nTambahkan produk lewat dashboard admin.',
              onRetry: () => ref.invalidate(productsProvider),
              icon: Icons.inventory_2_outlined,
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(productsProvider),
            child: GridView.builder(
              padding: const EdgeInsets.all(AppSpacing.md),
              gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 220,
                mainAxisSpacing: AppSpacing.md,
                crossAxisSpacing: AppSpacing.md,
                childAspectRatio: 1,
              ),
              itemCount: products.length,
              itemBuilder: (context, i) => _ProductCard(
                product: products[i],
                onTap: () {
                  ref.read(cartProvider.notifier).add(products[i]);
                },
              ),
            ),
          );
        },
      ),
      bottomNavigationBar: count == 0
          ? null
          : _CartBar(
              count: count,
              total: total,
              onPressed: _openCart,
            ),
    );
  }

  Future<void> _openCart() async {
    final proceed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.radiusCard)),
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.radiusCard)),
      ),
      builder: (_) => _PaymentSheet(total: total),
    );
    if (result == null || !mounted) return;

    final items = ref.read(cartProvider);
    await checkout(
      ref: ref,
      items: items,
      paid: result.paid,
      paymentMethod: result.method,
    );
    ref.read(cartProvider.notifier).clear();
    if (mounted) _showSuccess(total: total, paid: result.paid);
  }

  void _showSuccess({required double total, required double paid}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: AppColors.success, size: 48),
        title: const Text('Transaksi Berhasil'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _row('Total', formatRupiah(total)),
            _row('Dibayar', formatRupiah(paid)),
            const Divider(),
            _row('Kembalian', formatRupiah(paid - total), bold: true),
          ],
        ),
        actions: [
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

class _ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;
  const _ProductCard({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  product.name,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
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
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
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
        child: SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: onPressed,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('$count item'),
                Text(
                  formatRupiah(total),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                const Row(
                  children: [Text('Bayar'), Icon(Icons.arrow_forward)],
                ),
              ],
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Keranjang', style: Theme.of(context).textTheme.titleMedium),
                TextButton(
                  onPressed: () {
                    cart.clear();
                    Navigator.pop(context);
                  },
                  child: const Text('Kosongkan', style: TextStyle(color: AppColors.danger)),
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
                        onPlus: () => cart.increment(c.product.id),
                      ),
                      const SizedBox(width: AppSpacing.md),
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
              height: AppSpacing.touchTarget,
              child: ElevatedButton(
                onPressed: items.isEmpty ? null : () => Navigator.pop(context, true),
                child: const Text('Lanjut Bayar'),
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
  const _QtyStepper({required this.qty, required this.onMinus, required this.onPlus});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: onMinus,
          icon: const Icon(Icons.remove_circle_outline),
          color: AppColors.danger,
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
        top: AppSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
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
            height: AppSpacing.touchTarget,
            child: ElevatedButton(
              onPressed: enough
                  ? () => Navigator.pop(context, _PayResult(_paid, _method))
                  : null,
              child: const Text('Konfirmasi Bayar'),
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
