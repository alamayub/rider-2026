import 'dart:convert';
import 'dart:io' show Platform;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../core/driver_api.dart';
import '../../core/local_notifications.dart';
import '../../core/providers.dart';

class DriverHomePage extends HookConsumerWidget {
  const DriverHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tab = useState(0);
    final session = ref.watch(sessionProvider)!;
    final api = ref.watch(driverApiProvider);
    final socket = ref.watch(socketProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    final notifications = ref.watch(notificationCenterProvider);

    useEffect(() {
      void onMessage(dynamic payload) {
        ref.read(notificationCenterProvider.notifier).push(
              title: 'New Message',
              body: 'You received a message',
              type: 'message',
              payload: payload,
            );
      }

      void onLocation(dynamic payload) {
        ref.read(notificationCenterProvider.notifier).push(
              title: 'Dispatch Update',
              body: 'Driver location stream update received',
              type: 'dispatch',
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
        await messaging.requestPermission(alert: true, badge: true, sound: true);
        final token = await messaging.getToken();
        if (token != null && token.isNotEmpty) {
          await api.registerDeviceToken(
            app: 'driver',
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
            app: 'driver',
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

      final subMessage = FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final title = message.notification?.title ?? 'Push notification';
        final body = message.notification?.body ?? (message.data.isEmpty ? 'No body' : message.data.toString());
        LocalNotificationsService.showFromRemoteMessage(message);
        final notificationId = (message.data['notificationId'] ?? '').toString();
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

      final subOpen = FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final title = message.notification?.title ?? 'Opened from notification';
        final body = message.notification?.body ?? 'Notification tap event';
        final notificationId = (message.data['notificationId'] ?? '').toString();
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
        final type = (payload['type'] ?? payload['eventType'] ?? '').toString().toLowerCase();
        final keys = payload.keys.map((k) => k.toLowerCase()).toSet();
        final valuesJoined = payload.values.map((v) => v.toString().toLowerCase()).join(' ');

        if (type == 'message' || type == 'chat' || type == 'push-message') {
          tab.value = 3;
        } else if (type == 'ride' || type == 'trip' || type == 'dispatch') {
          tab.value = 1;
        } else if (type == 'kyc' || type == 'vehicle') {
          tab.value = 2;
        } else if (type == 'rating' || type == 'review') {
          tab.value = 4;
        } else if (keys.contains('conversationid') || keys.contains('messageid') || valuesJoined.contains('message')) {
          tab.value = 3;
        } else if (keys.contains('rideid') || valuesJoined.contains('ride')) {
          tab.value = 1;
        } else if (keys.contains('kycid') || keys.contains('vehicletypeid') || valuesJoined.contains('vehicle') || valuesJoined.contains('kyc')) {
          tab.value = 2;
        } else if (keys.contains('rating') || valuesJoined.contains('rating')) {
          tab.value = 4;
        } else {
          tab.value = 0;
        }
      });
      return sub.cancel;
    }, const <Object?>[]);

    final pages = <Widget>[
      _OverviewTab(api: api),
      _RidesTab(api: api),
      _KycVehiclesTab(api: api),
      _MessagesTab(api: api),
      _RatingsTab(api: api),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Console'),
        actions: <Widget>[
          Center(child: Text('Driver: ${session.phone}', style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 8),
          _NotificationsButton(
            unreadCount: unreadCount,
            notifications: notifications,
            onMarkAllRead: () => ref.read(notificationCenterProvider.notifier).markAllRead(),
            onClear: () => ref.read(notificationCenterProvider.notifier).clear(),
          ),
          IconButton(
            onPressed: () => ref.read(sessionProvider.notifier).signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: pages[tab.value],
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab.value,
        onDestinationSelected: (i) => tab.value = i,
        destinations: const <NavigationDestination>[
          NavigationDestination(icon: Icon(Icons.dashboard), label: 'Overview'),
          NavigationDestination(icon: Icon(Icons.local_taxi), label: 'Rides'),
          NavigationDestination(icon: Icon(Icons.badge), label: 'KYC & Vehicle'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.star), label: 'Ratings'),
        ],
      ),
    );
  }
}

class _OverviewTab extends HookWidget {
  const _OverviewTab({required this.api});
  final DriverApi api;

  @override
  Widget build(BuildContext context) {
    final future = useMemoized(() => api.getDriverAnalytics(), const <Object?>[]);
    final snapshot = useFuture(future);
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return _ErrorView(error: snapshot.error);
    final data = snapshot.data ?? <String, dynamic>{};
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            _StatCard(title: 'Total Rides', value: '${data['totalRides'] ?? 0}'),
            _StatCard(title: 'Total Earnings', value: '${data['totalEarnings'] ?? 0}'),
            _StatCard(title: 'Commission Paid', value: '${data['totalCommission'] ?? 0}'),
            _StatCard(title: 'Cancelled', value: '${data['cancelledRides'] ?? 0}'),
            _StatCard(title: 'Penalties', value: '${data['penalties'] ?? 0}'),
          ],
        ),
        const SizedBox(height: 12),
        _JsonPanel(title: 'Driver Analytics Payload', data: data),
      ],
    );
  }
}

class _RidesTab extends HookConsumerWidget {
  const _RidesTab({required this.api});
  final DriverApi api;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rideIdController = useTextEditingController();
    final otpController = useTextEditingController();
    final statusController = useTextEditingController(text: 'in_progress');
    final latController = useTextEditingController(text: '27.7172');
    final lngController = useTextEditingController(text: '85.3240');
    final cityIdController = useTextEditingController(text: 'city-kathmandu');
    final online = useState(false);
    final pingCount = useState(0);
    final lastResult = useState<Object?>(null);
    final lastError = useState<String?>(null);
    final refresh = useState(0);

    final socket = ref.watch(socketProvider);
    useEffect(() {
      if (online.value && socket != null && !socket.connected) {
        socket.connect();
      }
      return null;
    }, <Object?>[online.value, socket]);

    final ridesFuture = useMemoized(() => api.listMyRides(), <Object?>[refresh.value]);
    final ridesSnap = useFuture(ridesFuture);

    Future<void> updateStatus() async {
      final rideId = rideIdController.text.trim();
      if (rideId.isEmpty) return;
      lastError.value = null;
      try {
        lastResult.value = await api.updateRideStatus(
          rideId: rideId,
          status: statusController.text.trim(),
          otp: otpController.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        lastError.value = e.toString();
      }
    }

    void sendLocation() {
      if (!online.value || socket == null) return;
      final payload = <String, dynamic>{
        'driverId': ref.read(sessionProvider)!.userId,
        'cityId': cityIdController.text.trim(),
        'lat': double.tryParse(latController.text.trim()) ?? 0,
        'lng': double.tryParse(lngController.text.trim()) ?? 0,
      };
      socket.emit('driver:location', payload);
      pingCount.value++;
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        SwitchListTile(
          value: online.value,
          onChanged: (v) => online.value = v,
          title: Text('Online for dispatch (${socket?.connected == true ? 'socket connected' : 'socket disconnected'})'),
        ),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: cityIdController, decoration: const InputDecoration(labelText: 'City ID'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: latController, decoration: const InputDecoration(labelText: 'Latitude'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: lngController, decoration: const InputDecoration(labelText: 'Longitude'))),
          ],
        ),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: sendLocation, child: Text('Send Location Ping (${pingCount.value})')),
        const Divider(height: 26),
        const Text('Ride Status Update', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: rideIdController, decoration: const InputDecoration(labelText: 'Ride ID')),
        TextField(controller: statusController, decoration: const InputDecoration(labelText: 'Status (accepted/in_progress/completed/...)')),
        TextField(controller: otpController, decoration: const InputDecoration(labelText: 'OTP (required for in_progress)')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: updateStatus, child: const Text('Update Ride Status')),
        if (lastError.value != null) Text(lastError.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        if (lastResult.value != null) _JsonPanel(title: 'Last Ride Action Result', data: lastResult.value),
        const SizedBox(height: 8),
        _JsonPanel(title: 'My Rides', data: ridesSnap.data ?? <dynamic>[]),
      ],
    );
  }
}

class _KycVehiclesTab extends HookWidget {
  const _KycVehiclesTab({required this.api});
  final DriverApi api;

  @override
  Widget build(BuildContext context) {
    final fullName = useTextEditingController();
    final license = useTextEditingController();
    final document = useTextEditingController();
    final vehicleTypeId = useTextEditingController();
    final plate = useTextEditingController();
    final model = useTextEditingController();
    final color = useTextEditingController();
    final refresh = useState(0);
    final error = useState<String?>(null);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getMyKyc(),
        api.listVehicleTypes(),
        api.listDriverVehicles(),
      ]),
      <Object?>[refresh.value],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snap.hasError) return _ErrorView(error: snap.error);

    final kyc = snap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final vehicleTypes = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final vehicles = snap.data?[2] as List<dynamic>? ?? <dynamic>[];

    Future<void> submitKyc() async {
      error.value = null;
      try {
        await api.submitKyc(
          fullName: fullName.text.trim(),
          licenseNumber: license.text.trim(),
          documentUrl: document.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> addVehicle() async {
      error.value = null;
      try {
        await api.addDriverVehicle(
          vehicleTypeId: vehicleTypeId.text.trim(),
          plateNumber: plate.text.trim(),
          modelName: model.text.trim(),
          color: color.text.trim(),
          isDefault: true,
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        _JsonPanel(title: 'My KYC', data: kyc),
        TextField(controller: fullName, decoration: const InputDecoration(labelText: 'Full name')),
        TextField(controller: license, decoration: const InputDecoration(labelText: 'License number')),
        TextField(controller: document, decoration: const InputDecoration(labelText: 'Document URL')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submitKyc, child: const Text('Submit KYC')),
        const Divider(height: 28),
        _JsonPanel(title: 'Vehicle Types', data: vehicleTypes),
        TextField(controller: vehicleTypeId, decoration: const InputDecoration(labelText: 'Vehicle type id')),
        TextField(controller: plate, decoration: const InputDecoration(labelText: 'Plate number')),
        TextField(controller: model, decoration: const InputDecoration(labelText: 'Model')),
        TextField(controller: color, decoration: const InputDecoration(labelText: 'Color')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: addVehicle, child: const Text('Add Driver Vehicle')),
        if (error.value != null) Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        const SizedBox(height: 8),
        _JsonPanel(title: 'My Vehicles', data: vehicles),
      ],
    );
  }
}

class _MessagesTab extends HookConsumerWidget {
  const _MessagesTab({required this.api});
  final DriverApi api;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final participant = useTextEditingController();
    final conversationId = useState<String?>(null);
    final content = useTextEditingController();
    final search = useTextEditingController();
    final live = useState<List<dynamic>>(<dynamic>[]);
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
    final convs = (convSnap.data ?? <dynamic>[]).where((dynamic e) {
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
    final myNotificationsFuture = useMemoized(() => api.listMyNotifications(limit: 100), <Object?>[refresh.value]);
    final myNotificationsSnap = useFuture(myNotificationsFuture);
    final myNotificationStatsFuture = useMemoized(() => api.getMyNotificationStats(), <Object?>[refresh.value]);
    final myNotificationStatsSnap = useFuture(myNotificationStatsFuture);

    Future<void> startConversation() async {
      if (participant.text.trim().isEmpty) return;
      final convo = await api.startConversation(participantUserId: participant.text.trim());
      final id = (convo['id'] ?? '').toString();
      if (id.isNotEmpty) {
        conversationId.value = id;
        socket?.emit('conversation:join', <String, dynamic>{'conversationId': id});
      }
      refresh.value++;
    }

    Future<void> send() async {
      final id = conversationId.value;
      if (id == null || id.isEmpty || content.text.trim().isEmpty) return;
      await api.sendMessage(conversationId: id, content: content.text.trim());
      content.clear();
      refresh.value++;
    }

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
        const SizedBox(height: 8),
        TextField(
          controller: search,
          decoration: const InputDecoration(labelText: 'Search conversations', prefixIcon: Icon(Icons.search)),
        ),
        if (convSnap.hasData)
          DropdownButton<String>(
            value: conversationId.value,
            hint: const Text('Select conversation'),
            isExpanded: true,
            items: convs.map((dynamic e) {
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
            IconButton(onPressed: send, icon: const Icon(Icons.send)),
          ],
        ),
        _JsonPanel(title: 'My Notification Stats (server)', data: myNotificationStatsSnap.data ?? <String, dynamic>{}),
        _JsonPanel(title: 'My Notifications (server)', data: myNotificationsSnap.data ?? <dynamic>[]),
        _JsonPanel(title: 'Messages', data: msgSnap.data ?? <dynamic>[]),
        _JsonPanel(title: 'Live Stream', data: live.value),
      ],
    );
  }
}

class _RatingsTab extends HookWidget {
  const _RatingsTab({required this.api});
  final DriverApi api;

  @override
  Widget build(BuildContext context) {
    final targetUserId = useTextEditingController();
    final rideId = useTextEditingController();
    final score = useTextEditingController(text: '5');
    final comment = useTextEditingController();
    final lookupUser = useTextEditingController();
    final reportUserId = useTextEditingController();
    final reportRideId = useTextEditingController();
    final reportReason = useTextEditingController(text: 'unsafe_behaviour');
    final reportDescription = useTextEditingController();
    final lookupResult = useState<Map<String, dynamic>?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getMyRatingSummary(),
        api.listMyRatings(),
        api.listMyReports(),
      ]),
      <Object?>[refresh.value],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snap.hasError) return _ErrorView(error: snap.error);
    final summary = snap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final ratings = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final reports = snap.data?[2] as List<dynamic>? ?? <dynamic>[];

    Future<void> submitRating() async {
      error.value = null;
      try {
        await api.createRating(
          rideId: rideId.text.trim(),
          toUserId: targetUserId.text.trim(),
          score: int.tryParse(score.text.trim()) ?? 5,
          comment: comment.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> lookup() async {
      final id = lookupUser.text.trim();
      if (id.isEmpty) return;
      error.value = null;
      try {
        lookupResult.value = await api.getUserRatingSummary(id);
      } catch (e) {
        error.value = e.toString();
        lookupResult.value = null;
      }
    }

    Future<void> submitReport() async {
      error.value = null;
      try {
        await api.createReport(
          reportedUserId: reportUserId.text.trim(),
          reason: reportReason.text.trim(),
          description: reportDescription.text.trim(),
          rideId: reportRideId.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        _JsonPanel(title: 'My Rating Summary', data: summary),
        _JsonPanel(title: 'Ratings Received', data: ratings),
        const Divider(height: 28),
        const Text('Rate Rider', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: rideId, decoration: const InputDecoration(labelText: 'Ride ID')),
        TextField(controller: targetUserId, decoration: const InputDecoration(labelText: 'Rider user ID')),
        TextField(controller: score, decoration: const InputDecoration(labelText: 'Score (1-5)')),
        TextField(controller: comment, decoration: const InputDecoration(labelText: 'Comment')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submitRating, child: const Text('Submit Rating')),
        const Divider(height: 28),
        const Text('Lookup Rider Rating Summary', style: TextStyle(fontWeight: FontWeight.bold)),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: lookupUser, decoration: const InputDecoration(labelText: 'Rider user ID'))),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: lookup, child: const Text('Fetch')),
          ],
        ),
        if (lookupResult.value != null) _JsonPanel(title: 'Rider Summary', data: lookupResult.value),
        const Divider(height: 28),
        const Text('Report Rider', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: reportUserId, decoration: const InputDecoration(labelText: 'Reported rider user id')),
        TextField(controller: reportRideId, decoration: const InputDecoration(labelText: 'Ride id (optional)')),
        TextField(controller: reportReason, decoration: const InputDecoration(labelText: 'Reason')),
        TextField(controller: reportDescription, decoration: const InputDecoration(labelText: 'Description')),
        ElevatedButton(onPressed: submitReport, child: const Text('Submit Report')),
        _JsonPanel(title: 'My Reports', data: reports),
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
      width: 170,
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
                    subtitle: Text('${notifications.length} total, $unreadCount unread'),
                    trailing: Wrap(
                      spacing: 8,
                      children: <Widget>[
                        TextButton(onPressed: onMarkAllRead, child: const Text('Mark all read')),
                        TextButton(onPressed: onClear, child: const Text('Clear')),
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
                                leading: Icon(item.read ? Icons.notifications_none : Icons.notifications_active),
                                title: Text(item.title),
                                subtitle: Text('${item.body}\n${item.createdAt.toLocal()}'),
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
