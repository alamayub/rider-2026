import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:rider_app/app/rider_app.dart';

void main() {
  testWidgets('rider app boots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: RiderApp()));
    expect(find.text('Rider Dashboard'), findsOneWidget);
  });
}
