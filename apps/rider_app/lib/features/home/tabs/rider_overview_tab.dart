import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../core/rider_api.dart';
import '../widgets/console_widgets.dart';

class RiderOverviewTab extends HookWidget {
  const RiderOverviewTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final Future<List<dynamic>> future = useMemoized(
      () {
        Future<List<dynamic>> load() async {
          final cities = await api.listCities();
          final String? firstCityId = cities.isEmpty
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
    final AsyncSnapshot<List<dynamic>> snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) {
      return RiderErrorView(error: snap.error);
    }
    final Map<String, dynamic> analytics =
        snap.data?[0] as Map<String, dynamic>? ?? <String, dynamic>{};
    final List<dynamic> offers = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final List<dynamic> rides = snap.data?[2] as List<dynamic>? ?? <dynamic>[];
    final List<dynamic> parcels = snap.data?[3] as List<dynamic>? ?? <dynamic>[];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            RiderStatCard(
                title: 'Total Trips', value: '${analytics['totalTrips'] ?? 0}'),
            RiderStatCard(
                title: 'Total Spent', value: '${analytics['totalSpent'] ?? 0}'),
            RiderStatCard(
                title: 'Cancelled',
                value: '${analytics['cancelledTrips'] ?? 0}'),
            RiderStatCard(title: 'Offers', value: '${offers.length}'),
            RiderStatCard(title: 'My Rides', value: '${rides.length}'),
            RiderStatCard(title: 'My Parcels', value: '${parcels.length}'),
          ],
        ),
        const SizedBox(height: 10),
        RiderJsonPanel(title: 'Active Offers', data: offers),
      ],
    );
  }
}
