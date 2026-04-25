import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

final pickupProvider = StateProvider<String>((ref) => 'MG Road');

class RiderHomePage extends HookConsumerWidget {
  const RiderHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pickup = ref.watch(pickupProvider);
    final controller = useTextEditingController(text: pickup);

    return Scaffold(
      appBar: AppBar(title: const Text('Rider Dashboard')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Pickup'),
              onChanged: (value) => ref.read(pickupProvider.notifier).state = value,
            ),
            const SizedBox(height: 12),
            Text('Current pickup: $pickup'),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: () {}, child: const Text('Find Ride'))
          ],
        ),
      ),
    );
  }
}
