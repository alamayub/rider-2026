import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../config/enums.dart';
import '../../services/rider_api.dart';
import '../../utils/geo_utils.dart';

/// Pickup (green) and drop-off (red) pins on the map — high contrast on OSM tiles.
const Color _kBookingPickupPin = Color(0xFF2E7D32);
const Color _kBookingDropPin = Color(0xFFC62828);

class BookingMapResult {
  const BookingMapResult({
    required this.pickup,
    required this.drop,
    required this.cityId,
    required this.distanceKm,
    required this.cityName,
  });

  final LatLng pickup;
  final LatLng drop;
  final String cityId;
  final double distanceKm;
  final String cityName;
}

/// Uber-style pickup / drop selection: search fields, map tap, current location, auto city from backend.
Future<BookingMapResult?> showBookingMapSheet({
  required BuildContext context,
  required RiderApi api,
  required BookingMapKind kind,
}) {
  return showModalBottomSheet<BookingMapResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    barrierColor: Colors.black54,
    builder: (BuildContext ctx) {
      return FractionallySizedBox(
        heightFactor: 0.92,
        child: _BookingMapBody(api: api, kind: kind),
      );
    },
  );
}

class _BookingMapBody extends HookWidget {
  const _BookingMapBody({required this.api, required this.kind});

  final RiderApi api;
  final BookingMapKind kind;

  static const LatLng _fallbackCenter = LatLng(12.9716, 77.5946);

  @override
  Widget build(BuildContext context) {
    late Future<void> Function() initPickupFromGpsOrFallback;
    late Future<void> Function() trySetDefaultPickupFromGps;
    late Future<void> Function() bootstrapMap;
    late Future<void> Function() resolvePickupCity;
    late Future<void> Function(LatLng point, {required bool forPickup}) applyReverseLabel;
    late Future<void> Function(String q) runPickupSearch;
    late Future<void> Function(String q) runDropSearch;
    late void Function(String query) schedulePickupSearch;
    late void Function(String query) scheduleDropSearch;
    late void Function(Map<String, dynamic> m) applyPickupPlace;
    late void Function(Map<String, dynamic> m) applyDropPlace;
    late Future<void> Function() useCurrentLocation;
    late void Function(TapPosition _, LatLng point) onMapTap;
    late void Function() confirm;

    final MapController mapController = useMemoized(MapController.new, const <Object>[]);
    useEffect(() {
      return () {
        mapController.dispose();
      };
    }, <Object>[mapController]);

    final TextEditingController pickupField = useTextEditingController();
    final TextEditingController dropField = useTextEditingController();
    final FocusNode pickupFocus = useFocusNode();
    final FocusNode dropFocus = useFocusNode();
    final LayerLink pickupLayerLink = useMemoized(LayerLink.new, const <Object>[]);
    final LayerLink dropLayerLink = useMemoized(LayerLink.new, const <Object>[]);

    final ObjectRef<Timer?> pickupSearchDebounce = useRef<Timer?>(null);
    final ObjectRef<Timer?> dropSearchDebounce = useRef<Timer?>(null);

    useEffect(() {
      return () {
        pickupSearchDebounce.value?.cancel();
        dropSearchDebounce.value?.cancel();
      };
    }, const <Object>[]);

    final pickup = useState<LatLng?>(null);
    final drop = useState<LatLng?>(null);
    final editingPickup = useState<bool>(true);
    final pickupSuggestions = useState<List<Map<String, dynamic>>>(<Map<String, dynamic>>[]);
    final dropSuggestions = useState<List<Map<String, dynamic>>>(<Map<String, dynamic>>[]);
    final searchingPickup = useState<bool>(false);
    final searchingDrop = useState<bool>(false);
    final serviceCity = useState<Map<String, dynamic>?>(null);
    final pickupServiceError = useState<String?>(null);
    final locationError = useState<String?>(null);
    final resolving = useState<bool>(false);
    final locating = useState<bool>(false);
    final roadRoute = useState<List<LatLng>?>(null);
    final roadRouteKm = useState<double?>(null);
    final routingBusy = useState<bool>(false);

    useEffect(() {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(initPickupFromGpsOrFallback());
      });
      return null;
    }, <Object>[api]);

    useEffect(() {
      final double? plat = pickup.value?.latitude;
      final double? plng = pickup.value?.longitude;
      final double? dlat = drop.value?.latitude;
      final double? dlng = drop.value?.longitude;
      if (plat == null || plng == null || dlat == null || dlng == null) {
        roadRoute.value = null;
        roadRouteKm.value = null;
        routingBusy.value = false;
        return null;
      }
      if ((plat - dlat).abs() < 1e-7 && (plng - dlng).abs() < 1e-7) {
        roadRoute.value = null;
        roadRouteKm.value = null;
        routingBusy.value = false;
        return null;
      }
      roadRoute.value = null;
      roadRouteKm.value = null;
      final LatLng from = LatLng(plat, plng);
      final LatLng to = LatLng(dlat, dlng);
      bool cancelled = false;
      final Timer routeTimer = Timer(const Duration(milliseconds: 400), () async {
        if (cancelled) return;
        routingBusy.value = true;
        try {
          RiderDrivingRoute? r;
          try {
            r = await api.getDrivingRoutePreview(
              pickupLat: from.latitude,
              pickupLng: from.longitude,
              dropLat: to.latitude,
              dropLng: to.longitude,
            );
          } catch (_) {
            r = null;
          }
          if (cancelled || !context.mounted) return;
          final LatLng? p2 = pickup.value;
          final LatLng? d2 = drop.value;
          if (p2 == null || d2 == null) return;
          if ((p2.latitude - plat).abs() > 1e-6 ||
              (p2.longitude - plng).abs() > 1e-6 ||
              (d2.latitude - dlat).abs() > 1e-6 ||
              (d2.longitude - dlng).abs() > 1e-6) {
            return;
          }
          if (r != null) {
            roadRoute.value = r.points;
            roadRouteKm.value = r.distanceKm;
          } else {
            roadRoute.value = null;
            roadRouteKm.value = null;
          }
        } finally {
          if (!cancelled && context.mounted) {
            routingBusy.value = false;
          }
        }
      });
      return () {
        cancelled = true;
        routeTimer.cancel();
      };
    }, <Object?>[
      pickup.value?.latitude,
      pickup.value?.longitude,
      drop.value?.latitude,
      drop.value?.longitude,
    ]);

    String shortCoordLabel(LatLng p) =>
        '${p.latitude.toStringAsFixed(5)}, ${p.longitude.toStringAsFixed(5)}';

    bool sameLatLng(LatLng? a, LatLng b) {
      if (a == null) return false;
      return (a.latitude - b.latitude).abs() < 1e-7 && (a.longitude - b.longitude).abs() < 1e-7;
    }

    resolvePickupCity = () async {
      final LatLng? p = pickup.value;
      if (p == null) return;
      resolving.value = true;
      pickupServiceError.value = null;
      serviceCity.value = null;
      try {
        final Map<String, dynamic>? resolved =
            await api.tryResolveCity(lat: p.latitude, lng: p.longitude);
        if (!context.mounted) return;
        if (resolved == null) {
          serviceCity.value = null;
          pickupServiceError.value =
              'We are not here yet. Try moving the pickup pin into the shaded service area or search for an address inside our coverage.';
          resolving.value = false;
          return;
        }
        serviceCity.value = resolved;
        pickupServiceError.value = null;
        resolving.value = false;
      } on DioException catch (e) {
        if (!context.mounted) return;
        resolving.value = false;
        pickupServiceError.value = e.message ?? 'Could not check service area.';
      } catch (e) {
        if (!context.mounted) return;
        resolving.value = false;
        pickupServiceError.value = e.toString();
      }
    };

    applyReverseLabel = (LatLng point, {required bool forPickup}) async {
      try {
        final String label =
            await api.reversePlaceLabel(lat: point.latitude, lng: point.longitude);
        if (!context.mounted) return;
        final String t = label.trim();
        if (t.isEmpty) {
          if (forPickup && sameLatLng(pickup.value, point)) {
            pickupField.text = shortCoordLabel(point);
          } else if (!forPickup && sameLatLng(drop.value, point)) {
            dropField.text = shortCoordLabel(point);
          }
          return;
        }
        if (forPickup && sameLatLng(pickup.value, point)) {
          pickupField.text = t;
        } else if (!forPickup && sameLatLng(drop.value, point)) {
          dropField.text = t;
        }
      } catch (_) {
        if (!context.mounted) return;
        if (forPickup && sameLatLng(pickup.value, point)) {
          pickupField.text = shortCoordLabel(point);
        } else if (!forPickup && sameLatLng(drop.value, point)) {
          dropField.text = shortCoordLabel(point);
        }
      }
    };

    bootstrapMap = () async {
      try {
        final List<dynamic> cities = await api.listCities();
        final List<Map<String, dynamic>> withCenter = cities
            .cast<Map>()
            .map((dynamic e) => Map<String, dynamic>.from(e))
            .where((Map<String, dynamic> m) {
          return m['centerLat'] != null && m['centerLng'] != null;
        }).toList();
        if (withCenter.isNotEmpty && context.mounted) {
          final Map<String, dynamic> first = withCenter.first;
          final LatLng c = LatLng(
            (first['centerLat'] as num).toDouble(),
            (first['centerLng'] as num).toDouble(),
          );
          mapController.move(c, 12);
        } else if (context.mounted) {
          mapController.move(_fallbackCenter, 12);
        }
      } catch (_) {
        if (context.mounted) {
          mapController.move(_fallbackCenter, 12);
        }
      }
    };

    trySetDefaultPickupFromGps = () async {
      try {
        final PermissionStatus whenInUse = await Permission.locationWhenInUse.request();
        if (!whenInUse.isGranted) {
          return;
        }
        final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (!serviceEnabled) {
          return;
        }
        final Position pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
        );
        if (!context.mounted) return;
        final LatLng here = LatLng(pos.latitude, pos.longitude);
        pickup.value = here;
        pickupField.text = 'Loading address…';
        editingPickup.value = false;
        mapController.move(here, 14);
        await resolvePickupCity();
        unawaited(applyReverseLabel(here, forPickup: true));
      } catch (_) {
        // Fall back to listCities center in bootstrapMap.
      }
    };

    initPickupFromGpsOrFallback = () async {
      await trySetDefaultPickupFromGps();
      if (!context.mounted) return;
      if (pickup.value == null) {
        await bootstrapMap();
      }
    };

    runPickupSearch = (String q) async {
      final String t = q.trim();
      if (t.length < 3) {
        if (context.mounted) {
          pickupSuggestions.value = <Map<String, dynamic>>[];
          searchingPickup.value = false;
        }
        return;
      }
      searchingPickup.value = true;
      try {
        final List<Map<String, dynamic>> hits = await api.searchPlaces(t);
        if (!context.mounted) return;
        pickupSuggestions.value = hits;
        searchingPickup.value = false;
      } catch (_) {
        if (!context.mounted) return;
        pickupSuggestions.value = <Map<String, dynamic>>[];
        searchingPickup.value = false;
      }
    };

    runDropSearch = (String q) async {
      final String t = q.trim();
      if (t.length < 3) {
        if (context.mounted) {
          dropSuggestions.value = <Map<String, dynamic>>[];
          searchingDrop.value = false;
        }
        return;
      }
      searchingDrop.value = true;
      try {
        final List<Map<String, dynamic>> hits = await api.searchPlaces(t);
        if (!context.mounted) return;
        dropSuggestions.value = hits;
        searchingDrop.value = false;
      } catch (_) {
        if (!context.mounted) return;
        dropSuggestions.value = <Map<String, dynamic>>[];
        searchingDrop.value = false;
      }
    };

    schedulePickupSearch = (String query) {
      pickupSearchDebounce.value?.cancel();
      pickupSearchDebounce.value = Timer(const Duration(milliseconds: 450), () {
        unawaited(runPickupSearch(query));
      });
    };

    scheduleDropSearch = (String query) {
      dropSearchDebounce.value?.cancel();
      dropSearchDebounce.value = Timer(const Duration(milliseconds: 450), () {
        unawaited(runDropSearch(query));
      });
    };

    applyPickupPlace = (Map<String, dynamic> m) {
      final double? lat = (m['lat'] as num?)?.toDouble();
      final double? lng = (m['lng'] as num?)?.toDouble();
      final String label = (m['label'] as String?)?.trim() ?? '';
      if (lat == null || lng == null) return;
      FocusScope.of(context).unfocus();
      pickup.value = LatLng(lat, lng);
      pickupField.text = label.isNotEmpty ? label : '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      pickupSuggestions.value = <Map<String, dynamic>>[];
      editingPickup.value = false;
      mapController.move(LatLng(lat, lng), 15);
      unawaited(resolvePickupCity());
    };

    applyDropPlace = (Map<String, dynamic> m) {
      final double? lat = (m['lat'] as num?)?.toDouble();
      final double? lng = (m['lng'] as num?)?.toDouble();
      final String label = (m['label'] as String?)?.trim() ?? '';
      if (lat == null || lng == null) return;
      FocusScope.of(context).unfocus();
      drop.value = LatLng(lat, lng);
      dropField.text = label.isNotEmpty ? label : '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      dropSuggestions.value = <Map<String, dynamic>>[];
      mapController.move(LatLng(lat, lng), 15);
    };

    useCurrentLocation = () async {
      locating.value = true;
      locationError.value = null;
      try {
        final PermissionStatus whenInUse = await Permission.locationWhenInUse.request();
        if (!whenInUse.isGranted) {
          locating.value = false;
          locationError.value = 'Location permission is needed to center the map on you.';
          return;
        }
        final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (!serviceEnabled) {
          locating.value = false;
          locationError.value = 'Turn on location services to use your current position.';
          return;
        }
        final Position pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
        );
        final LatLng here = LatLng(pos.latitude, pos.longitude);
        final bool updatedPickup = editingPickup.value || pickup.value == null;
        if (!context.mounted) return;
        if (editingPickup.value || pickup.value == null) {
          pickup.value = here;
          pickupField.text = 'Loading address…';
          editingPickup.value = false;
        } else {
          drop.value = here;
          dropField.text = 'Loading address…';
        }
        locating.value = false;
        mapController.move(here, 15);
        await resolvePickupCity();
        unawaited(applyReverseLabel(here, forPickup: updatedPickup));
      } catch (e) {
        if (!context.mounted) return;
        locating.value = false;
        locationError.value = 'Could not read GPS: $e';
      }
    };

    onMapTap = (TapPosition _, LatLng point) {
      FocusScope.of(context).unfocus();
      final bool isPickup = editingPickup.value;
      if (isPickup) {
        pickup.value = point;
        pickupField.text = 'Loading address…';
      } else {
        drop.value = point;
        dropField.text = 'Loading address…';
      }
      if (isPickup) {
        unawaited(resolvePickupCity());
      }
      unawaited(applyReverseLabel(point, forPickup: isPickup));
    };

    confirm = () {
      final LatLng? a = pickup.value;
      final LatLng? b = drop.value;
      final Map<String, dynamic>? c = serviceCity.value;
      final String cid = c == null ? '' : (c['id'] ?? c['code'] ?? '').toString();
      final String cname = c == null ? '' : (c['name'] ?? cid).toString();
      final double? km =
          roadRouteKm.value ?? ((a != null && b != null) ? haversineKm(a, b) : null);
      bool dropOutside = false;
      if (c != null && b != null) {
        final double? clat = (c['centerLat'] as num?)?.toDouble();
        final double? clng = (c['centerLng'] as num?)?.toDouble();
        final double? r = (c['serviceRadiusKm'] as num?)?.toDouble();
        if (clat != null && clng != null && r != null) {
          dropOutside =
              !pointInsideServiceCircle(point: b, center: LatLng(clat, clng), radiusKm: r);
        }
      }
      if (a == null || b == null || cid.isEmpty || km == null || km <= 0 || dropOutside) {
        return;
      }
      Navigator.of(context).pop(BookingMapResult(
        pickup: a,
        drop: b,
        cityId: cid,
        distanceKm: km,
        cityName: cname,
      ));
    };

    final ThemeData theme = Theme.of(context);
    final String title = kind == BookingMapKind.ride ? 'Plan your ride' : 'Plan your delivery';
    final LatLng? pickupPos = pickup.value;
    final LatLng? dropPos = drop.value;
    final LatLng center = pickupPos ?? dropPos ?? _fallbackCenter;
    final Map<String, dynamic>? svc = serviceCity.value;
    final String cityId = svc == null ? '' : (svc['id'] ?? svc['code'] ?? '').toString();
    final String cityLabel = svc == null ? '' : (svc['name'] ?? cityId).toString();
    final double? straightKm =
        (pickupPos != null && dropPos != null) ? haversineKm(pickupPos, dropPos) : null;
    final double? routeKm = roadRouteKm.value ?? straightKm;
    bool dropOutsideService = false;
    if (svc != null && dropPos != null) {
      final double? clat = (svc['centerLat'] as num?)?.toDouble();
      final double? clng = (svc['centerLng'] as num?)?.toDouble();
      final double? r = (svc['serviceRadiusKm'] as num?)?.toDouble();
      if (clat != null && clng != null && r != null) {
        dropOutsideService = !pointInsideServiceCircle(
          point: dropPos,
          center: LatLng(clat, clng),
          radiusKm: r,
        );
      }
    }
    final bool canEditDrop = pickupPos != null && svc != null;
    final bool canConfirm = pickupPos != null &&
        dropPos != null &&
        cityId.isNotEmpty &&
        routeKm != null &&
        routeKm > 0 &&
        !dropOutsideService &&
        !resolving.value;

    final List<Marker> markers = <Marker>[
      if (pickupPos != null)
        Marker(
          width: 48,
          height: 48,
          point: pickupPos,
          child: Icon(Icons.location_on, color: _kBookingPickupPin, size: 42),
        ),
      if (dropPos != null)
        Marker(
          width: 48,
          height: 48,
          point: dropPos,
          child: Icon(Icons.location_on, color: _kBookingDropPin, size: 44),
        ),
    ];

    final List<CircleMarker> circles = <CircleMarker>[];
    if (svc != null) {
      final double? clat = (svc['centerLat'] as num?)?.toDouble();
      final double? clng = (svc['centerLng'] as num?)?.toDouble();
      final double? rKm = (svc['serviceRadiusKm'] as num?)?.toDouble();
      if (clat != null && clng != null && rKm != null) {
        circles.add(
          CircleMarker(
            point: LatLng(clat, clng),
            radius: rKm * 1000,
            useRadiusInMeter: true,
            color: theme.colorScheme.primary.withValues(alpha: 0.12),
            borderColor: theme.colorScheme.primary.withValues(alpha: 0.35),
            borderStrokeWidth: 2,
          ),
        );
      }
    }

    return Material(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 0),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                ),
                IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: SegmentedButton<bool>(
              segments: <ButtonSegment<bool>>[
                ButtonSegment<bool>(
                  value: true,
                  label: const Text('Pickup'),
                  icon: Icon(Icons.location_on, size: 18, color: _kBookingPickupPin),
                ),
                ButtonSegment<bool>(
                  value: false,
                  enabled: canEditDrop,
                  label: const Text('Drop-off'),
                  icon: Icon(Icons.location_on, size: 18, color: _kBookingDropPin),
                ),
              ],
              selected: <bool>{editingPickup.value},
              onSelectionChanged: (Set<bool> next) {
                if (next.isEmpty) return;
                editingPickup.value = next.first;
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) {
                final double fieldWidth = constraints.maxWidth;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Stack(
                      clipBehavior: Clip.none,
                      children: <Widget>[
                        CompositedTransformTarget(
                          link: pickupLayerLink,
                          child: TextField(
                            controller: pickupField,
                            focusNode: pickupFocus,
                            decoration: InputDecoration(
                              labelText: 'Pickup',
                              hintText: 'Search address (3+ characters)',
                              isDense: true,
                              suffixIcon: searchingPickup.value
                                  ? const Padding(
                                      padding: EdgeInsets.all(12),
                                      child: SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      ),
                                    )
                                  : null,
                            ),
                            textInputAction: TextInputAction.next,
                            onTap: () => editingPickup.value = true,
                            onChanged: schedulePickupSearch,
                          ),
                        ),
                        if (pickupSuggestions.value.isNotEmpty)
                          CompositedTransformFollower(
                            link: pickupLayerLink,
                            showWhenUnlinked: false,
                            targetAnchor: Alignment.bottomLeft,
                            followerAnchor: Alignment.topLeft,
                            offset: const Offset(0, 4),
                            child: SizedBox(
                              width: fieldWidth,
                              child: _SuggestionList(
                                hits: pickupSuggestions.value,
                                onPick: applyPickupPlace,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Stack(
                      clipBehavior: Clip.none,
                      children: <Widget>[
                        CompositedTransformTarget(
                          link: dropLayerLink,
                          child: TextField(
                            controller: dropField,
                            focusNode: dropFocus,
                            enabled: canEditDrop,
                            decoration: InputDecoration(
                              labelText: 'Drop-off',
                              hintText: canEditDrop
                                  ? 'Search address (3+ characters)'
                                  : 'Set a valid pickup first',
                              isDense: true,
                              suffixIcon: searchingDrop.value
                                  ? const Padding(
                                      padding: EdgeInsets.all(12),
                                      child: SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      ),
                                    )
                                  : null,
                            ),
                            textInputAction: TextInputAction.done,
                            onTap: () => editingPickup.value = false,
                            onChanged: (String v) {
                              if (canEditDrop) {
                                scheduleDropSearch(v);
                              }
                            },
                          ),
                        ),
                        if (dropSuggestions.value.isNotEmpty && canEditDrop)
                          CompositedTransformFollower(
                            link: dropLayerLink,
                            showWhenUnlinked: false,
                            targetAnchor: Alignment.bottomLeft,
                            followerAnchor: Alignment.topLeft,
                            offset: const Offset(0, 4),
                            child: SizedBox(
                              width: fieldWidth,
                              child: _SuggestionList(
                                hits: dropSuggestions.value,
                                onPick: applyDropPlace,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          if (locationError.value != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _SoftBanner(
                icon: Icons.location_off,
                message: locationError.value!,
                color: theme.colorScheme.errorContainer,
              ),
            ),
          if (pickupServiceError.value != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: _SoftBanner(
                icon: Icons.info_outline,
                message: pickupServiceError.value!,
                color: theme.colorScheme.surfaceContainerHighest,
              ),
            ),
          if (dropOutsideService)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: _SoftBanner(
                icon: Icons.warning_amber_rounded,
                message: 'Drop-off is outside the $cityLabel service area. Move the red pin closer to town.',
                color: theme.colorScheme.errorContainer,
              ),
            ),
          Expanded(
            child: Stack(
              children: <Widget>[
                FlutterMap(
                  mapController: mapController,
                  options: MapOptions(
                    initialCenter: center,
                    initialZoom: 13,
                    onTap: onMapTap,
                    interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
                  ),
                  children: <Widget>[
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.example.rider_app',
                    ),
                    if (circles.isNotEmpty) CircleLayer(circles: circles),
                    if (pickupPos != null &&
                        dropPos != null &&
                        roadRoute.value != null &&
                        roadRoute.value!.length >= 2)
                      PolylineLayer(
                        polylines: <Polyline>[
                          Polyline(
                            points: roadRoute.value!,
                            strokeWidth: 4,
                            color: theme.colorScheme.primary.withValues(alpha: 0.85),
                          ),
                        ],
                      ),
                    MarkerLayer(markers: markers),
                  ],
                ),
                Positioned(
                  right: 12,
                  bottom: 88,
                  child: Column(
                    children: <Widget>[
                      FloatingActionButton.small(
                        heroTag: 'loc',
                        onPressed: locating.value ? null : useCurrentLocation,
                        tooltip: 'My location',
                        child: locating.value
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.my_location),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  if (svc != null)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.check_circle, color: theme.colorScheme.primary),
                      title: Text('Service area: $cityLabel', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        straightKm == null
                            ? 'Set pickup and drop-off above or on the map'
                            : roadRouteKm.value != null
                                ? 'Road ~${roadRouteKm.value!.toStringAsFixed(1)} km · straight ${straightKm.toStringAsFixed(1)} km'
                                : routingBusy.value
                                    ? 'Looking up driving route…'
                                    : 'Straight ~${straightKm.toStringAsFixed(1)} km (road route unavailable)',
                      ),
                    ),
                  if (resolving.value)
                    const LinearProgressIndicator(minHeight: 2)
                  else
                    const SizedBox(height: 2),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: canConfirm ? confirm : null,
                    child: const Text('Use these locations'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestionList extends StatelessWidget {
  const _SuggestionList({
    required this.hits,
    required this.onPick,
  });

  final List<Map<String, dynamic>> hits;
  final void Function(Map<String, dynamic>) onPick;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 2,
      borderRadius: BorderRadius.circular(8),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 180),
        child: ListView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          itemCount: hits.length,
          itemBuilder: (BuildContext context, int i) {
            final Map<String, dynamic> m = hits[i];
            final String label = (m['label'] as String?) ?? '';
            return ListTile(
              dense: true,
              title: Text(label, maxLines: 2, overflow: TextOverflow.ellipsis),
              onTap: () => onPick(m),
            );
          },
        ),
      ),
    );
  }
}

class _SoftBanner extends StatelessWidget {
  const _SoftBanner({required this.icon, required this.message, required this.color});

  final IconData icon;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(icon, size: 22),
            const SizedBox(width: 10),
            Expanded(child: Text(message, style: Theme.of(context).textTheme.bodyMedium)),
          ],
        ),
      ),
    );
  }
}
