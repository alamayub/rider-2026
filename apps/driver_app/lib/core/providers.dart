import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'config.dart';
import 'driver_api.dart';

class DriverSession {
  const DriverSession({
    required this.accessToken,
    required this.userId,
    required this.phone,
  });

  final String accessToken;
  final String userId;
  final String phone;
}

class SessionNotifier extends StateNotifier<DriverSession?> {
  SessionNotifier(this._api) : super(null);
  final DriverApi _api;

  Future<void> signIn({
    required String phone,
    required String password,
  }) async {
    final result = await _api.signIn(phone: phone, password: password);
    final token = (result['accessToken'] ?? '').toString();
    final user = Map<String, dynamic>.from((result['user'] ?? <String, dynamic>{}) as Map);
    final userId = (user['id'] ?? '').toString();
    if (token.isEmpty || userId.isEmpty) throw Exception('Invalid sign in response');
    _api.accessToken = token;
    state = DriverSession(
      accessToken: token,
      userId: userId,
      phone: (user['phone'] ?? phone).toString(),
    );
  }

  void signOut() {
    _api.accessToken = null;
    state = null;
  }
}

final driverApiProvider = Provider<DriverApi>((ref) => DriverApi(baseUrl: kApiBaseUrl));

final sessionProvider = StateNotifierProvider<SessionNotifier, DriverSession?>((ref) {
  return SessionNotifier(ref.watch(driverApiProvider));
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

