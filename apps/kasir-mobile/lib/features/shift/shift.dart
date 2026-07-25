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
