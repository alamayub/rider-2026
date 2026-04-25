import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

final cityProvider = StateProvider<String>((ref) => 'City One');

class AdminHomePage extends HookConsumerWidget {
  const AdminHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedCity = ref.watch(cityProvider);
    final refreshCount = useState(0);

    return Scaffold(
      appBar: AppBar(title: const Text('Admin Dashboard')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButton<String>(
              value: selectedCity,
              items: const [
                DropdownMenuItem(value: 'City One', child: Text('City One')),
                DropdownMenuItem(value: 'City Two', child: Text('City Two')),
              ],
              onChanged: (value) {
                if (value != null) {
                  ref.read(cityProvider.notifier).state = value;
                }
              },
            ),
            ElevatedButton(
              onPressed: () => refreshCount.value += 1,
              child: const Text('Refresh Live Trips'),
            ),
            const SizedBox(height: 8),
            Text('Dashboard refresh count: ${refreshCount.value}')
          ],
        ),
      ),
    );
  }
}
