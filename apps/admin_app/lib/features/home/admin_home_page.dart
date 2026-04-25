import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../core/admin_api.dart';
import '../../core/providers.dart';

class AdminHomePage extends HookConsumerWidget {
  const AdminHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tab = useState(0);
    final api = ref.watch(adminApiProvider);
    final session = ref.watch(sessionProvider)!;

    final pages = <Widget>[
      _OverviewTab(api: api),
      _CitiesVehiclesTab(api: api),
      _TrustSafetyTab(api: api),
      _PaymentsTab(api: api),
      _MessagesTab(api: api, selfUserId: session.userId),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Console'),
        actions: <Widget>[
          Center(child: Text('Admin: ${session.phone}', style: const TextStyle(fontSize: 13))),
          const SizedBox(width: 12),
          IconButton(
            onPressed: () => ref.read(sessionProvider.notifier).signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: pages[tab.value],
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab.value,
        onDestinationSelected: (idx) => tab.value = idx,
        destinations: const <NavigationDestination>[
          NavigationDestination(icon: Icon(Icons.dashboard), label: 'Overview'),
          NavigationDestination(icon: Icon(Icons.location_city), label: 'Ops'),
          NavigationDestination(icon: Icon(Icons.verified_user), label: 'Safety'),
          NavigationDestination(icon: Icon(Icons.payments), label: 'Payments'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Messages'),
        ],
      ),
    );
  }
}

class _OverviewTab extends HookWidget {
  const _OverviewTab({required this.api});
  final AdminApi api;

  @override
  Widget build(BuildContext context) {
    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getAdminAnalytics(),
        api.getLiveRides(),
        api.getReports(),
        api.getAuditLogs(),
      ]),
      <Object?>[],
    );
    final snapshot = useFuture(future);
    if (snapshot.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snapshot.hasError) return _ErrorView(error: snapshot.error);
    final data = snapshot.data ?? <dynamic>[];
    final analytics = Map<String, dynamic>.from(data[0] as Map);
    final liveRides = data[1] as List<dynamic>;
    final reports = data[2] as List<dynamic>;
    final logs = data[3] as List<dynamic>;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            _StatCard(title: 'Total Rides', value: '${analytics['totalRides'] ?? 0}'),
            _StatCard(title: 'Total Revenue', value: '${analytics['totalRevenue'] ?? 0}'),
            _StatCard(title: 'Commission', value: '${analytics['totalCommission'] ?? 0}'),
            _StatCard(title: 'Active Drivers', value: '${analytics['activeDrivers'] ?? 0}'),
            _StatCard(title: 'Live Rides', value: '${liveRides.length}'),
            _StatCard(title: 'Open Reports', value: '${reports.length}'),
          ],
        ),
        const SizedBox(height: 16),
        _JsonPanel(title: 'Live Rides', data: liveRides),
        _JsonPanel(title: 'Recent Audit Logs', data: logs),
      ],
    );
  }
}

class _CitiesVehiclesTab extends HookWidget {
  const _CitiesVehiclesTab({required this.api});
  final AdminApi api;

  @override
  Widget build(BuildContext context) {
    final cityController = useTextEditingController();
    final typeIdController = useTextEditingController();
    final typeCodeController = useTextEditingController();
    final typeNameController = useTextEditingController();
    final typeCapacityController = useTextEditingController();
    final typeFareController = useTextEditingController();
    final version = useState(0);
    final loading = useState(false);
    final message = useState<String?>(null);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getCities(),
        api.getVehicleTypes(),
      ]),
      <Object?>[version.value],
    );
    final snapshot = useFuture(future);

    Future<void> addCity() async {
      if (cityController.text.trim().isEmpty) return;
      loading.value = true;
      message.value = null;
      try {
        await api.createCity(cityController.text.trim());
        cityController.clear();
        version.value++;
      } catch (e) {
        message.value = e.toString();
      } finally {
        loading.value = false;
      }
    }

    Future<void> addVehicleType() async {
      loading.value = true;
      message.value = null;
      try {
        await api.createVehicleType(
          id: typeIdController.text.trim(),
          code: typeCodeController.text.trim(),
          name: typeNameController.text.trim(),
          capacity: int.tryParse(typeCapacityController.text.trim()) ?? 4,
          fareMultiplier: double.tryParse(typeFareController.text.trim()) ?? 1.0,
        );
        typeIdController.clear();
        typeCodeController.clear();
        typeNameController.clear();
        typeCapacityController.clear();
        typeFareController.clear();
        version.value++;
      } catch (e) {
        message.value = e.toString();
      } finally {
        loading.value = false;
      }
    }

    if (snapshot.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snapshot.hasError) return _ErrorView(error: snapshot.error);

    final cities = snapshot.data?[0] as List<dynamic>? ?? <dynamic>[];
    final vehicleTypes = snapshot.data?[1] as List<dynamic>? ?? <dynamic>[];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        const Text('Cities', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: cities.map((e) => Chip(label: Text((e as Map)['name'].toString()))).toList(),
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: cityController, decoration: const InputDecoration(labelText: 'New city name'))),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: loading.value ? null : addCity, child: const Text('Add City')),
          ],
        ),
        const Divider(height: 32),
        const Text('Vehicle Types', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        _JsonPanel(title: 'Configured Vehicle Types', data: vehicleTypes),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: typeIdController, decoration: const InputDecoration(labelText: 'id'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: typeCodeController, decoration: const InputDecoration(labelText: 'code'))),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: typeNameController, decoration: const InputDecoration(labelText: 'name'))),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: typeCapacityController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'capacity'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: typeFareController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'fareMultiplier'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: loading.value ? null : addVehicleType, child: const Text('Add Vehicle Type')),
        if (message.value != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(message.value!)),
      ],
    );
  }
}

class _TrustSafetyTab extends HookWidget {
  const _TrustSafetyTab({required this.api});
  final AdminApi api;

  @override
  Widget build(BuildContext context) {
    final selectedStatus = useState<String>('');
    final rejectionController = useTextEditingController();
    final selectedDriverId = useState<String?>(null);
    final reportUserFilter = useTextEditingController();
    final reportReasonFilter = useTextEditingController();
    useListenable(reportUserFilter);
    useListenable(reportReasonFilter);
    final ratingUserIdController = useTextEditingController();
    final ratingSummary = useState<Map<String, dynamic>?>(null);
    final ratingError = useState<String?>(null);
    final version = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getReports(),
        api.listDriverKyc(status: selectedStatus.value.isEmpty ? null : selectedStatus.value),
      ]),
      <Object?>[version.value, selectedStatus.value],
    );
    final snapshot = useFuture(future);
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return _ErrorView(error: snapshot.error);

    final reports = snapshot.data?[0] as List<dynamic>? ?? <dynamic>[];
    final kyc = snapshot.data?[1] as List<dynamic>? ?? <dynamic>[];
    final filteredReports = reports.where((dynamic item) {
      final map = Map<String, dynamic>.from(item as Map);
      final userFilter = reportUserFilter.text.trim();
      final reasonFilter = reportReasonFilter.text.trim().toLowerCase();
      final matchesUser = userFilter.isEmpty || map['reportedUserId'].toString().contains(userFilter);
      final matchesReason = reasonFilter.isEmpty || map['reason'].toString().toLowerCase().contains(reasonFilter);
      return matchesUser && matchesReason;
    }).toList();
    final reportsByReason = <String, int>{};
    for (final report in reports) {
      final reason = (Map<String, dynamic>.from(report as Map)['reason'] ?? 'unknown').toString();
      reportsByReason.update(reason, (v) => v + 1, ifAbsent: () => 1);
    }

    Future<void> review(String action) async {
      final driverId = selectedDriverId.value;
      if (driverId == null || driverId.isEmpty) return;
      await api.reviewDriverKyc(
        driverId: driverId,
        action: action,
        rejectionReason: rejectionController.text.trim(),
      );
      version.value++;
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: reportsByReason.entries
              .map((e) => Chip(label: Text('${e.key}: ${e.value}')))
              .toList(),
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: reportUserFilter,
                decoration: const InputDecoration(labelText: 'Filter by reported user id'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: reportReasonFilter,
                decoration: const InputDecoration(labelText: 'Filter by reason'),
              ),
            ),
          ],
        ),
        _JsonPanel(title: 'Reports (filtered)', data: filteredReports),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            DropdownButton<String>(
              value: selectedStatus.value,
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem(value: '', child: Text('All KYC')),
                DropdownMenuItem(value: 'pending', child: Text('Pending')),
                DropdownMenuItem(value: 'approved', child: Text('Approved')),
                DropdownMenuItem(value: 'rejected', child: Text('Rejected')),
              ],
              onChanged: (v) => selectedStatus.value = v ?? '',
            ),
            const Spacer(),
            Text('KYC records: ${kyc.length}'),
          ],
        ),
        _JsonPanel(title: 'Driver KYC Queue', data: kyc),
        TextField(
          decoration: const InputDecoration(labelText: 'Driver ID to review'),
          onChanged: (v) => selectedDriverId.value = v.trim(),
        ),
        TextField(
          controller: rejectionController,
          decoration: const InputDecoration(labelText: 'Rejection reason (if reject)'),
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            ElevatedButton(onPressed: () => review('approve'), child: const Text('Approve')),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: () => review('reject'), child: const Text('Reject')),
          ],
        ),
        const Divider(height: 28),
        const Text('User Rating Summary Lookup', style: TextStyle(fontWeight: FontWeight.bold)),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: ratingUserIdController,
                decoration: const InputDecoration(labelText: 'Rider/Driver user id'),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () async {
                final userId = ratingUserIdController.text.trim();
                if (userId.isEmpty) return;
                ratingError.value = null;
                try {
                  ratingSummary.value = await api.getUserRatingSummary(userId);
                } catch (e) {
                  ratingSummary.value = null;
                  ratingError.value = e.toString();
                }
              },
              child: const Text('Fetch'),
            ),
          ],
        ),
        if (ratingError.value != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(ratingError.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        if (ratingSummary.value != null) _JsonPanel(title: 'Rating Summary', data: ratingSummary.value),
      ],
    );
  }
}

class _PaymentsTab extends HookWidget {
  const _PaymentsTab({required this.api});
  final AdminApi api;

  @override
  Widget build(BuildContext context) {
    final appScope = useState('admin');
    final methodCode = useTextEditingController();
    final methodName = useTextEditingController();
    final provider = useTextEditingController(text: 'esewa');
    final category = useTextEditingController(text: 'wallet');
    final enabled = useState(true);
    final paymentIdController = useTextEditingController();
    final statusController = useTextEditingController(text: 'succeeded');
    final providerPaymentIdController = useTextEditingController();
    final failureCodeController = useTextEditingController();
    final failureReasonController = useTextEditingController();
    final refundAmountController = useTextEditingController();
    final refundReasonController = useTextEditingController(text: 'customer_requested');
    final refundProviderIdController = useTextEditingController();
    final payoutDriverIdController = useTextEditingController();
    final payoutAmountController = useTextEditingController();
    final payoutCurrencyController = useTextEditingController(text: 'NPR');
    final payoutNoteController = useTextEditingController();
    final operationResult = useState<Object?>(null);
    final operationError = useState<String?>(null);
    final timeline = useState<List<dynamic>>(<dynamic>[]);
    final version = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getPaymentsReconciliation(),
        api.getGroupedPaymentMethods(app: appScope.value),
      ]),
      <Object?>[version.value, appScope.value],
    );
    final snapshot = useFuture(future);
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return _ErrorView(error: snapshot.error);

    final reconciliation = snapshot.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final grouped = snapshot.data?[1] as Map<String, dynamic>? ?? <String, dynamic>{};

    Future<void> upsertMethod() async {
      await api.upsertPaymentMethod(<String, dynamic>{
        'code': methodCode.text.trim(),
        'name': methodName.text.trim(),
        'provider': provider.text.trim(),
        'category': category.text.trim(),
        'enabled': enabled.value,
        'supportedApps': <String>['rider', 'driver', 'admin'],
        'supportedCountries': <String>['np'],
        'supportedCurrencies': <String>['NPR'],
        'displayOrder': 0,
      });
      version.value++;
    }

    Future<void> loadTimeline() async {
      final paymentId = paymentIdController.text.trim();
      if (paymentId.isEmpty) return;
      operationError.value = null;
      try {
        timeline.value = await api.getPaymentTimeline(paymentId);
      } catch (e) {
        operationError.value = e.toString();
      }
    }

    Future<void> updateStatus() async {
      final paymentId = paymentIdController.text.trim();
      if (paymentId.isEmpty) return;
      operationError.value = null;
      try {
        operationResult.value = await api.updatePaymentStatus(
          paymentId: paymentId,
          status: statusController.text.trim(),
          providerPaymentId: providerPaymentIdController.text.trim(),
          failureCode: failureCodeController.text.trim(),
          failureReason: failureReasonController.text.trim(),
        );
        await loadTimeline();
      } catch (e) {
        operationError.value = e.toString();
      }
    }

    Future<void> createRefund() async {
      final paymentId = paymentIdController.text.trim();
      if (paymentId.isEmpty) return;
      operationError.value = null;
      try {
        operationResult.value = await api.createRefund(
          paymentId: paymentId,
          amount: double.tryParse(refundAmountController.text.trim()) ?? 0,
          reason: refundReasonController.text.trim(),
          providerRefundId: refundProviderIdController.text.trim(),
        );
        await loadTimeline();
      } catch (e) {
        operationError.value = e.toString();
      }
    }

    Future<void> createPayout() async {
      final paymentId = paymentIdController.text.trim();
      if (paymentId.isEmpty) return;
      operationError.value = null;
      try {
        operationResult.value = await api.createPayout(
          paymentId: paymentId,
          driverId: payoutDriverIdController.text.trim(),
          amount: double.tryParse(payoutAmountController.text.trim()) ?? 0,
          currency: payoutCurrencyController.text.trim(),
          note: payoutNoteController.text.trim(),
        );
        await loadTimeline();
      } catch (e) {
        operationError.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        _JsonPanel(title: 'Reconciliation', data: reconciliation),
        Row(
          children: <Widget>[
            const Text('Methods for app:'),
            const SizedBox(width: 8),
            DropdownButton<String>(
              value: appScope.value,
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem(value: 'admin', child: Text('admin')),
                DropdownMenuItem(value: 'rider', child: Text('rider')),
                DropdownMenuItem(value: 'driver', child: Text('driver')),
              ],
              onChanged: (v) => appScope.value = v ?? 'admin',
            ),
          ],
        ),
        _JsonPanel(title: 'Grouped Payment Methods', data: grouped),
        const Divider(height: 28),
        const Text('Payment Operations', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: paymentIdController, decoration: const InputDecoration(labelText: 'Payment ID')),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: statusController, decoration: const InputDecoration(labelText: 'Status'))),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: providerPaymentIdController,
                decoration: const InputDecoration(labelText: 'Provider payment id'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: failureCodeController, decoration: const InputDecoration(labelText: 'Failure code'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: failureReasonController, decoration: const InputDecoration(labelText: 'Failure reason'))),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            ElevatedButton(onPressed: updateStatus, child: const Text('Update Status')),
            OutlinedButton(onPressed: loadTimeline, child: const Text('Fetch Timeline')),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: refundAmountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Refund amount'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: refundReasonController, decoration: const InputDecoration(labelText: 'Refund reason'))),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: refundProviderIdController,
                decoration: const InputDecoration(labelText: 'Provider refund id (optional)'),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: createRefund, child: const Text('Create Refund')),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: payoutDriverIdController, decoration: const InputDecoration(labelText: 'Payout driver id'))),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: payoutAmountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Payout amount'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(child: TextField(controller: payoutCurrencyController, decoration: const InputDecoration(labelText: 'Currency'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: payoutNoteController, decoration: const InputDecoration(labelText: 'Payout note'))),
          ],
        ),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: createPayout, child: const Text('Create Payout')),
        if (operationError.value != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(operationError.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        if (operationResult.value != null) _JsonPanel(title: 'Last Operation Result', data: operationResult.value),
        _JsonPanel(title: 'Payment Timeline', data: timeline.value),
        const Divider(height: 28),
        const Text('Create/Update Payment Method', style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(controller: methodCode, decoration: const InputDecoration(labelText: 'Code')),
        TextField(controller: methodName, decoration: const InputDecoration(labelText: 'Name')),
        TextField(controller: provider, decoration: const InputDecoration(labelText: 'Provider')),
        TextField(controller: category, decoration: const InputDecoration(labelText: 'Category')),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Enabled'),
          value: enabled.value,
          onChanged: (v) => enabled.value = v,
        ),
        ElevatedButton(onPressed: upsertMethod, child: const Text('Save Payment Method')),
      ],
    );
  }
}

class _MessagesTab extends HookConsumerWidget {
  const _MessagesTab({required this.api, required this.selfUserId});
  final AdminApi api;
  final String selfUserId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedConversationId = useState<String?>(null);
    final participantController = useTextEditingController();
    final contentController = useTextEditingController();
    final searchController = useTextEditingController();
    useListenable(searchController);
    final refreshFlag = useState(0);
    final liveMessages = useState<List<dynamic>>(<dynamic>[]);
    final socket = ref.watch(socketProvider);

    useEffect(() {
      void onMessage(dynamic payload) {
        liveMessages.value = <dynamic>[...liveMessages.value, payload];
      }

      socket?.on('message:new', onMessage);
      return () {
        socket?.off('message:new', onMessage);
      };
    }, <Object?>[socket]);

    final conversationsFuture = useMemoized(() => api.listConversations(), <Object?>[refreshFlag.value]);
    final conversationsSnap = useFuture(conversationsFuture);
    final filteredConversations = (conversationsSnap.data ?? <dynamic>[]).where((dynamic e) {
      final query = searchController.text.trim().toLowerCase();
      if (query.isEmpty) return true;
      final map = Map<String, dynamic>.from(e as Map);
      final haystack = <String>[
        map['id'].toString(),
        map['participantAId'].toString(),
        map['participantBId'].toString(),
        map['rideId'].toString(),
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();

    final messagesFuture = useMemoized(() {
      final id = selectedConversationId.value;
      if (id == null || id.isEmpty) return Future<List<dynamic>>.value(<dynamic>[]);
      return api.listMessages(id);
    }, <Object?>[selectedConversationId.value, refreshFlag.value]);
    final messagesSnap = useFuture(messagesFuture);

    Future<void> startConversation() async {
      if (participantController.text.trim().isEmpty) return;
      final convo = await api.startConversation(participantUserId: participantController.text.trim());
      final id = (convo['id'] ?? '').toString();
      if (id.isNotEmpty) {
        selectedConversationId.value = id;
        socket?.emit('conversation:join', <String, dynamic>{'conversationId': id});
      }
      refreshFlag.value++;
    }

    Future<void> sendMessage() async {
      final id = selectedConversationId.value;
      if (id == null || id.isEmpty || contentController.text.trim().isEmpty) return;
      await api.sendMessage(conversationId: id, content: contentController.text.trim());
      contentController.clear();
      refreshFlag.value++;
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Text('Socket: ${socket?.connected == true ? 'connected' : 'disconnected'}'),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: participantController,
                decoration: const InputDecoration(labelText: 'Participant user id (rider)'),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: startConversation, child: const Text('Start')),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: searchController,
          decoration: const InputDecoration(
            labelText: 'Search conversations (id, participants, ride)',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 8),
        if (conversationsSnap.hasData)
          DropdownButton<String>(
            value: selectedConversationId.value,
            hint: const Text('Select conversation'),
            isExpanded: true,
            items: filteredConversations.map((dynamic e) {
              final map = Map<String, dynamic>.from(e as Map);
              final id = map['id'].toString();
              return DropdownMenuItem<String>(
                value: id,
                child: Text('$id (${map['participantAId']} ↔ ${map['participantBId']})'),
              );
            }).toList(),
            onChanged: (v) {
              selectedConversationId.value = v;
              if (v != null) {
                socket?.emit('conversation:join', <String, dynamic>{'conversationId': v});
              }
            },
          ),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: contentController,
                decoration: const InputDecoration(labelText: 'Message'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(onPressed: sendMessage, icon: const Icon(Icons.send)),
          ],
        ),
        const SizedBox(height: 8),
        _JsonPanel(title: 'Messages', data: messagesSnap.data ?? <dynamic>[]),
        _JsonPanel(title: 'Live message:new stream', data: liveMessages.value),
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
      width: 180,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Text(value, style: Theme.of(context).textTheme.headlineSmall),
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
