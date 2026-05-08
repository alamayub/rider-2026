import 'dart:async';

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'config/firebase_options.dart';
import 'providers/providers.dart';
import 'services/local_notifications.dart';
import 'widgets/rider_app.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await LocalNotificationsService.showFromRemoteMessage(message);
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  // Must be registered exactly once, before runApp (not from a widget).
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(
    ProviderScope(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const RiderApp(),
    ),
  );
  // Keep startup frame light; initialize plugin after first app frame.
  unawaited(LocalNotificationsService.initialize());
}
