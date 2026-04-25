import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:admin_app/app/admin_app.dart';

void main() {
  testWidgets('admin app boots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AdminApp()));
    expect(find.text('Admin Dashboard'), findsOneWidget);
  });
}
