import 'dart:convert';
import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class LocalNotificationsService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;
  static final StreamController<Map<String, dynamic>> _tapController =
      StreamController<Map<String, dynamic>>.broadcast();

  static Stream<Map<String, dynamic>> get onNotificationTap =>
      _tapController.stream;

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'rider_app_notifications',
    'Rider Notifications',
    description: 'General rider app notifications',
    importance: Importance.high,
  );

  static Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings =
        InitializationSettings(android: androidSettings, iOS: iosSettings);
    await _plugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final decoded = jsonDecode(payload);
          if (decoded is Map<String, dynamic>) {
            _tapController.add(decoded);
          } else if (decoded is Map) {
            _tapController.add(decoded.cast<String, dynamic>());
          }
        } catch (_) {
          _tapController.add(<String, dynamic>{'raw': payload});
        }
      },
    );

    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_channel);
    await androidPlugin?.requestNotificationsPermission();

    final iosPlugin = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    await iosPlugin?.requestPermissions(alert: true, badge: true, sound: true);

    _initialized = true;
  }

  static Future<void> show({
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) async {
    await initialize();
    await _plugin.show(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'rider_app_notifications',
          'Rider Notifications',
          channelDescription: 'General rider app notifications',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: data == null ? null : jsonEncode(data),
    );
  }

  static Future<void> showFromRemoteMessage(RemoteMessage message) async {
    final title = message.notification?.title ?? 'Rider notification';
    final body = message.notification?.body ??
        (message.data.isEmpty ? 'New update' : message.data.toString());
    await show(title: title, body: body, data: message.data);
  }
}
