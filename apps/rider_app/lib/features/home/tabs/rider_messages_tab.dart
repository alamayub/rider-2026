import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/rider_api.dart';

class RiderMessagesTab extends HookConsumerWidget {
  const RiderMessagesTab({super.key, required this.api});

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

    final supportMsgFuture = useMemoized(() {
      final id = supportConvId.value;
      if (id == null || id.isEmpty) {
        return Future<List<dynamic>>.value(<dynamic>[]);
      }
      return api.listMessages(id);
    }, <Object?>[supportConvId.value, refresh.value]);
    final supportMsgSnap = useFuture(supportMsgFuture);

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
      ],
    );
  }
}
