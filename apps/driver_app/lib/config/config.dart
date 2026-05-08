import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Trims a trailing `/` so Dio base URL stays consistent.
String _normalizeBaseUrl(String url) {
  if (url.isEmpty) return url;
  if (url.endsWith('/')) {
    return url.substring(0, url.length - 1);
  }
  return url;
}

/// Base URL for the Node API (driver app). See backend `PORT`, often `4000`.
///
/// **Override at build/run time** (staging/production or physical device on LAN):
/// ```sh
/// flutter run --dart-define=API_BASE_URL=https://api.example.com
/// ```
///
/// **Defaults by platform (local backend on your machine):**
/// - **Android emulator** – `http://10.0.2.2:4000` (maps to the host’s `127.0.0.1`)
/// - **iOS Simulator** – `http://127.0.0.1:4000`
/// - **Web / desktop** – `http://127.0.0.1:4000`
///
/// For a **physical phone**, use your computer’s LAN IP, e.g.
/// `http://192.168.1.5:4000` via `--dart-define=API_BASE_URL=...`.
String get kApiBaseUrl {
  const override = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  if (override.isNotEmpty) {
    return _normalizeBaseUrl(override);
  }
  if (kIsWeb) {
    return 'http://127.0.0.1:4000';
  }
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'http://10.0.2.2:4000';
    case TargetPlatform.iOS:
    case TargetPlatform.macOS:
      return 'http://127.0.0.1:4000';
    case TargetPlatform.linux:
    case TargetPlatform.windows:
    case TargetPlatform.fuchsia:
      return 'http://127.0.0.1:4000';
  }
}
