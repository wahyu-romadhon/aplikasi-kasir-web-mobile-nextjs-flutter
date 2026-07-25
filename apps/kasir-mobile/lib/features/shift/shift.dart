import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class Shift {
  final String id;
  final double openingCash;
  final DateTime openedAt;
  const Shift({
    required this.id,
    required this.openingCash,
    required this.openedAt,
  });
}

/// Shift yang masih terbuka (closed_at NULL) milik kasir yang login.
final activeShiftProvider = FutureProvider<Shift?>((ref) async {
  final sb = Supabase.instance.client;
  final uid = sb.auth.currentUser?.id;
  if (uid == null) return null;
  final row = await sb
      .from('shifts')
      .select('id, opening_cash, opened_at')
      .eq('cashier_id', uid)
      .filter('closed_at', 'is', null)
      .order('opened_at', ascending: false)
      .limit(1)
      .maybeSingle();
  if (row == null) return null;
  return Shift(
    id: row['id'] as String,
    openingCash: (row['opening_cash'] as num).toDouble(),
    openedAt: DateTime.parse(row['opened_at'] as String),
  );
});

/// Buka shift baru dengan modal awal.
Future<void> openShift(double openingCash) async {
  final sb = Supabase.instance.client;
  final uid = sb.auth.currentUser!.id;
  final prof =
      await sb.from('profiles').select('store_id').eq('id', uid).single();
  await sb.from('shifts').insert({
    'store_id': prof['store_id'],
    'cashier_id': uid,
    'opening_cash': openingCash,
  });
}

/// Tutup shift. Kasir HANYA mengirim setoran (closing_cash) — `expected_cash`
/// TIDAK dihitung/disimpan di sini (dihitung admin saat rekonsiliasi).
Future<void> closeShift(String shiftId, double closingCash) async {
  final sb = Supabase.instance.client;
  await sb.from('shifts').update({
    'closing_cash': closingCash,
    'closed_at': DateTime.now().toUtc().toIso8601String(),
  }).eq('id', shiftId);
}

/// Ringkasan penjualan satu shift.
class ShiftSummary {
  final double totalSales;
  final double cashSales;
  final int count;
  final Map<String, double> byMethod;
  const ShiftSummary({
    required this.totalSales,
    required this.cashSales,
    required this.count,
    required this.byMethod,
  });
}

/// Hitung penjualan shift dari transaksi milik kasir (RLS: baca transaksi sendiri).
Future<ShiftSummary> fetchShiftSummary(String shiftId) async {
  final sb = Supabase.instance.client;
  final rows = await sb
      .from('transactions')
      .select('total, payment_method')
      .eq('shift_id', shiftId)
      .eq('status', 'completed');

  double total = 0, cash = 0;
  int count = 0;
  final byMethod = <String, double>{};
  for (final r in (rows as List)) {
    final t = (r['total'] as num).toDouble();
    final m = (r['payment_method'] as String?) ?? 'cash';
    total += t;
    count++;
    byMethod[m] = (byMethod[m] ?? 0) + t;
    if (m == 'cash') cash += t;
  }
  return ShiftSummary(
      totalSales: total, cashSales: cash, count: count, byMethod: byMethod);
}
