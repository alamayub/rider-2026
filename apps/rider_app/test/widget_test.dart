import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:rider_app/app/rider_app.dart';
import 'package:rider_app/core/providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('rider app boots', (tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const RiderApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Rider'), findsWidgets);
  });
}
