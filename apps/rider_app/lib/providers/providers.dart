import 'dart:async';

import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/config.dart';
import '../services/rider_api.dart';

/// Injected from [main] via [ProviderScope.overrides].
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw StateError(
    'Override sharedPreferencesProvider in main() after SharedPreferences.getInstance().',
  );
});

class AppNotification {
  const AppNotification({
    required this.title,
    required this.body,
    required this.createdAt,
    this.type = 'info',
    this.payload,
    this.read = false,
  });

  final String title;
  final String body;
  final DateTime createdAt;
  final String type;
  final Object? payload;
  final bool read;

  AppNotification copyWith({bool? read}) {
    return AppNotification(
      title: title,
      body: body,
      createdAt: createdAt,
      type: type,
      payload: payload,
      read: read ?? this.read,
    );
  }
}

class NotificationCenterNotifier extends StateNotifier<List<AppNotification>> {
  NotificationCenterNotifier() : super(const <AppNotification>[]);

  void push({
    required String title,
    required String body,
    String type = 'info',
    Object? payload,
  }) {
    state = <AppNotification>[
      AppNotification(
        title: title,
        body: body,
        type: type,
        payload: payload,
        createdAt: DateTime.now(),
      ),
      ...state,
    ];
  }

  void markAllRead() {
    state = state.map((n) => n.copyWith(read: true)).toList();
  }

  void clear() {
    state = const <AppNotification>[];
  }
}

class RiderSession {
  const RiderSession({
    required this.accessToken,
    required this.userId,
    required this.phone,
  });

  final String accessToken;
  final String userId;
  final String phone;
}

class SessionNotifier extends StateNotifier<RiderSession?> {
  SessionNotifier(this._api, this._prefs) : super(null) {
    _api.onUnauthorized = signOut;
    _restoreSession();
  }

  final RiderApi _api;
  final SharedPreferences _prefs;

  static const String _kAccessToken = 'rider_session_access_token';
  static const String _kUserId = 'rider_session_user_id';
  static const String _kPhone = 'rider_session_phone';

  void _restoreSession() {
    final token = (_prefs.getString(_kAccessToken) ?? '').trim();
    final userId = (_prefs.getString(_kUserId) ?? '').trim();
    final phone = (_prefs.getString(_kPhone) ?? '').trim();
    if (token.isEmpty || userId.isEmpty) return;
    _api.accessToken = token;
    state = RiderSession(
      accessToken: token,
      userId: userId,
      phone: phone.isEmpty ? userId : phone,
    );
  }

  void _persistSession(RiderSession session) {
    unawaited(_prefs.setString(_kAccessToken, session.accessToken));
    unawaited(_prefs.setString(_kUserId, session.userId));
    unawaited(_prefs.setString(_kPhone, session.phone));
  }

  void _clearPersistedSession() {
    unawaited(_prefs.remove(_kAccessToken));
    unawaited(_prefs.remove(_kUserId));
    unawaited(_prefs.remove(_kPhone));
  }

  void _applyAuthResult(Map<String, dynamic> result, String fallbackPhone) {
    final token = (result['accessToken'] ?? '').toString();
    final user = Map<String, dynamic>.from(
        (result['user'] ?? <String, dynamic>{}) as Map);
    final userId = (user['id'] ?? '').toString();
    if (token.isEmpty || userId.isEmpty) {
      throw Exception('Invalid auth response');
    }
    _api.accessToken = token;
    final session = RiderSession(
        accessToken: token,
        userId: userId,
        phone: (user['phone'] ?? fallbackPhone).toString());
    state = session;
    _persistSession(session);
  }

  Future<void> signIn({
    required String phone,
    String? password,
    String? otp,
  }) async {
    final result =
        await _api.signIn(phone: phone, password: password, otp: otp);
    _applyAuthResult(result, phone);
  }

  Future<void> register({
    required String phone,
    required String password,
    String? email,
  }) async {
    final result =
        await _api.register(phone: phone, password: password, email: email);
    _applyAuthResult(result, phone);
  }

  void signOut() {
    _api.accessToken = null;
    state = null;
    _clearPersistedSession();
  }
}

const int _riderHomeTabMax = 6;

class RiderHomeTabNotifier extends StateNotifier<int> {
  RiderHomeTabNotifier(this._prefs)
      : super(_clampHomeTab(_prefs.getInt(_kRiderHomeTab) ?? 0, _riderHomeTabMax));

  final SharedPreferences _prefs;
  static const String _kRiderHomeTab = 'rider_home_tab';

  static int _clampHomeTab(int index, int max) {
    if (index < 0) return 0;
    if (index > max) return max;
    return index;
  }

  void setTab(int index) {
    final next = _clampHomeTab(index, _riderHomeTabMax);
    state = next;
    unawaited(_prefs.setInt(_kRiderHomeTab, next));
  }
}

final riderHomeTabProvider =
    StateNotifierProvider<RiderHomeTabNotifier, int>((ref) {
  return RiderHomeTabNotifier(ref.watch(sharedPreferencesProvider));
});

final riderApiProvider =
    Provider<RiderApi>((ref) => RiderApi(baseUrl: kApiBaseUrl));

final sessionProvider =
    StateNotifierProvider<SessionNotifier, RiderSession?>((ref) {
  return SessionNotifier(
    ref.watch(riderApiProvider),
    ref.watch(sharedPreferencesProvider),
  );
});

final socketProvider = Provider<io.Socket?>((ref) {
  final session = ref.watch(sessionProvider);
  if (session == null) return null;
  final socket = io.io(
    kApiBaseUrl,
    io.OptionBuilder()
        .setTransports(<String>['websocket'])
        .disableAutoConnect()
        .setAuth(<String, dynamic>{'token': 'Bearer ${session.accessToken}'})
        .build(),
  );
  socket.connect();
  ref.onDispose(socket.dispose);
  return socket;
});

final notificationCenterProvider =
    StateNotifierProvider<NotificationCenterNotifier, List<AppNotification>>(
        (ref) {
  return NotificationCenterNotifier();
});

final unreadNotificationCountProvider = Provider<int>((ref) {
  return ref.watch(notificationCenterProvider).where((n) => !n.read).length;
});
