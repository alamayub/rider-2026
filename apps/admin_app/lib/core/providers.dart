import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'admin_api.dart';
import 'config.dart';

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

class AdminSession {
  const AdminSession({
    required this.accessToken,
    required this.userId,
    required this.phone,
  });

  final String accessToken;
  final String userId;
  final String phone;
}

class SessionNotifier extends StateNotifier<AdminSession?> {
  SessionNotifier(this._api) : super(null);

  final AdminApi _api;

  Future<void> signIn({
    required String phone,
    required String password,
  }) async {
    final result = await _api.signIn(phone: phone, password: password);
    final token = (result['accessToken'] ?? '') as String;
    final user = Map<String, dynamic>.from((result['user'] ?? <String, dynamic>{}) as Map);
    if (token.isEmpty || (user['id'] ?? '').toString().isEmpty) {
      throw Exception('Invalid sign in response');
    }
    _api.accessToken = token;
    state = AdminSession(
      accessToken: token,
      userId: user['id'].toString(),
      phone: (user['phone'] ?? phone).toString(),
    );
  }

  void signOut() {
    _api.accessToken = null;
    state = null;
  }
}

final adminApiProvider = Provider<AdminApi>((ref) => AdminApi(baseUrl: kApiBaseUrl));

final sessionProvider = StateNotifierProvider<SessionNotifier, AdminSession?>((ref) {
  return SessionNotifier(ref.watch(adminApiProvider));
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

