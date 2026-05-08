import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../providers/providers.dart';
import '../screens/auth/driver_signin_page.dart';
import '../screens/home/driver_home_page.dart';

class DriverApp extends ConsumerWidget {
  const DriverApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return MaterialApp(
      title: 'Driver App',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.blue),
      home: session == null ? const DriverSignInPage() : const DriverHomePage(),
    );
  }
}
