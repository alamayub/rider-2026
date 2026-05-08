import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../services/rider_api.dart';

class RiderPaymentsTab extends HookWidget {
  const RiderPaymentsTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final rideId = useTextEditingController();
    final method = useTextEditingController(text: 'esewa_wallet');
    final provider = useTextEditingController(text: 'esewa');
    final amount = useTextEditingController(text: '200');
    final currency = useTextEditingController(text: 'NPR');
    final paymentId = useTextEditingController();
    final error = useState<String?>(null);

    Future<void> createIntent() async {
      error.value = null;
      try {
        final res = await api.createPaymentIntent(<String, dynamic>{
          'rideId': rideId.text.trim(),
          'method': method.text.trim(),
          'provider': provider.text.trim(),
          'amount': double.tryParse(amount.text.trim()) ?? 0,
          'currency': currency.text.trim(),
        });
        if ((res['id'] ?? '').toString().isNotEmpty) {
          paymentId.text = res['id'].toString();
        }
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> loadTimeline() async {
      error.value = null;
      try {
        await api.paymentTimeline(paymentId.text.trim());
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        TextField(
            controller: rideId,
            decoration: const InputDecoration(labelText: 'Ride id')),
        TextField(
            controller: method,
            decoration: const InputDecoration(labelText: 'Method code')),
        TextField(
            controller: provider,
            decoration: const InputDecoration(labelText: 'Provider')),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: amount,
                    decoration: const InputDecoration(labelText: 'Amount'))),
            const SizedBox(width: 8),
            Expanded(
                child: TextField(
                    controller: currency,
                    decoration: const InputDecoration(labelText: 'Currency'))),
          ],
        ),
        const SizedBox(height: 8),
        ElevatedButton(
            onPressed: createIntent,
            child: const Text('Create Payment Intent')),
        const Divider(height: 24),
        TextField(
            controller: paymentId,
            decoration: const InputDecoration(labelText: 'Payment id')),
        OutlinedButton(
            onPressed: loadTimeline,
            child: const Text('Load Payment Timeline')),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}
