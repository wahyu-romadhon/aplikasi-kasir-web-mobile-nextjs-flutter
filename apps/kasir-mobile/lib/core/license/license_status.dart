import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/app_colors.dart';

/// Teks watermark yang harus ditampilkan: 'TRIAL', 'DEMO', atau null.
final licenseWatermarkProvider = FutureProvider<String?>((ref) async {
  final sb = Supabase.instance.client;
  final uid = sb.auth.currentUser?.id;
  if (uid == null) return null;
  try {
    final prof =
        await sb.from('profiles').select('store_id').eq('id', uid).maybeSingle();
    final storeId = prof?['store_id'];
    if (storeId == null) return null;
    final lic = await sb
        .from('licenses')
        .select('status, plan')
        .eq('store_id', storeId)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (lic == null) return null;
    if (lic['status'] == 'trial') return 'TRIAL';
    if (lic['plan'] == 'demo') return 'DEMO';
    return null;
  } catch (_) {
    return null; // kasir tak bisa baca licenses → tanpa watermark
  }
});

/// Stempel merah samar (opacity tipis) di tengah layar.
class Watermark extends StatelessWidget {
  final String text;
  const Watermark({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: Opacity(
          opacity: 0.10,
          child: Transform.rotate(
            angle: -0.35,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.danger, width: 4),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                text,
                style: const TextStyle(
                  color: AppColors.danger,
                  fontSize: 56,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 8,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
