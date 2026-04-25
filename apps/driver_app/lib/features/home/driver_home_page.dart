import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

final onlineProvider = StateProvider<bool>((ref) => false);

class DriverHomePage extends HookConsumerWidget {
  const DriverHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(onlineProvider);
    final pulse = useState(0);

    return Scaffold(
      appBar: AppBar(title: const Text('Driver Dashboard')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SwitchListTile(
              value: online,
              title: const Text('Go Online'),
              onChanged: (value) => ref.read(onlineProvider.notifier).state = value,
            ),
            ElevatedButton(
              onPressed: () => pulse.value += 1,
              child: const Text('Send Location Ping'),
            ),
            const SizedBox(height: 8),
            Text('Pings sent: ${pulse.value}')
          ],
        ),
      ),
    );
  }
}
