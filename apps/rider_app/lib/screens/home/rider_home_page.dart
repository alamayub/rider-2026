import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../providers/providers.dart';
import 'tabs/rider_messages_tab.dart';
import 'tabs/rider_overview_tab.dart';
import 'tabs/rider_parcels_tab.dart';
import 'tabs/rider_payments_tab.dart';
import 'tabs/rider_profile_tab.dart';
import 'tabs/rider_ratings_tab.dart';
import 'tabs/rider_rides_tab.dart';
import '../../widgets/home/rider_notifications_button.dart';

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

    final pages = <Widget>[
      RiderOverviewTab(api: api),
      RiderRidesTab(api: api),
      RiderParcelsTab(api: api),
      RiderPaymentsTab(api: api),
      RiderMessagesTab(api: api),
      RiderRatingsTab(api: api),
      RiderProfileTab(api: api),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rider Console'),
        actions: <Widget>[
          Center(
              child: Text('Rider: ${session.phone}',
                  style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 8),
          RiderNotificationsButton(
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
          NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
