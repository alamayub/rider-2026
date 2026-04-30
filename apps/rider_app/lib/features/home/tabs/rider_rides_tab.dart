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

/// Preset rider cancellation reasons (API stores the chosen string).
const List<String> kRideCancellationPresets = <String>[
  'Wrong drop point',
  'Wrong vehicle',
  'Wait time too long',
  'Driver not arriving',
  'Changed my plans',
  'Fare or payment issue',
];

const String _kCancellationOtherKey = '__other__';

num? _couponNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  if (v is String) return num.tryParse(v.trim());
  return num.tryParse(v.toString());
}

String _riderCouponDiscountSubtitle(Map<String, dynamic> c) {
  final String type = (c['discountType'] ?? '').toString();
  final num? dv = _couponNum(c['discountValue']);
  final num? maxD = _couponNum(c['maxDiscount']);
  final num minFare = _couponNum(c['minFare']) ?? 0;
  String off;
  if (type == 'percentage') {
    off = '${dv ?? 0}% off';
    if (maxD != null) {
      off += ' (cap ${maxD is int ? maxD.toString() : maxD.toStringAsFixed(0)})';
    }
  } else {
    off = '${dv ?? 0} off';
  }
  return '$off · min fare $minFare';
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

/// Hide “give code to driver” once the ride is cancelled/completed or missing from [rides].
bool _createResultShowsDriverOtp(
  Object? createResultRaw,
  List<dynamic> rides,
) {
  if (createResultRaw == null) return false;
  final Map<String, dynamic> cr =
      Map<String, dynamic>.from(createResultRaw as Map<dynamic, dynamic>);
  if (readRideStartOtp(cr) == null) return false;
  final String id = (cr['id'] ?? '').toString();
  if (id.isEmpty) return true;
  for (final Object? raw in rides) {
    final Map<String, dynamic> m =
        Map<String, dynamic>.from(raw! as Map<dynamic, dynamic>);
    if ((m['id'] ?? '').toString() == id) {
      return !_rideStatusIsTerminal(m['status']);
    }
  }
  return true;
}

Future<String?> _promptCancellationReason(BuildContext context) async {
  final TextEditingController other = TextEditingController();
  try {
    return await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext ctx) {
        String selected =
            kRideCancellationPresets.isNotEmpty ? kRideCancellationPresets.first : _kCancellationOtherKey;
        return StatefulBuilder(
          builder: (BuildContext context, void Function(void Function()) setLocalState) {
            return AlertDialog(
              title: const Text('Cancel ride'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      'Why are you cancelling?',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    ...kRideCancellationPresets.map(
                      (String r) => ListTile(
                        dense: true,
                        title: Text(r),
                        leading: Icon(
                          selected == r
                              ? Icons.radio_button_checked
                              : Icons.radio_button_off,
                        ),
                        onTap: () => setLocalState(() => selected = r),
                      ),
                    ),
                    ListTile(
                      dense: true,
                      title: const Text('Other'),
                      leading: Icon(
                        selected == _kCancellationOtherKey
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                      ),
                      onTap: () =>
                          setLocalState(() => selected = _kCancellationOtherKey),
                    ),
                    if (selected == _kCancellationOtherKey) ...<Widget>[
                      const SizedBox(height: 4),
                      TextField(
                        controller: other,
                        autofocus: true,
                        decoration: const InputDecoration(
                          labelText: 'Describe the reason',
                          hintText: 'At least 3 characters',
                          alignLabelWithHint: true,
                        ),
                        minLines: 2,
                        maxLines: 4,
                        textCapitalization: TextCapitalization.sentences,
                      ),
                    ],
                  ],
                ),
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Back'),
                ),
                FilledButton(
                  onPressed: () {
                    String out;
                    if (selected == _kCancellationOtherKey) {
                      final String t = other.text.trim();
                      if (t.length < 3) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text('Please enter at least 3 characters for Other.'),
                          ),
                        );
                        return;
                      }
                      out = t.length > 500 ? t.substring(0, 500) : t;
                    } else {
                      out = selected;
                    }
                    Navigator.pop(ctx, out);
                  },
                  child: const Text('Confirm cancel'),
                ),
              ],
            );
          },
        );
      },
    );
  } finally {
    other.dispose();
  }
}

Future<void> showRiderCancelRideBottomSheet({
  required BuildContext context,
  required Map<String, dynamic> activeRide,
  required Future<void> Function() confirmCancel,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (BuildContext ctx) {
      final ThemeData theme = Theme.of(ctx);
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 12, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Text(
                  'Cancel current ride',
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Ride #${activeRide['id'] ?? ''} · ${activeRide['status'] ?? ''}',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'You will be asked to pick a cancellation reason. This cannot be undone.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.tonal(
              style: FilledButton.styleFrom(
                foregroundColor: theme.colorScheme.error,
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                await confirmCancel();
              },
              child: const Text('Cancel'),
            ),
          ],
        ),
      );
    },
  );
}

Future<void> showRiderCouponsBottomSheet({
  required BuildContext context,
  required RiderApi api,
  required List<dynamic> rides,
  required TextEditingController rideIdController,
  required TextEditingController couponCode,
  required double fare,
  required Future<void> Function(String code) onValidateCoupon,
  required Future<void> Function(String code) onApplyCoupon,
  required Future<void> Function() onGetRideDetail,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (BuildContext ctx) {
      return _RiderCouponsBottomSheetBody(
        api: api,
        rides: rides,
        rideIdController: rideIdController,
        couponCode: couponCode,
        fare: fare,
        onValidateCoupon: onValidateCoupon,
        onApplyCoupon: onApplyCoupon,
        onGetRideDetail: onGetRideDetail,
      );
    },
  );
}

class _RiderCouponsBottomSheetBody extends StatefulWidget {
  const _RiderCouponsBottomSheetBody({
    required this.api,
    required this.rides,
    required this.rideIdController,
    required this.couponCode,
    required this.fare,
    required this.onValidateCoupon,
    required this.onApplyCoupon,
    required this.onGetRideDetail,
  });

  final RiderApi api;
  final List<dynamic> rides;
  final TextEditingController rideIdController;
  final TextEditingController couponCode;
  final double fare;
  final Future<void> Function(String code) onValidateCoupon;
  final Future<void> Function(String code) onApplyCoupon;
  final Future<void> Function() onGetRideDetail;

  @override
  State<_RiderCouponsBottomSheetBody> createState() =>
      _RiderCouponsBottomSheetBodyState();
}

class _RiderCouponsBottomSheetBodyState
    extends State<_RiderCouponsBottomSheetBody> {
  late Future<List<dynamic>> _load;
  String? _selectedCode;
  bool _busy = false;
  final TextEditingController _rideSearch = TextEditingController();
  final TextEditingController _couponSearch = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load = widget.api.listAvailableCoupons();
    widget.rideIdController.addListener(_onRideIdChanged);
  }

  @override
  void dispose() {
    widget.rideIdController.removeListener(_onRideIdChanged);
    _rideSearch.dispose();
    _couponSearch.dispose();
    super.dispose();
  }

  void _onRideIdChanged() {
    setState(() {});
  }

  void _selectCoupon(String code) {
    setState(() {
      _selectedCode = code;
      widget.couponCode.text = code;
    });
  }

  void _selectRide(String id) {
    widget.rideIdController.text = id;
    setState(() {});
  }

  void _retryLoad() {
    setState(() {
      _load = widget.api.listAvailableCoupons();
    });
  }

  List<Map<String, dynamic>> _filteredRides() {
    final String q = _rideSearch.text.trim().toLowerCase();
    final List<Map<String, dynamic>> out = <Map<String, dynamic>>[];
    for (final Object? raw in widget.rides) {
      final Map<String, dynamic> m =
          Map<String, dynamic>.from(raw! as Map<dynamic, dynamic>);
      final String id = (m['id'] ?? '').toString();
      if (id.isEmpty) continue;
      final String st = (m['status'] ?? '').toString().toLowerCase();
      if (q.isEmpty || id.toLowerCase().contains(q) || st.contains(q)) {
        out.add(m);
      }
    }
    out.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final String idA = (a['id'] ?? '').toString();
      final String idB = (b['id'] ?? '').toString();
      return idB.compareTo(idA);
    });
    return out;
  }

  List<Map<String, dynamic>> _filterCoupons(List<dynamic> list) {
    final String q = _couponSearch.text.trim().toLowerCase();
    if (q.isEmpty) {
      return list
          .map((dynamic e) => Map<String, dynamic>.from(e! as Map))
          .toList();
    }
    final List<Map<String, dynamic>> out = <Map<String, dynamic>>[];
    for (final Object? raw in list) {
      final Map<String, dynamic> c =
          Map<String, dynamic>.from(raw! as Map);
      final String code = (c['code'] ?? '').toString();
      if (code.isEmpty) continue;
      final String sub = _riderCouponDiscountSubtitle(c).toLowerCase();
      if (code.toLowerCase().contains(q) || sub.contains(q)) {
        out.add(c);
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final double inset = MediaQuery.viewInsetsOf(context).bottom;
    final double sheetH = MediaQuery.sizeOf(context).height * 0.72;
    final ThemeData theme = Theme.of(context);
    final String rideIdTrim = widget.rideIdController.text.trim();
    final List<Map<String, dynamic>> rideRows = _filteredRides();

    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: SizedBox(
        height: sheetH,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
              child: Row(
                children: <Widget>[
                  Text(
                    'Coupons',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                controller: _rideSearch,
                decoration: InputDecoration(
                  labelText: 'Search your rides',
                  hintText: 'Id or status (for apply & detail)',
                  isDense: true,
                  border: const OutlineInputBorder(),
                  prefixIcon:
                      const Icon(Icons.directions_car_outlined, size: 22),
                  suffixIcon: _rideSearch.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 20),
                          onPressed: () {
                            _rideSearch.clear();
                            setState(() {});
                          },
                        )
                      : null,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            SizedBox(
              height: 132,
              child: widget.rides.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'No rides loaded yet.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      itemCount: rideRows.length,
                      itemBuilder: (BuildContext ctx, int i) {
                        final Map<String, dynamic> m = rideRows[i];
                        final String id = (m['id'] ?? '').toString();
                        final String st = (m['status'] ?? '').toString();
                        final bool sel = rideIdTrim == id;
                        return ListTile(
                          dense: true,
                          visualDensity: VisualDensity.compact,
                          selected: sel,
                          title: Text(
                            '#$id',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(st),
                          onTap: () => _selectRide(id),
                        );
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: TextField(
                controller: _couponSearch,
                decoration: InputDecoration(
                  labelText: 'Search coupons',
                  hintText: 'Code or discount',
                  isDense: true,
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.search, size: 22),
                  suffixIcon: _couponSearch.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 20),
                          onPressed: () {
                            _couponSearch.clear();
                            setState(() {});
                          },
                        )
                      : null,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
              child: Text(
                widget.fare > 0
                    ? 'Fare for validation: ${widget.fare.toStringAsFixed(0)}'
                    : 'Estimate a fare first for meaningful validation.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: FutureBuilder<List<dynamic>>(
                future: _load,
                builder: (BuildContext ctx, AsyncSnapshot<List<dynamic>> snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            Text(
                              'Could not load coupons',
                              style: theme.textTheme.titleSmall,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              snap.error.toString(),
                              style: theme.textTheme.bodySmall,
                              textAlign: TextAlign.center,
                            ),
                            TextButton(
                              onPressed: _retryLoad,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }
                  final List<dynamic> rawList =
                      snap.data ?? const <dynamic>[];
                  if (rawList.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'No coupons available right now.',
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    );
                  }
                  final List<Map<String, dynamic>> list =
                      _filterCoupons(rawList);
                  if (list.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'No coupons match your search.',
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    );
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    itemCount: list.length,
                    itemBuilder: (BuildContext ctx, int i) {
                      final Map<String, dynamic> c = list[i];
                      final String code = (c['code'] ?? '').toString();
                      if (code.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      final bool sel = _selectedCode == code;
                      return Card(
                        margin: const EdgeInsets.only(
                          bottom: 8,
                          left: 8,
                          right: 8,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: sel
                              ? BorderSide(
                                  color: theme.colorScheme.primary,
                                  width: 2,
                                )
                              : BorderSide.none,
                        ),
                        child: ListTile(
                          onTap: () => _selectCoupon(code),
                          leading: Icon(
                            sel
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            color: sel
                                ? theme.colorScheme.primary
                                : theme.colorScheme.onSurfaceVariant,
                          ),
                          title: Text(
                            code,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(_riderCouponDiscountSubtitle(c)),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.end,
                children: <Widget>[
                  ElevatedButton(
                    onPressed: _busy || _selectedCode == null
                        ? null
                        : () async {
                            setState(() => _busy = true);
                            try {
                              await widget.onValidateCoupon(_selectedCode!);
                            } finally {
                              if (mounted) {
                                setState(() => _busy = false);
                              }
                            }
                          },
                    child: const Text('Validate'),
                  ),
                  OutlinedButton(
                    onPressed: _busy ||
                            _selectedCode == null ||
                            rideIdTrim.isEmpty
                        ? null
                        : () async {
                            setState(() => _busy = true);
                            try {
                              await widget.onApplyCoupon(_selectedCode!);
                            } finally {
                              if (mounted) {
                                setState(() => _busy = false);
                              }
                            }
                          },
                    child: const Text('Apply to ride'),
                  ),
                  OutlinedButton.icon(
                    onPressed:
                        _busy || rideIdTrim.isEmpty ? null : () async {
                            setState(() => _busy = true);
                            try {
                              await widget.onGetRideDetail();
                            } finally {
                              if (mounted) {
                                setState(() => _busy = false);
                              }
                            }
                          },
                    icon: const Icon(Icons.info_outline, size: 18),
                    label: const Text('Ride detail'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
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
    final TextEditingController couponCode =
        useTextEditingController();
    final selectedCityId = useState<String?>(null);
    final resolvedCityLabel = useState<String?>(null);
    final selectedVehicleTypeId = useState<String?>(null);
    final estimatedAmount = useState<double>(0);
    final fareEstimateOptions = useState<List<dynamic>?>(null);
    final createResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final Future<List<dynamic>> future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[api.listMyRides()]),
      <Object?>[refresh.value],
    );
    final AsyncSnapshot<List<dynamic>> snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) {
      return RiderErrorView(error: snap.error);
    }
    final List<dynamic> rides = snap.data?[0] as List<dynamic>? ?? <dynamic>[];

    final String cityId = selectedCityId.value?.trim() ?? '';
    final String vtId = selectedVehicleTypeId.value?.trim() ?? '';
    final Map<String, dynamic>? activeRide = _activeRideFromList(rides);

    Future<void> estimate() async {
      if (cityId.isEmpty) {
        error.value = 'Set pickup and drop-off on the map first.';
        return;
      }
      error.value = null;
      try {
        final Map<String, dynamic> result =
            await api.estimateRideFareOptions(<String, dynamic>{
          'cityId': cityId,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
        });
        final List<dynamic> opts =
            (result['options'] as List<dynamic>?) ?? <dynamic>[];
        fareEstimateOptions.value = opts;
        if (opts.isEmpty) {
          estimatedAmount.value = 0;
          selectedVehicleTypeId.value = null;
          return;
        }
        selectedVehicleTypeId.value = null;
        estimatedAmount.value = 0;
      } catch (e) {
        error.value = e.toString();
        fareEstimateOptions.value = null;
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
      final String cc = couponCode.text.trim();
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

    Future<void> validateCoupon({String? code}) async {
      final String c = (code ?? couponCode.text).trim();
      if (c.isEmpty) return;
      error.value = null;
      try {
        await api.validateCoupon(
          code: c,
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

    Future<void> applyCoupon({String? code}) async {
      final String c = (code ?? couponCode.text).trim();
      if (c.isEmpty) return;
      error.value = null;
      try {
        await api.applyCoupon(
          code: c,
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
        await api.getRideById(rideId);
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
        await api.updateRideStatus(id, 'cancelled', cancellationReason: reason);
        rideIdController.text = id;
        final Object? cr = createResult.value;
        if (cr is Map && (cr['id'] ?? '').toString() == id) {
          createResult.value = null;
        }
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

    final Widget listBody = ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.location_city_outlined),
          title: const Text('Service area'),
          subtitle: Text(
            cityId.isEmpty
                ? 'Set pickup on the map; we detect the city from that location.'
                : (resolvedCityLabel.value?.isNotEmpty == true
                    ? resolvedCityLabel.value!
                    : cityId),
          ),
        ),
        const SizedBox(height: 4),
        FilledButton.tonalIcon(
          onPressed: activeRide == null
              ? () async {
                  final BookingMapResult? r = await showBookingMapSheet(
                    context: context,
                    api: api,
                    kind: BookingMapKind.ride,
                  );
                  if (r == null) return;
                  final String? prevCity = selectedCityId.value?.trim();
                  plLat.text = r.pickup.latitude.toStringAsFixed(5);
                  plLng.text = r.pickup.longitude.toStringAsFixed(5);
                  drLat.text = r.drop.latitude.toStringAsFixed(5);
                  drLng.text = r.drop.longitude.toStringAsFixed(5);
                  distance.text = r.distanceKm.toStringAsFixed(2);
                  selectedCityId.value = r.cityId;
                  resolvedCityLabel.value = r.cityName;
                  if (prevCity != r.cityId) {
                    fareEstimateOptions.value = null;
                    selectedVehicleTypeId.value = null;
                    estimatedAmount.value = 0;
                  }
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
                onPressed: estimate,
                child: const Text('Estimate fares (all vehicles)')),
            OutlinedButton(
                onPressed: activeRide == null ? doCreateRide : null,
                child: const Text('Request ride')),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 4),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              if (activeRide != null)
                OutlinedButton.icon(
                  onPressed: () => showRiderCancelRideBottomSheet(
                    context: context,
                    activeRide: activeRide,
                    confirmCancel: promptAndCancelActiveRide,
                  ),
                  icon: const Icon(Icons.cancel_outlined),
                  label: const Text('Cancel ride'),
                ),
              OutlinedButton.icon(
                onPressed: () => showRiderCouponsBottomSheet(
                  context: context,
                  api: api,
                  rides: rides,
                  rideIdController: rideIdController,
                  couponCode: couponCode,
                  fare: estimatedAmount.value,
                  onValidateCoupon: (String code) => validateCoupon(code: code),
                  onApplyCoupon: (String code) => applyCoupon(code: code),
                  onGetRideDetail: getRideDetail,
                ),
                icon: const Icon(Icons.local_offer_outlined),
                label: const Text('Coupons'),
              ),
            ],
          ),
        ),
        if (_createResultShowsDriverOtp(createResult.value, rides)) ...<Widget>[
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
        if (fareEstimateOptions.value != null &&
            fareEstimateOptions.value!.isNotEmpty) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            'Fares by vehicle type',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: fareEstimateOptions.value!.map((dynamic raw) {
                final Map<String, dynamic> o =
                    Map<String, dynamic>.from(raw as Map);
                final String vid = o['vehicleTypeId']?.toString() ?? '';
                final String name = o['name']?.toString() ?? vid;
                final int amt = (o['amount'] as num?)?.round() ?? 0;
                final bool sel = vtId == vid;
                return ListTile(
                  dense: true,
                  selected: sel,
                  title: Text(name),
                  subtitle: Text('Multiplier × ${o['fareMultiplier']}'),
                  trailing: Text(
                    '$amt',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  onTap: () {
                    selectedVehicleTypeId.value = vid;
                    estimatedAmount.value =
                        (o['amount'] as num?)?.toDouble() ?? 0;
                  },
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
        ],
        Text('Selected vehicle fare: ${estimatedAmount.value}'),
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

    return listBody;
  }
}
