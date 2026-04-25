import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../core/providers.dart';
import '../../core/rider_api.dart';

class RiderHomePage extends HookConsumerWidget {
  const RiderHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tab = useState(0);
    final session = ref.watch(sessionProvider)!;
    final api = ref.watch(riderApiProvider);
    final pages = <Widget>[
      _OverviewTab(api: api),
      _RidesTab(api: api),
      _ParcelsTab(api: api),
      _PaymentsTab(api: api),
      _MessagesRatingsTab(api: api),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rider Console'),
        actions: <Widget>[
          Center(child: Text('Rider: ${session.phone}', style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 8),
          IconButton(onPressed: () => ref.read(sessionProvider.notifier).signOut(), icon: const Icon(Icons.logout)),
        ],
      ),
      body: pages[tab.value],
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab.value,
        onDestinationSelected: (i) => tab.value = i,
        destinations: const <NavigationDestination>[
          NavigationDestination(icon: Icon(Icons.dashboard), label: 'Overview'),
          NavigationDestination(icon: Icon(Icons.directions_car), label: 'Rides'),
          NavigationDestination(icon: Icon(Icons.inventory_2), label: 'Parcels'),
          NavigationDestination(icon: Icon(Icons.payments), label: 'Payments'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Chat & Ratings'),
        ],
      ),
    );
  }
}

class _OverviewTab extends HookWidget {
  const _OverviewTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getRiderAnalytics(),
        api.listOffers(),
        api.listMyRides(),
        api.listMyParcels(),
      ]),
      const <Object?>[],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snap.hasError) return _ErrorView(error: snap.error);
    final analytics = snap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final offers = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final rides = snap.data?[2] as List<dynamic>? ?? <dynamic>[];
    final parcels = snap.data?[3] as List<dynamic>? ?? <dynamic>[];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            _StatCard(title: 'Total Trips', value: '${analytics['totalTrips'] ?? 0}'),
            _StatCard(title: 'Total Spent', value: '${analytics['totalSpent'] ?? 0}'),
            _StatCard(title: 'Cancelled', value: '${analytics['cancelledTrips'] ?? 0}'),
            _StatCard(title: 'Offers', value: '${offers.length}'),
            _StatCard(title: 'My Rides', value: '${rides.length}'),
            _StatCard(title: 'My Parcels', value: '${parcels.length}'),
          ],
        ),
        const SizedBox(height: 10),
        _JsonPanel(title: 'Active Offers', data: offers),
      ],
    );
  }
}

class _RidesTab extends HookWidget {
  const _RidesTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final pickup = useTextEditingController(text: 'Kathmandu Durbar Square');
    final drop = useTextEditingController(text: 'Boudhanath');
    final cityId = useTextEditingController(text: 'city-kathmandu');
    final vehicleTypeId = useTextEditingController(text: 'cab');
    final distance = useTextEditingController(text: '10');
    final duration = useTextEditingController(text: '25');
    final rideIdController = useTextEditingController();
    final couponCode = useTextEditingController();
    final estimatedFare = useState<double>(0);
    final couponResult = useState<Object?>(null);
    final createResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[api.listVehicleTypes(), api.listMyRides()]),
      <Object?>[refresh.value],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snap.hasError) return _ErrorView(error: snap.error);
    final vehicleTypes = snap.data?[0] as List<dynamic>? ?? <dynamic>[];
    final rides = snap.data?[1] as List<dynamic>? ?? <dynamic>[];

    Future<void> estimate() async {
      error.value = null;
      try {
        final result = await api.estimateRideFare(<String, dynamic>{
          'cityId': cityId.text.trim(),
          'pickup': pickup.text.trim(),
          'dropoff': drop.text.trim(),
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'durationMin': double.tryParse(duration.text.trim()) ?? 0,
          'vehicleTypeId': vehicleTypeId.text.trim(),
        });
        estimatedFare.value = ((result['fare'] ?? 0) as num).toDouble();
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> createRide() async {
      error.value = null;
      try {
        final result = await api.createRide(<String, dynamic>{
          'cityId': cityId.text.trim(),
          'pickup': pickup.text.trim(),
          'dropoff': drop.text.trim(),
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'durationMin': double.tryParse(duration.text.trim()) ?? 0,
          'vehicleTypeId': vehicleTypeId.text.trim(),
        });
        createResult.value = result;
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> validateCoupon() async {
      error.value = null;
      try {
        couponResult.value = await api.validateCoupon(
          code: couponCode.text.trim(),
          fare: estimatedFare.value,
          cityId: cityId.text.trim(),
          rideId: rideIdController.text.trim().isEmpty ? null : rideIdController.text.trim(),
        );
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> applyCoupon() async {
      error.value = null;
      try {
        couponResult.value = await api.applyCoupon(
          code: couponCode.text.trim(),
          rideId: rideIdController.text.trim(),
          fare: estimatedFare.value,
        );
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        _JsonPanel(title: 'Vehicle Types', data: vehicleTypes),
        TextField(controller: cityId, decoration: const InputDecoration(labelText: 'City id')),
        TextField(controller: pickup, decoration: const InputDecoration(labelText: 'Pickup')),
        TextField(controller: drop, decoration: const InputDecoration(labelText: 'Dropoff')),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: distance, decoration: const InputDecoration(labelText: 'Distance km'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: duration, decoration: const InputDecoration(labelText: 'Duration min'))),
          ],
        ),
        TextField(controller: vehicleTypeId, decoration: const InputDecoration(labelText: 'Vehicle type id')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(onPressed: estimate, child: const Text('Estimate Fare')),
            OutlinedButton(onPressed: createRide, child: const Text('Create Ride')),
          ],
        ),
        Text('Estimated fare: ${estimatedFare.value}'),
        const Divider(height: 28),
        const Text('Coupons', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: rideIdController, decoration: const InputDecoration(labelText: 'Ride id (for apply)')),
        TextField(controller: couponCode, decoration: const InputDecoration(labelText: 'Coupon code')),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(onPressed: validateCoupon, child: const Text('Validate Coupon')),
            OutlinedButton(onPressed: applyCoupon, child: const Text('Apply Coupon')),
          ],
        ),
        if (couponResult.value != null) _JsonPanel(title: 'Coupon Result', data: couponResult.value),
        if (createResult.value != null) _JsonPanel(title: 'Create Ride Result', data: createResult.value),
        if (error.value != null) Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        _JsonPanel(title: 'My Rides', data: rides),
      ],
    );
  }
}

class _ParcelsTab extends HookWidget {
  const _ParcelsTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final cityId = useTextEditingController(text: 'city-kathmandu');
    final pickup = useTextEditingController(text: 'Lazimpat');
    final dropoff = useTextEditingController(text: 'Baneshwor');
    final distance = useTextEditingController(text: '8');
    final weight = useTextEditingController(text: '2');
    final senderName = useTextEditingController(text: 'Rider Sender');
    final senderPhone = useTextEditingController(text: '9800000001');
    final receiverName = useTextEditingController(text: 'Receiver');
    final receiverPhone = useTextEditingController(text: '9800000999');
    final receiverEmail = useTextEditingController(text: 'receiver@example.com');
    final receiverAddress = useTextEditingController(text: 'Maitighar');
    final parcelId = useTextEditingController();
    final otp = useTextEditingController();
    final status = useTextEditingController(text: 'picked_up');
    final estimateResult = useState<Object?>(null);
    final createResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final future = useMemoized(() => api.listMyParcels(), <Object?>[refresh.value]);
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snap.hasError) return _ErrorView(error: snap.error);
    final parcels = snap.data ?? <dynamic>[];

    Future<void> estimateParcel() async {
      error.value = null;
      try {
        estimateResult.value = await api.estimateParcelFare(<String, dynamic>{
          'cityId': cityId.text.trim(),
          'pickup': pickup.text.trim(),
          'dropoff': dropoff.text.trim(),
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'weightKg': double.tryParse(weight.text.trim()) ?? 0,
        });
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> createParcel() async {
      error.value = null;
      try {
        createResult.value = await api.createParcel(<String, dynamic>{
          'cityId': cityId.text.trim(),
          'pickup': pickup.text.trim(),
          'dropoff': dropoff.text.trim(),
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'weightKg': double.tryParse(weight.text.trim()) ?? 0,
          'senderName': senderName.text.trim(),
          'senderPhone': senderPhone.text.trim(),
          'receiverName': receiverName.text.trim(),
          'receiverPhone': receiverPhone.text.trim(),
          'receiverEmail': receiverEmail.text.trim(),
          'receiverAddress': receiverAddress.text.trim(),
        });
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> updateStatus() async {
      error.value = null;
      try {
        createResult.value = await api.updateParcelStatus(
          parcelId.text.trim(),
          status.text.trim(),
          otp: otp.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        TextField(controller: cityId, decoration: const InputDecoration(labelText: 'City id')),
        TextField(controller: pickup, decoration: const InputDecoration(labelText: 'Pickup')),
        TextField(controller: dropoff, decoration: const InputDecoration(labelText: 'Dropoff')),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: distance, decoration: const InputDecoration(labelText: 'Distance km'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: weight, decoration: const InputDecoration(labelText: 'Weight kg'))),
          ],
        ),
        TextField(controller: senderName, decoration: const InputDecoration(labelText: 'Sender name')),
        TextField(controller: senderPhone, decoration: const InputDecoration(labelText: 'Sender phone')),
        TextField(controller: receiverName, decoration: const InputDecoration(labelText: 'Receiver name')),
        TextField(controller: receiverPhone, decoration: const InputDecoration(labelText: 'Receiver phone')),
        TextField(controller: receiverEmail, decoration: const InputDecoration(labelText: 'Receiver email')),
        TextField(controller: receiverAddress, decoration: const InputDecoration(labelText: 'Receiver address')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(onPressed: estimateParcel, child: const Text('Estimate Parcel Fare')),
            OutlinedButton(onPressed: createParcel, child: const Text('Create Parcel')),
          ],
        ),
        const Divider(height: 24),
        const Text('Parcel Status / OTP', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: parcelId, decoration: const InputDecoration(labelText: 'Parcel id')),
        TextField(controller: status, decoration: const InputDecoration(labelText: 'Status (picked_up/delivered/...)')),
        TextField(controller: otp, decoration: const InputDecoration(labelText: 'OTP (for pickup/drop)')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: updateStatus, child: const Text('Update Parcel Status')),
        if (estimateResult.value != null) _JsonPanel(title: 'Parcel Estimate', data: estimateResult.value),
        if (createResult.value != null) _JsonPanel(title: 'Parcel Action Result', data: createResult.value),
        if (error.value != null) Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        _JsonPanel(title: 'My Parcels', data: parcels),
      ],
    );
  }
}

class _PaymentsTab extends HookWidget {
  const _PaymentsTab({required this.api});
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
        _JsonPanel(title: 'Payment Methods (Rider)', data: methods.value),
        TextField(controller: rideId, decoration: const InputDecoration(labelText: 'Ride id')),
        TextField(controller: method, decoration: const InputDecoration(labelText: 'Method code')),
        TextField(controller: provider, decoration: const InputDecoration(labelText: 'Provider')),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: amount, decoration: const InputDecoration(labelText: 'Amount'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: currency, decoration: const InputDecoration(labelText: 'Currency'))),
          ],
        ),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: createIntent, child: const Text('Create Payment Intent')),
        const Divider(height: 24),
        TextField(controller: paymentId, decoration: const InputDecoration(labelText: 'Payment id')),
        OutlinedButton(onPressed: loadTimeline, child: const Text('Load Payment Timeline')),
        if (result.value != null) _JsonPanel(title: 'Payment Result', data: result.value),
        _JsonPanel(title: 'Payment Timeline', data: timeline.value),
        if (error.value != null) Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}

class _MessagesRatingsTab extends HookConsumerWidget {
  const _MessagesRatingsTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final participant = useTextEditingController();
    final content = useTextEditingController();
    final search = useTextEditingController();
    final conversationId = useState<String?>(null);
    final live = useState<List<dynamic>>(<dynamic>[]);
    final targetUser = useTextEditingController();
    final rideId = useTextEditingController();
    final score = useTextEditingController(text: '5');
    final comment = useTextEditingController();
    final lookupUser = useTextEditingController();
    final lookupResult = useState<Object?>(null);
    final ratingResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);
    useListenable(search);

    final socket = ref.watch(socketProvider);
    useEffect(() {
      void onMessage(dynamic payload) {
        live.value = <dynamic>[...live.value, payload];
      }

      socket?.on('message:new', onMessage);
      return () => socket?.off('message:new', onMessage);
    }, <Object?>[socket]);

    final convFuture = useMemoized(() => api.listConversations(), <Object?>[refresh.value]);
    final convSnap = useFuture(convFuture);
    final conversations = (convSnap.data ?? <dynamic>[]).where((dynamic e) {
      final q = search.text.trim().toLowerCase();
      if (q.isEmpty) return true;
      final m = Map<String, dynamic>.from(e as Map);
      return '${m['id']} ${m['participantAId']} ${m['participantBId']} ${m['rideId']}'.toLowerCase().contains(q);
    }).toList();

    final msgFuture = useMemoized(() {
      final id = conversationId.value;
      if (id == null || id.isEmpty) return Future<List<dynamic>>.value(<dynamic>[]);
      return api.listMessages(id);
    }, <Object?>[conversationId.value, refresh.value]);
    final msgSnap = useFuture(msgFuture);

    final ratingsFuture = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[api.getMyRatingSummary(), api.listMyRatings()]),
      <Object?>[refresh.value],
    );
    final ratingsSnap = useFuture(ratingsFuture);

    Future<void> startConversation() async {
      if (participant.text.trim().isEmpty) return;
      final convo = await api.startConversation(participantUserId: participant.text.trim(), rideId: rideId.text.trim().isEmpty ? null : rideId.text.trim());
      final id = (convo['id'] ?? '').toString();
      if (id.isNotEmpty) {
        conversationId.value = id;
        socket?.emit('conversation:join', <String, dynamic>{'conversationId': id});
      }
      refresh.value++;
    }

    Future<void> sendMessage() async {
      final id = conversationId.value;
      if (id == null || id.isEmpty || content.text.trim().isEmpty) return;
      await api.sendMessage(id, content.text.trim());
      content.clear();
      refresh.value++;
    }

    Future<void> submitRating() async {
      error.value = null;
      try {
        ratingResult.value = await api.createRating(
          rideId: rideId.text.trim(),
          toUserId: targetUser.text.trim(),
          score: int.tryParse(score.text.trim()) ?? 5,
          comment: comment.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> lookupRating() async {
      error.value = null;
      try {
        lookupResult.value = await api.getUserRatingSummary(lookupUser.text.trim());
      } catch (e) {
        error.value = e.toString();
      }
    }

    final mySummary = ratingsSnap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final myRatings = ratingsSnap.data?[1] as List<dynamic>? ?? <dynamic>[];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Text('Socket: ${socket?.connected == true ? 'connected' : 'disconnected'}'),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: participant, decoration: const InputDecoration(labelText: 'Participant user id'))),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: startConversation, child: const Text('Start')),
          ],
        ),
        TextField(controller: search, decoration: const InputDecoration(labelText: 'Search conversations')),
        if (convSnap.hasData)
          DropdownButton<String>(
            value: conversationId.value,
            hint: const Text('Select conversation'),
            isExpanded: true,
            items: conversations.map((dynamic e) {
              final m = Map<String, dynamic>.from(e as Map);
              final id = m['id'].toString();
              return DropdownMenuItem<String>(value: id, child: Text('$id (${m['participantAId']} ↔ ${m['participantBId']})'));
            }).toList(),
            onChanged: (v) {
              conversationId.value = v;
              if (v != null) {
                socket?.emit('conversation:join', <String, dynamic>{'conversationId': v});
              }
            },
          ),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: content, decoration: const InputDecoration(labelText: 'Message'))),
            IconButton(onPressed: sendMessage, icon: const Icon(Icons.send)),
          ],
        ),
        _JsonPanel(title: 'Messages', data: msgSnap.data ?? <dynamic>[]),
        _JsonPanel(title: 'Live Message Stream', data: live.value),
        const Divider(height: 28),
        _JsonPanel(title: 'My Rating Summary', data: mySummary),
        _JsonPanel(title: 'My Ratings', data: myRatings),
        const Text('Rate Driver', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: rideId, decoration: const InputDecoration(labelText: 'Ride id')),
        TextField(controller: targetUser, decoration: const InputDecoration(labelText: 'Driver user id')),
        TextField(controller: score, decoration: const InputDecoration(labelText: 'Score (1-5)')),
        TextField(controller: comment, decoration: const InputDecoration(labelText: 'Comment')),
        ElevatedButton(onPressed: submitRating, child: const Text('Submit Rating')),
        if (ratingResult.value != null) _JsonPanel(title: 'Rating Submit Result', data: ratingResult.value),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: lookupUser, decoration: const InputDecoration(labelText: 'Driver user id for summary'))),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: lookupRating, child: const Text('Lookup')),
          ],
        ),
        if (lookupResult.value != null) _JsonPanel(title: 'Driver Summary', data: lookupResult.value),
        if (error.value != null) Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.title, required this.value});
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 165,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Text(value, style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
        ),
      ),
    );
  }
}

class _JsonPanel extends StatelessWidget {
  const _JsonPanel({required this.title, required this.data});
  final String title;
  final Object? data;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SelectableText(
              const JsonEncoder.withIndent('  ').convert(data),
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error});
  final Object? error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          error?.toString() ?? 'Unknown error',
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      ),
    );
  }
}
