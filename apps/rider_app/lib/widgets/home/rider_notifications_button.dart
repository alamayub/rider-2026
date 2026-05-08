import 'package:flutter/material.dart';

import '../../providers/providers.dart';

class RiderNotificationsButton extends StatelessWidget {
  const RiderNotificationsButton({
    super.key,
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
          builder: (BuildContext context) {
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
                            itemBuilder: (BuildContext context, int index) {
                              final AppNotification item = notifications[index];
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
