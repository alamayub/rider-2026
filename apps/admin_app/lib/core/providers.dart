import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'admin_api.dart';
import 'config.dart';

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

