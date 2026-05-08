import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../config/enums.dart';
import '../../providers/providers.dart';
import '../../services/local_notifications.dart';
import '../../services/rider_api.dart';

/// Foreground FCM + local notification routing. Lives above [RiderHomePage] so
/// Firebase Messaging is not wired from multiple widgets.
///
/// [FirebaseMessaging.onBackgroundMessage] is registered only in `main.dart`.
class RiderPushBinding extends HookConsumerWidget {
  const RiderPushBinding({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final RiderSession? session = ref.watch(sessionProvider);

    useEffect(() {
      if (session == null) return null;

      Future<void> registerTokenWithBackend(
        RiderApi api,
        String token, {
        bool refreshed = false,
      }) async {
        if (token.isEmpty) return;
        void notify(
            {required String title, required String body, Object? payload}) {
          try {
            ref.read(notificationCenterProvider.notifier).push(
                  title: title,
                  body: body,
                  type: 'fcm',
                  payload: payload,
                );
          } catch (_) {
            // Widget may be unmounted; avoid secondary crashes.
          }
        }

        try {
          final DeviceTokenRegistrationResult r = await api.registerDeviceToken(
            app: 'rider',
            platform: Platform.isIOS ? 'ios' : 'android',
            token: token,
          );
          switch (r) {
            case DeviceTokenRegistrationResult.success:
              notify(
                title: refreshed ? 'FCM token updated' : 'FCM Ready',
                body: 'Device token registered to backend',
                payload: token,
              );
            case DeviceTokenRegistrationResult.unauthorized:
              notify(
                title: 'Push token not saved',
                body:
                    'Session expired or invalid. Sign out and sign in again to register this device for push.',
              );
            case DeviceTokenRegistrationResult.rejected:
              notify(
                title: 'Push token sync failed',
                body: 'The server did not accept the device token.',
              );
            case DeviceTokenRegistrationResult.networkError:
              notify(
                title: 'Push token sync skipped',
                body:
                    'Network error. Try again when online; token refresh will retry.',
              );
          }
        } catch (e) {
          notify(
            title: 'Push token sync failed',
            body: e.toString(),
          );
        }
      }

      Future<void> bootstrapFcm() async {
        final RiderApi api = ref.read(riderApiProvider);
        try {
          final FirebaseMessaging messaging = FirebaseMessaging.instance;
          await messaging.requestPermission(
            alert: true,
            badge: true,
            sound: true,
          );
          final String? token = await messaging.getToken();
          if (token != null && token.isNotEmpty) {
            await registerTokenWithBackend(api, token);
          }
        } catch (e, st) {
          assert(() {
            debugPrint('FCM bootstrap error: $e\n$st');
            return true;
          }());
        }
      }

      unawaited(bootstrapFcm());

      final StreamSubscription<String> tokenRefreshSub =
          FirebaseMessaging.instance.onTokenRefresh.listen((String nextToken) {
        if (nextToken.isEmpty) return;
        final RiderApi api = ref.read(riderApiProvider);
        unawaited(registerTokenWithBackend(api, nextToken, refreshed: true));
      });

      final StreamSubscription<RemoteMessage> subMessage =
          FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final RiderApi liveApi = ref.read(riderApiProvider);
        final title = message.notification?.title ?? 'Push notification';
        final body = message.notification?.body ??
            (message.data.isEmpty ? 'No body' : message.data.toString());
        LocalNotificationsService.showFromRemoteMessage(message);
        final notificationId =
            (message.data['notificationId'] ?? '').toString();
        if (notificationId.isNotEmpty) {
          () async {
            try {
              await liveApi.markNotificationReceived(notificationId);
              await liveApi.markNotificationDelivered(notificationId);
            } catch (_) {
              // best-effort ack
            }
          }();
        }
        ref.read(notificationCenterProvider.notifier).push(
              title: title,
              body: body,
              type: 'push',
              payload: message.data,
            );
      });

      final StreamSubscription<RemoteMessage> subOpen =
          FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final RiderApi liveApi = ref.read(riderApiProvider);
        final title = message.notification?.title ?? 'Opened from notification';
        final body = message.notification?.body ?? 'Notification tap event';
        final notificationId =
            (message.data['notificationId'] ?? '').toString();
        if (notificationId.isNotEmpty) {
          () async {
            try {
              await liveApi.markNotificationRead(notificationId);
            } catch (_) {
              // best-effort ack
            }
          }();
        }
        ref.read(notificationCenterProvider.notifier).push(
              title: title,
              body: body,
              type: 'push-open',
              payload: message.data,
            );
      });

      return () {
        subMessage.cancel();
        subOpen.cancel();
        tokenRefreshSub.cancel();
      };
    }, <Object?>[session?.accessToken]);

    useEffect(() {
      final StreamSubscription<Map<String, dynamic>> sub =
          LocalNotificationsService.onNotificationTap.listen((payload) {
        final type = (payload['type'] ?? payload['eventType'] ?? '')
            .toString()
            .toLowerCase();
        final keys = payload.keys.map((k) => k.toLowerCase()).toSet();
        final valuesJoined =
            payload.values.map((v) => v.toString().toLowerCase()).join(' ');

        final tabs = ref.read(riderHomeTabProvider.notifier);
        if (type == 'message' || type == 'chat' || type == 'push-message') {
          tabs.setTab(4);
        } else if (type == 'parcel' || type == 'delivery') {
          tabs.setTab(2);
        } else if (type == 'payment' || type == 'refund') {
          tabs.setTab(3);
        } else if (type == 'ride' || type == 'trip') {
          tabs.setTab(1);
        } else if (type == 'rating' || type == 'review') {
          tabs.setTab(5);
        } else if (keys.contains('conversationid') ||
            keys.contains('messageid') ||
            valuesJoined.contains('message')) {
          tabs.setTab(4);
        } else if (keys.contains('parcelid') ||
            valuesJoined.contains('parcel')) {
          tabs.setTab(2);
        } else if (keys.contains('paymentid') ||
            valuesJoined.contains('payment')) {
          tabs.setTab(3);
        } else if (keys.contains('rideid') || valuesJoined.contains('ride')) {
          tabs.setTab(1);
        } else if (valuesJoined.contains('rating')) {
          tabs.setTab(5);
        } else {
          tabs.setTab(0);
        }
      });
      return sub.cancel;
    }, const <Object?>[]);

    return child;
  }
}
