import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../core/providers.dart';
import '../features/auth/rider_signin_page.dart';
import '../features/home/rider_home_page.dart';
import '../features/home/rider_push_binding.dart';

class RiderApp extends ConsumerWidget {
  const RiderApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return MaterialApp(
      title: 'Rider App',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.green),
      home: session == null
          ? const RiderSignInPage()
          : const RiderPushBinding(child: RiderHomePage()),
    );
  }
}
