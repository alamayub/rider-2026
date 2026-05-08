import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../providers/providers.dart';
import '../screens/auth/rider_signin_page.dart';
import '../screens/home/rider_home_page.dart';
import '../screens/home/rider_push_binding.dart';

class RiderApp extends ConsumerWidget {
  const RiderApp({super.key});

  static ThemeData _buildTheme() {
    final ThemeData base = ThemeData(
      useMaterial3: true,
      colorSchemeSeed: Colors.deepPurple,
    );
    final ColorScheme scheme = base.colorScheme;
    const BorderRadius radius = BorderRadius.all(Radius.circular(8));
    return base.copyWith(
      inputDecorationTheme: InputDecorationTheme(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        border: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: scheme.primary),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(
            color: scheme.onSurface.withValues(alpha: 0.12),
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: scheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return MaterialApp(
      title: 'Rider App',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      home: session == null
          ? const RiderSignInPage()
          : const RiderPushBinding(child: RiderHomePage()),
    );
  }
}
