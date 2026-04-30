import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../core/rider_api.dart';
import '../widgets/console_widgets.dart';

class RiderPaymentsTab extends HookWidget {
  const RiderPaymentsTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final methods = useState<List<dynamic>>(<dynamic>[]);
    final rideId = useTextEditingController();
    final method = useTextEditingController(text: 'esewa_wallet');
    final provider = useTextEditingController(text: 'esewa');
    final amount = useTextEditingController(text: '200');
    final currency = useTextEditingController(text: 'NPR');
    final paymentId = useTextEditingController();
    final result = useState<Object?>(null);
    final timeline = useState<List<dynamic>>(<dynamic>[]);
    final error = useState<String?>(null);

    useEffect(() {
      () async {
        try {
          methods.value = await api.listPaymentMethods(app: 'rider');
        } catch (_) {
          // Keep methods empty if loading fails.
        }
      }();
      return null;
    }, const <Object?>[]);

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
        result.value = res;
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
        timeline.value = await api.paymentTimeline(paymentId.text.trim());
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        RiderJsonPanel(title: 'Payment Methods (Rider)', data: methods.value),
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
        if (result.value != null)
          RiderJsonPanel(title: 'Payment Result', data: result.value),
        RiderJsonPanel(title: 'Payment Timeline', data: timeline.value),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}
