import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class LicenseService {
  static const _kLastValid = 'license_last_valid';

  /// Return true bila lisensi valid. Panggil saat app start & tiap buka shift.
  Future<bool> verify(String licenseKey, String deviceId) async {
    try {
      final res = await http.post(
        Uri.parse(dotenv.env['LICENSE_API_URL']!),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'license_key': licenseKey, 'device_id': deviceId}),
      );
      if (res.statusCode != 200) return await _lastKnownValid();
      final data = jsonDecode(res.body);
      final valid = data['valid'] == true;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kLastValid, valid);
      return valid;
    } catch (_) {
      // Offline grace period: pakai hasil verifikasi terakhir yang tersimpan.
      return await _lastKnownValid();
    }
  }

  Future<bool> _lastKnownValid() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kLastValid) ?? true;
  }
}
