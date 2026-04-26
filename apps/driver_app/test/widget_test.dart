import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:driver_app/app/driver_app.dart';
import 'package:driver_app/core/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('driver app boots', (tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const DriverApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Driver'), findsWidgets);
  });
}
