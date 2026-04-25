import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'config.dart';
import 'rider_api.dart';

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
  SessionNotifier(this._api) : super(null);
  final RiderApi _api;

  void _applyAuthResult(Map<String, dynamic> result, String fallbackPhone) {
    final token = (result['accessToken'] ?? '').toString();
    final user = Map<String, dynamic>.from((result['user'] ?? <String, dynamic>{}) as Map);
    final userId = (user['id'] ?? '').toString();
    if (token.isEmpty || userId.isEmpty) throw Exception('Invalid auth response');
    _api.accessToken = token;
    state = RiderSession(accessToken: token, userId: userId, phone: (user['phone'] ?? fallbackPhone).toString());
  }

  Future<void> signIn({
    required String phone,
    required String password,
  }) async {
    final result = await _api.signIn(phone: phone, password: password);
    _applyAuthResult(result, phone);
  }

  Future<void> register({
    required String phone,
    required String password,
    String? email,
  }) async {
    final result = await _api.register(phone: phone, password: password, email: email);
    _applyAuthResult(result, phone);
  }

  void signOut() {
    _api.accessToken = null;
    state = null;
  }
}

final riderApiProvider = Provider<RiderApi>((ref) => RiderApi(baseUrl: kApiBaseUrl));

final sessionProvider = StateNotifierProvider<SessionNotifier, RiderSession?>((ref) {
  return SessionNotifier(ref.watch(riderApiProvider));
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

final notificationCenterProvider = StateNotifierProvider<NotificationCenterNotifier, List<AppNotification>>((ref) {
  return NotificationCenterNotifier();
});

final unreadNotificationCountProvider = Provider<int>((ref) {
  return ref.watch(notificationCenterProvider).where((n) => !n.read).length;
});

