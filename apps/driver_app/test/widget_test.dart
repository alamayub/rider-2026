import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:driver_app/app/driver_app.dart';

void main() {
  testWidgets('driver app boots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: DriverApp()));
    expect(find.text('Driver Dashboard'), findsOneWidget);
  });
}
