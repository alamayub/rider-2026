import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../core/booking_payloads.dart';
import '../../core/local_notifications.dart';
import '../../core/providers.dart';
import '../../core/rider_api.dart';
import '../booking/booking_map_sheet.dart';

class RiderHomePage extends HookConsumerWidget {
  const RiderHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeTab = ref.watch(riderHomeTabProvider);
    final session = ref.watch(sessionProvider)!;
    final api = ref.watch(riderApiProvider);
    final socket = ref.watch(socketProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    final notifications = ref.watch(notificationCenterProvider);

    useEffect(() {
      void onMessage(dynamic payload) {
        ref.read(notificationCenterProvider.notifier).push(
              title: 'New Message',
              body: 'You received a new chat message',
              type: 'message',
              payload: payload,
            );
      }

      void onLocation(dynamic payload) {
        ref.read(notificationCenterProvider.notifier).push(
              title: 'Nearby Driver Update',
              body: 'Driver movement update received',
              type: 'tracking',
              payload: payload,
            );
      }

      socket?.on('message:new', onMessage);
      socket?.on('driver:location:updated', onLocation);
      return () {
        socket?.off('message:new', onMessage);
        socket?.off('driver:location:updated', onLocation);
      };
    }, <Object?>[socket]);

    useEffect(() {
      Future<void> bootstrapFcm() async {
        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission(
            alert: true, badge: true, sound: true);
        final token = await messaging.getToken();
        if (token != null && token.isNotEmpty) {
          await api.registerDeviceToken(
            app: 'rider',
            platform: Platform.isIOS ? 'ios' : 'android',
            token: token,
          );
          ref.read(notificationCenterProvider.notifier).push(
                title: 'FCM Ready',
                body: 'Device token registered to backend',
                type: 'fcm',
                payload: token,
              );
        }

        FirebaseMessaging.instance.onTokenRefresh.listen((nextToken) async {
          if (nextToken.isEmpty) return;
          await api.registerDeviceToken(
            app: 'rider',
            platform: Platform.isIOS ? 'ios' : 'android',
            token: nextToken,
          );
          ref.read(notificationCenterProvider.notifier).push(
                title: 'FCM Token Refreshed',
                body: 'Updated token registered to backend',
                type: 'fcm',
                payload: nextToken,
              );
        });
      }

      bootstrapFcm();

      final subMessage =
          FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final title = message.notification?.title ?? 'Push notification';
        final body = message.notification?.body ??
            (message.data.isEmpty ? 'No body' : message.data.toString());
        LocalNotificationsService.showFromRemoteMessage(message);
        final notificationId =
            (message.data['notificationId'] ?? '').toString();
        if (notificationId.isNotEmpty) {
          () async {
            try {
              await api.markNotificationReceived(notificationId);
              await api.markNotificationDelivered(notificationId);
            } catch (_) {
              // best-effort ack
            }
          }();
        }
        ref.read(notificationCenterProvider.notifier).push(
              title: title,
              body: body,
              type: 'push',
              payload: message.data,
            );
      });

      final subOpen =
          FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final title = message.notification?.title ?? 'Opened from notification';
        final body = message.notification?.body ?? 'Notification tap event';
        final notificationId =
            (message.data['notificationId'] ?? '').toString();
        if (notificationId.isNotEmpty) {
          () async {
            try {
              await api.markNotificationRead(notificationId);
            } catch (_) {
              // best-effort ack
            }
          }();
        }
        ref.read(notificationCenterProvider.notifier).push(
              title: title,
              body: body,
              type: 'push-open',
              payload: message.data,
            );
      });

      return () {
        subMessage.cancel();
        subOpen.cancel();
      };
    }, const <Object?>[]);

    useEffect(() {
      final sub = LocalNotificationsService.onNotificationTap.listen((payload) {
        final type = (payload['type'] ?? payload['eventType'] ?? '')
            .toString()
            .toLowerCase();
        final keys = payload.keys.map((k) => k.toLowerCase()).toSet();
        final valuesJoined =
            payload.values.map((v) => v.toString().toLowerCase()).join(' ');

        final tabs = ref.read(riderHomeTabProvider.notifier);
        if (type == 'message' || type == 'chat' || type == 'push-message') {
          tabs.setTab(4);
        } else if (type == 'parcel' || type == 'delivery') {
          tabs.setTab(2);
        } else if (type == 'payment' || type == 'refund') {
          tabs.setTab(3);
        } else if (type == 'ride' || type == 'trip') {
          tabs.setTab(1);
        } else if (type == 'rating' || type == 'review') {
          tabs.setTab(5);
        } else if (keys.contains('conversationid') ||
            keys.contains('messageid') ||
            valuesJoined.contains('message')) {
          tabs.setTab(4);
        } else if (keys.contains('parcelid') ||
            valuesJoined.contains('parcel')) {
          tabs.setTab(2);
        } else if (keys.contains('paymentid') ||
            valuesJoined.contains('payment')) {
          tabs.setTab(3);
        } else if (keys.contains('rideid') || valuesJoined.contains('ride')) {
          tabs.setTab(1);
        } else if (valuesJoined.contains('rating')) {
          tabs.setTab(5);
        } else {
          tabs.setTab(0);
        }
      });
      return sub.cancel;
    }, const <Object?>[]);
    final pages = <Widget>[
      _OverviewTab(api: api),
      _RidesTab(api: api),
      _ParcelsTab(api: api),
      _PaymentsTab(api: api),
      _RiderMessagesTab(api: api),
      _RiderRatingsTab(api: api),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rider Console'),
        actions: <Widget>[
          Center(
              child: Text('Rider: ${session.phone}',
                  style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 8),
          _NotificationsButton(
            unreadCount: unreadCount,
            notifications: notifications,
            onMarkAllRead: () =>
                ref.read(notificationCenterProvider.notifier).markAllRead(),
            onClear: () =>
                ref.read(notificationCenterProvider.notifier).clear(),
          ),
          IconButton(
              onPressed: () => ref.read(sessionProvider.notifier).signOut(),
              icon: const Icon(Icons.logout)),
        ],
      ),
      body: pages[homeTab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: homeTab,
        onDestinationSelected: (i) =>
            ref.read(riderHomeTabProvider.notifier).setTab(i),
        destinations: const <NavigationDestination>[
          NavigationDestination(icon: Icon(Icons.dashboard), label: 'Overview'),
          NavigationDestination(
              icon: Icon(Icons.directions_car), label: 'Rides'),
          NavigationDestination(
              icon: Icon(Icons.inventory_2), label: 'Parcels'),
          NavigationDestination(icon: Icon(Icons.payments), label: 'Payments'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.star), label: 'Ratings'),
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
      () {
        Future<List<dynamic>> load() async {
          final cities = await api.listCities();
          final firstCityId = cities.isEmpty
              ? null
              : (Map<String, dynamic>.from(cities.first as Map)['id'] ??
                      Map<String, dynamic>.from(cities.first as Map)['code'])
                  ?.toString();
          return Future.wait<dynamic>(<Future<dynamic>>[
            api.getRiderAnalytics(),
            api.listOffers(
                cityId: firstCityId != null && firstCityId.isNotEmpty
                    ? firstCityId
                    : null),
            api.listMyRides(),
            api.listMyParcels(),
          ]);
        }

        return load();
      },
      const <Object?>[],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) return _ErrorView(error: snap.error);
    final analytics =
        snap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
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
            _StatCard(
                title: 'Total Trips', value: '${analytics['totalTrips'] ?? 0}'),
            _StatCard(
                title: 'Total Spent', value: '${analytics['totalSpent'] ?? 0}'),
            _StatCard(
                title: 'Cancelled',
                value: '${analytics['cancelledTrips'] ?? 0}'),
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
    // Geo JSON: backend dispatch uses lat/lng (see rides/parcels services).
    final plLat = useTextEditingController(text: '12.97160');
    final plLng = useTextEditingController(text: '77.59460');
    final drLat = useTextEditingController(text: '12.95000');
    final drLng = useTextEditingController(text: '77.58000');
    final distance = useTextEditingController(text: '5');
    final rideIdController = useTextEditingController();
    final rideStatusOtp = useTextEditingController();
    final statusLine = useTextEditingController(text: 'cancelled');
    final couponCode = useTextEditingController();
    final createCoupon = useTextEditingController();
    final selectedCityId = useState<String?>(null);
    final selectedVehicleTypeId = useState<String?>(null);
    final estimatedAmount = useState<double>(0);
    final estimateJson = useState<Object?>(null);
    final couponResult = useState<Object?>(null);
    final createResult = useState<Object?>(null);
    final rideDetail = useState<Object?>(null);
    final statusResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.listCities(),
        api.listVehicleTypes(),
        api.listMyRides()
      ]),
      <Object?>[refresh.value],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) return _ErrorView(error: snap.error);
    final cities = snap.data?[0] as List<dynamic>? ?? <dynamic>[];
    final vehicleTypes = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final rides = snap.data?[2] as List<dynamic>? ?? <dynamic>[];

    useEffect(
      () {
        if (selectedCityId.value == null && cities.isNotEmpty) {
          final first = Map<String, dynamic>.from(cities.first as Map);
          selectedCityId.value =
              (first['id'] ?? first['code'] ?? '').toString();
        }
        if (selectedVehicleTypeId.value == null && vehicleTypes.isNotEmpty) {
          final vt = Map<String, dynamic>.from(vehicleTypes.first as Map);
          selectedVehicleTypeId.value =
              (vt['id'] ?? vt['code'] ?? '').toString();
        }
        return null;
      },
      <Object?>[cities.length, vehicleTypes.length, snap.data],
    );

    final cityId = selectedCityId.value?.trim() ?? '';
    final vtId = selectedVehicleTypeId.value?.trim() ?? '';

    Future<void> estimate() async {
      if (cityId.isEmpty || vtId.isEmpty) {
        error.value = 'Select a city and vehicle type';
        return;
      }
      error.value = null;
      try {
        final result = await api.estimateRideFare(<String, dynamic>{
          'cityId': cityId,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'vehicleTypeId': vtId,
        });
        final amt = readEstimateAmount(result) ?? 0;
        estimatedAmount.value = amt;
        estimateJson.value = result;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> doCreateRide() async {
      if (cityId.isEmpty || vtId.isEmpty) {
        error.value = 'Select a city and vehicle type';
        return;
      }
      error.value = null;
      final pickup = geoPoint(double.tryParse(plLat.text.trim()) ?? 0,
          double.tryParse(plLng.text.trim()) ?? 0);
      final drop = geoPoint(double.tryParse(drLat.text.trim()) ?? 0,
          double.tryParse(drLng.text.trim()) ?? 0);
      final cc = createCoupon.text.trim();
      try {
        final result = await api.createRide(<String, dynamic>{
          'cityId': cityId,
          'pickup': pickup,
          'drop': drop,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'vehicleTypeId': vtId,
          if (cc.isNotEmpty) 'couponCode': cc,
        });
        createResult.value = result;
        if ((result['id'] ?? '') != '') {
          rideIdController.text = result['id'].toString();
        }
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
          fare: estimatedAmount.value,
          cityId: cityId.isNotEmpty ? cityId : null,
          rideId: rideIdController.text.trim().isEmpty
              ? null
              : rideIdController.text.trim(),
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
          fare: estimatedAmount.value,
        );
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> getRideDetail() async {
      final rideId = rideIdController.text.trim();
      if (rideId.isEmpty) return;
      error.value = null;
      try {
        rideDetail.value = await api.getRideById(rideId);
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> postRideStatus() async {
      final rideId = rideIdController.text.trim();
      if (rideId.isEmpty) {
        error.value = 'Enter a ride id';
        return;
      }
      error.value = null;
      final otp = rideStatusOtp.text.trim();
      try {
        statusResult.value = await api.updateRideStatus(
            rideId, statusLine.text.trim(),
            otp: otp.isEmpty ? null : otp);
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        if (cities.isNotEmpty)
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'City'),
            isExpanded: true,
            initialValue: cityId.isEmpty ? null : cityId,
            items: cities.map((dynamic c) {
              final m = Map<String, dynamic>.from(c as Map);
              final id = (m['id'] ?? m['code'] ?? '').toString();
              final name = (m['name'] ?? m['code'] ?? id).toString();
              return DropdownMenuItem<String>(value: id, child: Text(name));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                selectedCityId.value = v;
              }
            },
          )
        else
          const ListTile(
            contentPadding: EdgeInsets.zero,
            title:
                Text('No cities in backend — seed cities in admin/DB first.'),
          ),
        if (vehicleTypes.isNotEmpty)
          DropdownButtonFormField<String>(
            decoration:
                const InputDecoration(labelText: 'Vehicle type (API id)'),
            isExpanded: true,
            initialValue: vtId.isEmpty ? null : vtId,
            items: vehicleTypes.map((dynamic v) {
              final m = Map<String, dynamic>.from(v as Map);
              final id = (m['id'] ?? m['code'] ?? '').toString();
              final name = (m['name'] ?? m['code'] ?? id).toString();
              return DropdownMenuItem<String>(value: id, child: Text(name));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                selectedVehicleTypeId.value = v;
              }
            },
          ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: () async {
            final BookingMapResult? r = await showBookingMapSheet(
              context: context,
              api: api,
              kind: BookingMapKind.ride,
            );
            if (r == null) return;
            plLat.text = r.pickup.latitude.toStringAsFixed(5);
            plLng.text = r.pickup.longitude.toStringAsFixed(5);
            drLat.text = r.drop.latitude.toStringAsFixed(5);
            drLng.text = r.drop.longitude.toStringAsFixed(5);
            distance.text = r.distanceKm.toStringAsFixed(2);
            selectedCityId.value = r.cityId;
            error.value = null;
          },
          icon: const Icon(Icons.map_outlined),
          label: const Text('Set pickup & drop on map'),
        ),
        const SizedBox(height: 6),
        Text(
          'Straight-line distance (km) — edit if you need route distance instead.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        TextField(
            controller: distance,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
                labelText: 'Distance (km) for fare + dispatch')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: estimate, child: const Text('Estimate fare')),
            OutlinedButton(
                onPressed: doCreateRide, child: const Text('Request ride')),
          ],
        ),
        if (createResult.value != null) ...<Widget>[
          Builder(
            builder: (context) {
              final cr = Map<String, dynamic>.from(
                  createResult.value! as Map<dynamic, dynamic>);
              final otp = readRideStartOtp(cr);
              if (otp == null) return const SizedBox.shrink();
              final scheme = Theme.of(context).colorScheme;
              return Card(
                margin: const EdgeInsets.only(top: 12),
                color: scheme.primaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Text(
                        'Give this code to your driver',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: scheme.onPrimaryContainer,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 8),
                      SelectableText(
                        otp,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              letterSpacing: 6,
                              fontWeight: FontWeight.bold,
                              color: scheme.onPrimaryContainer,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'The trip starts when your driver enters this 6-digit code.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: scheme.onPrimaryContainer,
                            ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
        Text('Estimated amount (from API): ${estimatedAmount.value}'),
        if (estimateJson.value != null)
          _JsonPanel(title: 'Estimate response', data: estimateJson.value),
        TextField(
          controller: createCoupon,
          decoration: const InputDecoration(
              labelText:
                  'Coupon for create ride (optional, applies at booking)'),
        ),
        const Divider(height: 28),
        const Text('Coupons (separate from booking)',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: rideIdController,
            decoration: const InputDecoration(
                labelText: 'Ride id (detail / apply / status)')),
        TextField(
            controller: couponCode,
            decoration: const InputDecoration(labelText: 'Coupon code')),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: validateCoupon,
                child: const Text('Validate coupon')),
            OutlinedButton(
                onPressed: applyCoupon,
                child: const Text('Apply coupon to ride id')),
            OutlinedButton(
                onPressed: getRideDetail, child: const Text('Get ride detail')),
          ],
        ),
        const SizedBox(height: 8),
        const Text('Update ride status (OTP required to start trip)',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        TextField(
          controller: statusLine,
          decoration: const InputDecoration(
              labelText: 'Status: cancelled, in_progress, completed, …',
              hintText: 'cancelled'),
        ),
        TextField(
            controller: rideStatusOtp,
            decoration: const InputDecoration(
                labelText: 'Start OTP (required if status = in_progress)')),
        OutlinedButton(
            onPressed: postRideStatus, child: const Text('POST status')),
        if (couponResult.value != null)
          _JsonPanel(title: 'Coupon', data: couponResult.value),
        if (rideDetail.value != null)
          _JsonPanel(title: 'Ride detail', data: rideDetail.value),
        if (statusResult.value != null)
          _JsonPanel(title: 'Status update', data: statusResult.value),
        if (createResult.value != null)
          _JsonPanel(title: 'Create ride', data: createResult.value),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        for (final dynamic raw in rides) ...<Widget>[
          Builder(
            builder: (context) {
              final m = Map<String, dynamic>.from(raw as Map);
              final otp = readRideStartOtp(m);
              if (otp == null) return const SizedBox.shrink();
              final id = (m['id'] ?? '').toString();
              final scheme = Theme.of(context).colorScheme;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                color: scheme.secondaryContainer,
                child: ListTile(
                  title: Text(
                    'Trip start code${id.isNotEmpty ? ' · $id' : ''}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: scheme.onSecondaryContainer,
                    ),
                  ),
                  subtitle: Text(
                    'Tell your driver: $otp',
                    style: TextStyle(
                      fontSize: 18,
                      letterSpacing: 3,
                      fontWeight: FontWeight.bold,
                      color: scheme.onSecondaryContainer,
                    ),
                  ),
                  isThreeLine: true,
                ),
              );
            },
          ),
        ],
        _JsonPanel(title: 'My rides', data: rides),
      ],
    );
  }
}

class _ParcelsTab extends HookWidget {
  const _ParcelsTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final plLat = useTextEditingController(text: '12.97160');
    final plLng = useTextEditingController(text: '77.59460');
    final drLat = useTextEditingController(text: '12.94000');
    final drLng = useTextEditingController(text: '77.60000');
    final distance = useTextEditingController(text: '5');
    final weight = useTextEditingController(text: '2');
    final itemDescription = useTextEditingController(text: 'Sample parcel');
    final senderName = useTextEditingController(text: 'Rider Sender');
    final senderPhone = useTextEditingController(text: '9800000001');
    final receiverName = useTextEditingController(text: 'Receiver');
    final receiverPhone = useTextEditingController(text: '9800000999');
    final receiverEmail =
        useTextEditingController(text: 'receiver@example.com');
    final receiverAddress = useTextEditingController(text: 'Maitighar');
    final parcelId = useTextEditingController();
    final otp = useTextEditingController();
    final status = useTextEditingController(text: 'picked_up');
    final selectedCityId = useState<String?>(null);
    final selectedVehicleTypeId = useState<String?>(null);
    final estimateResult = useState<Object?>(null);
    final createResult = useState<Object?>(null);
    final parcelDetail = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.listCities(),
        api.listVehicleTypes(),
        api.listMyParcels()
      ]),
      <Object?>[refresh.value],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) return _ErrorView(error: snap.error);
    final cities = snap.data?[0] as List<dynamic>? ?? <dynamic>[];
    final vehicleTypes = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final parcels = snap.data?[2] as List<dynamic>? ?? <dynamic>[];

    useEffect(
      () {
        if (selectedCityId.value == null && cities.isNotEmpty) {
          final m = Map<String, dynamic>.from(cities.first as Map);
          selectedCityId.value = (m['id'] ?? m['code'] ?? '').toString();
        }
        if (selectedVehicleTypeId.value == null && vehicleTypes.isNotEmpty) {
          final m = Map<String, dynamic>.from(vehicleTypes.first as Map);
          selectedVehicleTypeId.value = (m['id'] ?? m['code'] ?? '').toString();
        }
        return null;
      },
      <Object?>[cities.length, vehicleTypes.length, snap.data],
    );

    final cid = selectedCityId.value?.trim() ?? '';
    final vtid = selectedVehicleTypeId.value?.trim() ?? '';

    Future<void> estimateParcel() async {
      if (cid.isEmpty || vtid.isEmpty) {
        error.value = 'Select city and vehicle type';
        return;
      }
      error.value = null;
      try {
        estimateResult.value = await api.estimateParcelFare(<String, dynamic>{
          'cityId': cid,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'weightKg': double.tryParse(weight.text.trim()) ?? 0,
          'vehicleTypeId': vtid,
        });
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> createParcel() async {
      if (cid.isEmpty || vtid.isEmpty) {
        error.value = 'Select city and vehicle type';
        return;
      }
      final pickup = geoPoint(double.tryParse(plLat.text.trim()) ?? 0,
          double.tryParse(plLng.text.trim()) ?? 0);
      final drop = geoPoint(double.tryParse(drLat.text.trim()) ?? 0,
          double.tryParse(drLng.text.trim()) ?? 0);
      error.value = null;
      try {
        createResult.value = await api.createParcel(<String, dynamic>{
          'cityId': cid,
          'pickup': pickup,
          'drop': drop,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'weightKg': double.tryParse(weight.text.trim()) ?? 0,
          'vehicleTypeId': vtid,
          'itemDescription': itemDescription.text.trim().isNotEmpty
              ? itemDescription.text.trim()
              : 'Item',
          'senderName': senderName.text.trim(),
          'senderPhone': senderPhone.text.trim(),
          'receiverName': receiverName.text.trim(),
          'receiverPhone': receiverPhone.text.trim(),
          'receiverEmail': receiverEmail.text.trim(),
          'receiverAddress': receiverAddress.text.trim(),
        });
        if (createResult.value is Map) {
          final m = createResult.value as Map<String, dynamic>;
          if ((m['id'] ?? '') != '') {
            parcelId.text = m['id'].toString();
          }
        }
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
          otp: otp.text.trim().isNotEmpty ? otp.text.trim() : null,
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> getParcelDetail() async {
      final id = parcelId.text.trim();
      if (id.isEmpty) return;
      error.value = null;
      try {
        parcelDetail.value = await api.getParcelById(id);
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        if (cities.isNotEmpty)
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'City'),
            isExpanded: true,
            initialValue: cid.isEmpty ? null : cid,
            items: cities.map((dynamic c) {
              final m = Map<String, dynamic>.from(c as Map);
              final id = (m['id'] ?? m['code'] ?? '').toString();
              return DropdownMenuItem<String>(
                  value: id, child: Text('${m['name'] ?? id}'));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                selectedCityId.value = v;
              }
            },
          ),
        if (vehicleTypes.isNotEmpty)
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Vehicle type'),
            isExpanded: true,
            initialValue: vtid.isEmpty ? null : vtid,
            items: vehicleTypes.map((dynamic c) {
              final m = Map<String, dynamic>.from(c as Map);
              final id = (m['id'] ?? m['code'] ?? '').toString();
              return DropdownMenuItem<String>(
                  value: id, child: Text('${m['name'] ?? id}'));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                selectedVehicleTypeId.value = v;
              }
            },
          ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: () async {
            final BookingMapResult? r = await showBookingMapSheet(
              context: context,
              api: api,
              kind: BookingMapKind.parcel,
            );
            if (r == null) return;
            plLat.text = r.pickup.latitude.toStringAsFixed(5);
            plLng.text = r.pickup.longitude.toStringAsFixed(5);
            drLat.text = r.drop.latitude.toStringAsFixed(5);
            drLng.text = r.drop.longitude.toStringAsFixed(5);
            distance.text = r.distanceKm.toStringAsFixed(2);
            selectedCityId.value = r.cityId;
            error.value = null;
          },
          icon: const Icon(Icons.map_outlined),
          label: const Text('Set pickup & drop on map'),
        ),
        const SizedBox(height: 6),
        Text(
          'Distance (km) is straight-line from the map — adjust if you use route distance.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: distance,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Distance km'))),
            const SizedBox(width: 8),
            Expanded(
                child: TextField(
                    controller: weight,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Weight kg'))),
          ],
        ),
        TextField(
            controller: itemDescription,
            decoration: const InputDecoration(
                labelText: 'Item description (required in DB layer)')),
        TextField(
            controller: senderName,
            decoration: const InputDecoration(labelText: 'Sender name')),
        TextField(
            controller: senderPhone,
            decoration: const InputDecoration(labelText: 'Sender phone')),
        TextField(
            controller: receiverName,
            decoration: const InputDecoration(labelText: 'Receiver name')),
        TextField(
            controller: receiverPhone,
            decoration: const InputDecoration(labelText: 'Receiver phone')),
        TextField(
            controller: receiverEmail,
            decoration: const InputDecoration(labelText: 'Receiver email')),
        TextField(
            controller: receiverAddress,
            decoration: const InputDecoration(labelText: 'Receiver address')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: estimateParcel,
                child: const Text('Estimate parcel fare')),
            OutlinedButton(
                onPressed: createParcel, child: const Text('Create parcel')),
          ],
        ),
        const Divider(height: 24),
        const Text('Status / detail',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: parcelId,
            decoration: const InputDecoration(labelText: 'Parcel id')),
        TextField(
            controller: status,
            decoration: const InputDecoration(
                labelText: 'Status: picked_up, in_transit, delivered, ...')),
        TextField(
            controller: otp,
            decoration: const InputDecoration(
                labelText: 'Handoff / pickup OTP when required')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: updateStatus,
                child: const Text('Update parcel status')),
            OutlinedButton(
                onPressed: getParcelDetail,
                child: const Text('Get parcel detail')),
          ],
        ),
        if (estimateResult.value != null)
          _JsonPanel(title: 'Parcel estimate', data: estimateResult.value),
        if (createResult.value != null)
          _JsonPanel(title: 'Parcel result', data: createResult.value),
        if (parcelDetail.value != null)
          _JsonPanel(title: 'Parcel detail', data: parcelDetail.value),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        _JsonPanel(title: 'My parcels', data: parcels),
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
          _JsonPanel(title: 'Payment Result', data: result.value),
        _JsonPanel(title: 'Payment Timeline', data: timeline.value),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}

class _RiderMessagesTab extends HookConsumerWidget {
  const _RiderMessagesTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final participant = useTextEditingController();
    final content = useTextEditingController();
    final supportContent = useTextEditingController();
    final search = useTextEditingController();
    final conversationId = useState<String?>(null);
    final live = useState<List<dynamic>>(<dynamic>[]);
    final rideId = useTextEditingController();
    final refresh = useState(0);
    final supportConvId = useState<String?>(null);
    final supportLoading = useState(false);
    final supportError = useState<String?>(null);
    useListenable(search);

    final socket = ref.watch(socketProvider);
    useEffect(() {
      void onMessage(dynamic payload) {
        live.value = <dynamic>[...live.value, payload];
        final sid = supportConvId.value;
        if (sid != null && payload is Map) {
          final m = Map<String, dynamic>.from(payload);
          if (m['conversationId']?.toString() == sid) {
            refresh.value++;
          }
        }
      }

      socket?.on('message:new', onMessage);
      return () => socket?.off('message:new', onMessage);
    }, <Object?>[socket, supportConvId.value]);

    final convFuture =
        useMemoized(() => api.listConversations(), <Object?>[refresh.value]);
    final convSnap = useFuture(convFuture);
    final conversations = (convSnap.data ?? <dynamic>[]).where((dynamic e) {
      final q = search.text.trim().toLowerCase();
      if (q.isEmpty) return true;
      final m = Map<String, dynamic>.from(e as Map);
      return '${m['id']} ${m['participantAId']} ${m['participantBId']} ${m['rideId']}'
          .toLowerCase()
          .contains(q);
    }).toList();

    final msgFuture = useMemoized(() {
      final id = conversationId.value;
      if (id == null || id.isEmpty) {
        return Future<List<dynamic>>.value(<dynamic>[]);
      }
      return api.listMessages(id);
    }, <Object?>[conversationId.value, refresh.value]);
    final msgSnap = useFuture(msgFuture);

    final supportMsgFuture = useMemoized(() {
      final id = supportConvId.value;
      if (id == null || id.isEmpty) {
        return Future<List<dynamic>>.value(<dynamic>[]);
      }
      return api.listMessages(id);
    }, <Object?>[supportConvId.value, refresh.value]);
    final supportMsgSnap = useFuture(supportMsgFuture);
    final myNotificationsFuture = useMemoized(
        () => api.listMyNotifications(limit: 100), <Object?>[refresh.value]);
    final myNotificationsSnap = useFuture(myNotificationsFuture);
    final myNotificationStatsFuture = useMemoized(
        () => api.getMyNotificationStats(), <Object?>[refresh.value]);
    final myNotificationStatsSnap = useFuture(myNotificationStatsFuture);

    Future<void> startConversation() async {
      if (participant.text.trim().isEmpty) return;
      final convo = await api.startConversation(
          participantUserId: participant.text.trim(),
          rideId: rideId.text.trim().isEmpty ? null : rideId.text.trim());
      final id = (convo['id'] ?? '').toString();
      if (id.isNotEmpty) {
        conversationId.value = id;
        socket?.emit(
            'conversation:join', <String, dynamic>{'conversationId': id});
      }
      refresh.value++;
    }

    Future<void> openSupportChat() async {
      supportLoading.value = true;
      supportError.value = null;
      try {
        final convo = await api.ensureSupportConversation();
        final id = (convo['id'] ?? '').toString();
        if (id.isEmpty) throw Exception('No conversation id from server');
        supportConvId.value = id;
        conversationId.value = id;
        socket?.emit(
            'conversation:join', <String, dynamic>{'conversationId': id});
        refresh.value++;
      } catch (e) {
        supportError.value = e.toString();
      } finally {
        supportLoading.value = false;
      }
    }

    Future<void> sendSupportMessage() async {
      final id = supportConvId.value;
      if (id == null || id.isEmpty || supportContent.text.trim().isEmpty) {
        return;
      }
      final text = supportContent.text.trim();

      if (socket?.connected == true) {
        final completer = Completer<void>();
        Timer? timer;
        timer = Timer(const Duration(seconds: 15), () {
          if (!completer.isCompleted) {
            completer.completeError(TimeoutException('socket send'));
          }
        });
        socket!.emitWithAck(
          'message:send',
          <String, dynamic>{'conversationId': id, 'content': text},
          ack: (dynamic data) {
            timer?.cancel();
            if (completer.isCompleted) return;
            if (data is Map && data['ok'] == true) {
              completer.complete();
            } else {
              completer.completeError(Exception(data is Map
                  ? (data['error'] ?? 'Send failed')
                  : 'Send failed'));
            }
          },
        );
        try {
          await completer.future;
          supportContent.clear();
          refresh.value++;
          return;
        } catch (_) {
          /* fall through to REST */
        }
      }

      await api.sendMessage(id, text);
      supportContent.clear();
      refresh.value++;
    }

    Future<void> sendMessage() async {
      final id = conversationId.value;
      if (id == null || id.isEmpty || content.text.trim().isEmpty) return;
      await api.sendMessage(id, content.text.trim());
      content.clear();
      refresh.value++;
    }

    final myUserId = session?.userId ?? '';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Card(
          elevation: 0,
          color: Theme.of(context)
              .colorScheme
              .primaryContainer
              .withValues(alpha: 0.45),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text('Support',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(
                  'Message the operations team (admins). Replies appear here and in notifications.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: supportLoading.value ? null : openSupportChat,
                  child: supportLoading.value
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(supportConvId.value == null
                          ? 'Open support chat'
                          : 'Reconnect to thread'),
                ),
                if (supportError.value != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(supportError.value!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                            fontSize: 13)),
                  ),
                if (supportConvId.value != null) ...<Widget>[
                  const SizedBox(height: 16),
                  Text('Thread #${supportConvId.value}',
                      style: Theme.of(context).textTheme.labelSmall),
                  const SizedBox(height: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 240),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: Theme.of(context).dividerColor),
                      ),
                      child: supportMsgSnap.connectionState ==
                              ConnectionState.waiting
                          ? const Center(
                              child: Padding(
                                  padding: EdgeInsets.all(24),
                                  child: CircularProgressIndicator()))
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 8),
                              itemCount:
                                  (supportMsgSnap.data ?? <dynamic>[]).length,
                              itemBuilder: (BuildContext context, int i) {
                                final rows = supportMsgSnap.data ?? <dynamic>[];
                                final row =
                                    Map<String, dynamic>.from(rows[i] as Map);
                                final sender =
                                    row['senderUserId']?.toString() ?? '';
                                final mine =
                                    myUserId.isNotEmpty && sender == myUserId;
                                final text = row['content']?.toString() ?? '';
                                return Align(
                                  alignment: mine
                                      ? Alignment.centerRight
                                      : Alignment.centerLeft,
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 8),
                                    constraints:
                                        const BoxConstraints(maxWidth: 280),
                                    decoration: BoxDecoration(
                                      color: mine
                                          ? Theme.of(context)
                                              .colorScheme
                                              .primary
                                          : Theme.of(context)
                                              .colorScheme
                                              .surfaceContainerHighest,
                                      borderRadius:
                                          BorderRadius.circular(12).copyWith(
                                        bottomRight: mine
                                            ? const Radius.circular(4)
                                            : null,
                                        bottomLeft: mine
                                            ? null
                                            : const Radius.circular(4),
                                      ),
                                    ),
                                    child: Text(
                                      text,
                                      style: TextStyle(
                                        color: mine
                                            ? Theme.of(context)
                                                .colorScheme
                                                .onPrimary
                                            : Theme.of(context)
                                                .colorScheme
                                                .onSurfaceVariant,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: TextField(
                          controller: supportContent,
                          decoration: const InputDecoration(
                            hintText: 'Write to support…',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          minLines: 1,
                          maxLines: 3,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => sendSupportMessage(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: sendSupportMessage,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.all(14),
                          minimumSize: const Size(48, 48),
                        ),
                        child: const Icon(Icons.send),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text(
            'Socket: ${socket?.connected == true ? 'connected' : 'disconnected'}'),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: participant,
                    decoration: const InputDecoration(
                        labelText: 'Participant user id'))),
            const SizedBox(width: 8),
            ElevatedButton(
                onPressed: startConversation, child: const Text('Start')),
          ],
        ),
        TextField(
            controller: search,
            decoration:
                const InputDecoration(labelText: 'Search conversations')),
        if (convSnap.hasData)
          DropdownButton<String>(
            value: conversationId.value,
            hint: const Text('Select conversation'),
            isExpanded: true,
            items: conversations.map((dynamic e) {
              final m = Map<String, dynamic>.from(e as Map);
              final id = m['id'].toString();
              return DropdownMenuItem<String>(
                  value: id,
                  child: Text(
                      '$id (${m['participantAId']} ↔ ${m['participantBId']})'));
            }).toList(),
            onChanged: (v) {
              conversationId.value = v;
              if (v != null) {
                socket?.emit('conversation:join',
                    <String, dynamic>{'conversationId': v});
              }
            },
          ),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: content,
                    decoration: const InputDecoration(labelText: 'Message'))),
            IconButton(onPressed: sendMessage, icon: const Icon(Icons.send)),
          ],
        ),
        _JsonPanel(
            title: 'My Notification Stats (server)',
            data: myNotificationStatsSnap.data ?? <String, dynamic>{}),
        _JsonPanel(
            title: 'My Notifications (server)',
            data: myNotificationsSnap.data ?? <dynamic>[]),
        _JsonPanel(title: 'Messages', data: msgSnap.data ?? <dynamic>[]),
        _JsonPanel(title: 'Live Message Stream', data: live.value),
      ],
    );
  }
}

class _RiderRatingsTab extends HookWidget {
  const _RiderRatingsTab({required this.api});
  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final targetUser = useTextEditingController();
    final rideId = useTextEditingController();
    final score = useTextEditingController(text: '5');
    final comment = useTextEditingController();
    final lookupUser = useTextEditingController();
    final reportUser = useTextEditingController();
    final reportReason = useTextEditingController(text: 'driver_behaviour');
    final reportDescription = useTextEditingController();
    final reportRideId = useTextEditingController();
    final lookupResult = useState<Object?>(null);
    final ratingResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final ratingsFuture = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getMyRatingSummary(),
        api.listMyRatings(),
        api.listMyReports()
      ]),
      <Object?>[refresh.value],
    );
    final ratingsSnap = useFuture(ratingsFuture);

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
        lookupResult.value =
            await api.getUserRatingSummary(lookupUser.text.trim());
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> submitReport() async {
      error.value = null;
      try {
        ratingResult.value = await api.createReport(
          reportedUserId: reportUser.text.trim(),
          reason: reportReason.text.trim(),
          description: reportDescription.text.trim(),
          rideId: reportRideId.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    final mySummary =
        ratingsSnap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final myRatings = ratingsSnap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final myReports = ratingsSnap.data?[2] as List<dynamic>? ?? <dynamic>[];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        _JsonPanel(title: 'My Rating Summary', data: mySummary),
        _JsonPanel(title: 'My Ratings', data: myRatings),
        const Text('Rate Driver',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: rideId,
            decoration: const InputDecoration(labelText: 'Ride id')),
        TextField(
            controller: targetUser,
            decoration: const InputDecoration(labelText: 'Driver user id')),
        TextField(
            controller: score,
            decoration: const InputDecoration(labelText: 'Score (1-5)')),
        TextField(
            controller: comment,
            decoration: const InputDecoration(labelText: 'Comment')),
        ElevatedButton(
            onPressed: submitRating, child: const Text('Submit Rating')),
        if (ratingResult.value != null)
          _JsonPanel(title: 'Rating Submit Result', data: ratingResult.value),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: lookupUser,
                    decoration: const InputDecoration(
                        labelText: 'Driver user id for summary'))),
            const SizedBox(width: 8),
            OutlinedButton(
                onPressed: lookupRating, child: const Text('Lookup')),
          ],
        ),
        if (lookupResult.value != null)
          _JsonPanel(title: 'Driver Summary', data: lookupResult.value),
        const Divider(height: 28),
        const Text('Report Driver',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: reportUser,
            decoration:
                const InputDecoration(labelText: 'Reported driver user id')),
        TextField(
            controller: reportRideId,
            decoration: const InputDecoration(labelText: 'Ride id (optional)')),
        TextField(
            controller: reportReason,
            decoration: const InputDecoration(labelText: 'Reason')),
        TextField(
            controller: reportDescription,
            decoration: const InputDecoration(labelText: 'Description')),
        ElevatedButton(
            onPressed: submitReport, child: const Text('Submit Report')),
        _JsonPanel(title: 'My Reports', data: myReports),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
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

class _NotificationsButton extends StatelessWidget {
  const _NotificationsButton({
    required this.unreadCount,
    required this.notifications,
    required this.onMarkAllRead,
    required this.onClear,
  });

  final int unreadCount;
  final List<AppNotification> notifications;
  final VoidCallback onMarkAllRead;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: () {
        showModalBottomSheet<void>(
          context: context,
          builder: (context) {
            return SafeArea(
              child: Column(
                children: <Widget>[
                  ListTile(
                    title: const Text('Notifications'),
                    subtitle: Text(
                        '${notifications.length} total, $unreadCount unread'),
                    trailing: Wrap(
                      spacing: 8,
                      children: <Widget>[
                        TextButton(
                            onPressed: onMarkAllRead,
                            child: const Text('Mark all read')),
                        TextButton(
                            onPressed: onClear, child: const Text('Clear')),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: notifications.isEmpty
                        ? const Center(child: Text('No notifications yet'))
                        : ListView.builder(
                            itemCount: notifications.length,
                            itemBuilder: (context, index) {
                              final item = notifications[index];
                              return ListTile(
                                leading: Icon(item.read
                                    ? Icons.notifications_none
                                    : Icons.notifications_active),
                                title: Text(item.title),
                                subtitle: Text(
                                    '${item.body}\n${item.createdAt.toLocal()}'),
                                isThreeLine: true,
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
      icon: Badge(
        isLabelVisible: unreadCount > 0,
        label: Text('$unreadCount'),
        child: const Icon(Icons.notifications),
      ),
    );
  }
}
