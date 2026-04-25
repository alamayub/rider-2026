import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketClient {
  SocketClient(String url)
      : _socket = io.io(
          url,
          io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().build(),
        );

  final io.Socket _socket;

  void connect() => _socket.connect();
  void emit(String event, dynamic data) => _socket.emit(event, data);
  void on(String event, Function(dynamic) handler) => _socket.on(event, handler);
}
