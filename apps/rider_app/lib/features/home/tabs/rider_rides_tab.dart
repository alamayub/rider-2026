import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../core/booking_payloads.dart';
import '../../../core/rider_api.dart';
import '../../booking/booking_map_sheet.dart';
import '../widgets/console_widgets.dart';
import 'rider_my_rides_list.dart';

bool _rideStatusIsTerminal(Object? status) {
  final String s = (status ?? '').toString().toLowerCase();
  return s == 'completed' || s == 'cancelled';
}

Map<String, dynamic>? _activeRideFromList(List<dynamic> rides) {
  for (final Object? raw in rides) {
    final Map<String, dynamic> m =
        Map<String, dynamic>.from(raw! as Map<dynamic, dynamic>);
    if (!_rideStatusIsTerminal(m['status'])) {
      return m;
    }
  }
  return null;
}

Future<String?> _promptCancellationReason(BuildContext context) async {
  final TextEditingController c = TextEditingController();
  try {
    return await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext ctx) {
        return AlertDialog(
          title: const Text('Cancel ride'),
          content: TextField(
            controller: c,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Why are you cancelling?',
              hintText: 'At least 3 characters',
              alignLabelWithHint: true,
            ),
            minLines: 2,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Back'),
            ),
            FilledButton(
              onPressed: () {
                final String t = c.text.trim();
                if (t.length < 3) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(
                      content: Text('Please enter at least 3 characters.'),
                    ),
                  );
                  return;
                }
                final String clipped = t.length > 500 ? t.substring(0, 500) : t;
                Navigator.pop(ctx, clipped);
              },
              child: const Text('Confirm cancel'),
            ),
          ],
        );
      },
    );
  } finally {
    c.dispose();
  }
}

class RiderRidesTab extends HookWidget {
  const RiderRidesTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final TextEditingController plLat =
        useTextEditingController(text: '12.97160');
    final TextEditingController plLng =
        useTextEditingController(text: '77.59460');
    final TextEditingController drLat =
        useTextEditingController(text: '12.95000');
    final TextEditingController drLng =
        useTextEditingController(text: '77.58000');
    final TextEditingController distance =
        useTextEditingController(text: '5');
    final TextEditingController rideIdController =
        useTextEditingController();
    final TextEditingController rideStatusOtp =
        useTextEditingController();
    final TextEditingController statusLine =
        useTextEditingController(text: 'cancelled');
    final TextEditingController cancelReasonManual =
        useTextEditingController();
    final TextEditingController couponCode =
        useTextEditingController();
    final TextEditingController createCoupon =
        useTextEditingController();
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

    final Future<List<dynamic>> future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.listCities(),
        api.listVehicleTypes(),
        api.listMyRides()
      ]),
      <Object?>[refresh.value],
    );
    final AsyncSnapshot<List<dynamic>> snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) {
      return RiderErrorView(error: snap.error);
    }
    final List<dynamic> cities = snap.data?[0] as List<dynamic>? ?? <dynamic>[];
    final List<dynamic> vehicleTypes =
        snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final List<dynamic> rides = snap.data?[2] as List<dynamic>? ?? <dynamic>[];

    useEffect(
      () {
        if (selectedCityId.value == null && cities.isNotEmpty) {
          final Map<String, dynamic> first =
              Map<String, dynamic>.from(cities.first as Map);
          selectedCityId.value =
              (first['id'] ?? first['code'] ?? '').toString();
        }
        if (selectedVehicleTypeId.value == null &&
            vehicleTypes.isNotEmpty) {
          final Map<String, dynamic> vt =
              Map<String, dynamic>.from(vehicleTypes.first as Map);
          selectedVehicleTypeId.value =
              (vt['id'] ?? vt['code'] ?? '').toString();
        }
        return null;
      },
      <Object?>[cities.length, vehicleTypes.length, snap.data],
    );

    final String cityId = selectedCityId.value?.trim() ?? '';
    final String vtId = selectedVehicleTypeId.value?.trim() ?? '';
    final Map<String, dynamic>? activeRide = _activeRideFromList(rides);

    Future<void> estimate() async {
      if (cityId.isEmpty || vtId.isEmpty) {
        error.value = 'Select a city and vehicle type';
        return;
      }
      error.value = null;
      try {
        final Map<String, dynamic> result =
            await api.estimateRideFare(<String, dynamic>{
          'cityId': cityId,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'vehicleTypeId': vtId,
        });
        final double amt = readEstimateAmount(result) ?? 0;
        estimatedAmount.value = amt;
        estimateJson.value = result;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> doCreateRide() async {
      if (activeRide != null) {
        error.value =
            'You already have an active ride. Cancel it or wait until it finishes before requesting another.';
        return;
      }
      if (cityId.isEmpty || vtId.isEmpty) {
        error.value = 'Select a city and vehicle type';
        return;
      }
      error.value = null;
      final Map<String, double> pickup = geoPoint(
          double.tryParse(plLat.text.trim()) ?? 0,
          double.tryParse(plLng.text.trim()) ?? 0);
      final Map<String, double> drop = geoPoint(
          double.tryParse(drLat.text.trim()) ?? 0,
          double.tryParse(drLng.text.trim()) ?? 0);
      final String cc = createCoupon.text.trim();
      try {
        final Map<String, dynamic> result =
            await api.createRide(<String, dynamic>{
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
      final String rideId = rideIdController.text.trim();
      if (rideId.isEmpty) return;
      error.value = null;
      try {
        rideDetail.value = await api.getRideById(rideId);
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> postRideStatus() async {
      final String rideId = rideIdController.text.trim();
      if (rideId.isEmpty) {
        error.value = 'Enter a ride id';
        return;
      }
      error.value = null;
      final String otp = rideStatusOtp.text.trim();
      final String st = statusLine.text.trim();
      try {
        if (st == 'cancelled') {
          final String r = cancelReasonManual.text.trim();
          if (r.length < 3) {
            error.value =
                'Enter a cancellation reason (3+ characters) when status is cancelled.';
            return;
          }
          statusResult.value = await api.updateRideStatus(
            rideId,
            st,
            cancellationReason: r,
          );
        } else {
          statusResult.value = await api.updateRideStatus(
            rideId,
            st,
            otp: otp.isEmpty ? null : otp,
          );
        }
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> promptAndCancelActiveRide() async {
      if (activeRide == null) return;
      final String id = (activeRide['id'] ?? '').toString();
      if (id.isEmpty) return;
      final String? reason = await _promptCancellationReason(context);
      if (reason == null) return;
      error.value = null;
      try {
        statusResult.value =
            await api.updateRideStatus(id, 'cancelled', cancellationReason: reason);
        rideIdController.text = id;
        refresh.value++;
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Ride cancelled.')),
          );
        }
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
              final Map<String, dynamic> m =
                  Map<String, dynamic>.from(c as Map);
              final String id = (m['id'] ?? m['code'] ?? '').toString();
              final String name = (m['name'] ?? m['code'] ?? id).toString();
              return DropdownMenuItem<String>(value: id, child: Text(name));
            }).toList(),
            onChanged: (String? v) {
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
              final Map<String, dynamic> m =
                  Map<String, dynamic>.from(v as Map);
              final String id = (m['id'] ?? m['code'] ?? '').toString();
              final String name = (m['name'] ?? m['code'] ?? id).toString();
              return DropdownMenuItem<String>(value: id, child: Text(name));
            }).toList(),
            onChanged: (String? v) {
              if (v != null) {
                selectedVehicleTypeId.value = v;
              }
            },
          ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: activeRide == null
              ? () async {
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
                }
              : null,
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
        if (activeRide != null) ...<Widget>[
          Card(
            color: Theme.of(context).colorScheme.errorContainer,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    'Active ride in progress',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onErrorContainer,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Ride #${activeRide['id'] ?? ''} — status: ${activeRide['status'] ?? ''}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onErrorContainer,
                        ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'You cannot request another ride until this one is completed or cancelled.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onErrorContainer,
                        ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: promptAndCancelActiveRide,
                    child: const Text('Cancel this ride…'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: estimate, child: const Text('Estimate fare')),
            OutlinedButton(
                onPressed: activeRide == null ? doCreateRide : null,
                child: const Text('Request ride')),
          ],
        ),
        if (createResult.value != null) ...<Widget>[
          Builder(
            builder: (BuildContext context) {
              final Map<String, dynamic> cr = Map<String, dynamic>.from(
                  createResult.value! as Map<dynamic, dynamic>);
              final String? otp = readRideStartOtp(cr);
              if (otp == null) return const SizedBox.shrink();
              final ColorScheme scheme = Theme.of(context).colorScheme;
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
          RiderJsonPanel(title: 'Estimate response', data: estimateJson.value),
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
          controller: cancelReasonManual,
          decoration: const InputDecoration(
            labelText: 'Cancellation reason (required if status is cancelled)',
            hintText: 'At least 3 characters',
          ),
          minLines: 1,
          maxLines: 3,
        ),
        TextField(
            controller: rideStatusOtp,
            decoration: const InputDecoration(
                labelText: 'Start OTP (required if status = in_progress)')),
        OutlinedButton(
            onPressed: postRideStatus, child: const Text('POST status')),
        if (couponResult.value != null)
          RiderJsonPanel(title: 'Coupon', data: couponResult.value),
        if (rideDetail.value != null)
          RiderJsonPanel(title: 'Ride detail', data: rideDetail.value),
        if (statusResult.value != null)
          RiderJsonPanel(title: 'Status update', data: statusResult.value),
        if (createResult.value != null)
          RiderJsonPanel(title: 'Create ride', data: createResult.value),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        RiderMyRidesSection(
          rides: rides,
          onUseRideId: (String id) {
            rideIdController.text = id;
          },
        ),
      ],
    );
  }
}
