import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/geo_utils.dart';
import '../../core/rider_api.dart';

enum BookingMapKind { ride, parcel }

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

/// Uber-style pickup / drop selection: map tap, current location, auto city from backend.
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

class _BookingMapBody extends StatefulWidget {
  const _BookingMapBody({required this.api, required this.kind});

  final RiderApi api;
  final BookingMapKind kind;

  @override
  State<_BookingMapBody> createState() => _BookingMapBodyState();
}

class _BookingMapBodyState extends State<_BookingMapBody> {
  final MapController _mapController = MapController();
  LatLng? _pickup;
  LatLng? _drop;
  bool _editingPickup = true;

  Map<String, dynamic>? _serviceCity;
  String? _pickupServiceError;
  String? _locationError;
  bool _resolving = false;
  bool _locating = false;

  static const LatLng _fallbackCenter = LatLng(12.9716, 77.5946);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrapMap());
  }

  Future<void> _bootstrapMap() async {
    try {
      final cities = await widget.api.listCities();
      final withCenter = cities.cast<Map>().map((dynamic e) => Map<String, dynamic>.from(e)).where((Map<String, dynamic> m) {
        return m['centerLat'] != null && m['centerLng'] != null;
      }).toList();
      if (withCenter.isNotEmpty && mounted) {
        final first = withCenter.first;
        final c = LatLng(
          (first['centerLat'] as num).toDouble(),
          (first['centerLng'] as num).toDouble(),
        );
        _mapController.move(c, 12);
      } else if (mounted) {
        _mapController.move(_fallbackCenter, 12);
      }
    } catch (_) {
      if (mounted) {
        _mapController.move(_fallbackCenter, 12);
      }
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _locationError = null;
    });
    try {
      final PermissionStatus whenInUse = await Permission.locationWhenInUse.request();
      if (!whenInUse.isGranted) {
        setState(() {
          _locating = false;
          _locationError = 'Location permission is needed to center the map on you.';
        });
        return;
      }
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _locating = false;
          _locationError = 'Turn on location services to use your current position.';
        });
        return;
      }
      final Position pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final LatLng here = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        if (_editingPickup || _pickup == null) {
          _pickup = here;
          _editingPickup = false;
        } else {
          _drop = here;
        }
        _locating = false;
      });
      _mapController.move(here, 15);
      await _resolvePickupCity();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locating = false;
        _locationError = 'Could not read GPS: $e';
      });
    }
  }

  Future<void> _resolvePickupCity() async {
    final LatLng? p = _pickup;
    if (p == null) return;
    setState(() {
      _resolving = true;
      _pickupServiceError = null;
      _serviceCity = null;
    });
    try {
      final Map<String, dynamic>? resolved = await widget.api.tryResolveCity(lat: p.latitude, lng: p.longitude);
      if (!mounted) return;
      if (resolved == null) {
        setState(() {
          _serviceCity = null;
          _pickupServiceError =
              'We are not here yet. Try moving the pickup pin into a shaded service area, or choose another city later.';
          _resolving = false;
        });
        return;
      }
      setState(() {
        _serviceCity = resolved;
        _pickupServiceError = null;
        _resolving = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _resolving = false;
        _pickupServiceError = e.message ?? 'Could not check service area.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _resolving = false;
        _pickupServiceError = e.toString();
      });
    }
  }

  void _onMapTap(TapPosition _, LatLng point) {
    setState(() {
      if (_editingPickup) {
        _pickup = point;
      } else {
        _drop = point;
      }
    });
    if (_editingPickup) {
      _resolvePickupCity();
    } else {
      setState(() {});
    }
  }

  bool get _dropOutsideService {
    final Map<String, dynamic>? c = _serviceCity;
    final LatLng? d = _drop;
    if (c == null || d == null) return false;
    final double? clat = (c['centerLat'] as num?)?.toDouble();
    final double? clng = (c['centerLng'] as num?)?.toDouble();
    final double? r = (c['serviceRadiusKm'] as num?)?.toDouble();
    if (clat == null || clng == null || r == null) return false;
    return !pointInsideServiceCircle(point: d, center: LatLng(clat, clng), radiusKm: r);
  }

  String get _cityId {
    final Map<String, dynamic>? c = _serviceCity;
    if (c == null) return '';
    return (c['id'] ?? c['code'] ?? '').toString();
  }

  String get _cityLabel {
    final Map<String, dynamic>? c = _serviceCity;
    if (c == null) return '';
    return (c['name'] ?? _cityId).toString();
  }

  double? get _routeKm {
    final LatLng? a = _pickup;
    final LatLng? b = _drop;
    if (a == null || b == null) return null;
    return haversineKm(a, b);
  }

  void _confirm() {
    final LatLng? a = _pickup;
    final LatLng? b = _drop;
    final String cid = _cityId;
    final double? km = _routeKm;
    if (a == null || b == null || cid.isEmpty || km == null || km <= 0 || _dropOutsideService) {
      return;
    }
    Navigator.of(context).pop(BookingMapResult(
      pickup: a,
      drop: b,
      cityId: cid,
      distanceKm: km,
      cityName: _cityLabel,
    ));
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String title = widget.kind == BookingMapKind.ride ? 'Plan your ride' : 'Plan your delivery';
    final LatLng center = _pickup ?? _drop ?? _fallbackCenter;
    final List<Marker> markers = <Marker>[
      if (_pickup != null)
        Marker(
          width: 48,
          height: 48,
          point: _pickup!,
          child: Icon(Icons.trip_origin, color: theme.colorScheme.primary, size: 40),
        ),
      if (_drop != null)
        Marker(
          width: 48,
          height: 48,
          point: _drop!,
          child: Icon(Icons.location_on, color: theme.colorScheme.error, size: 44),
        ),
    ];

    final List<CircleMarker> circles = <CircleMarker>[];
    final Map<String, dynamic>? c = _serviceCity;
    if (c != null) {
      final double? clat = (c['centerLat'] as num?)?.toDouble();
      final double? clng = (c['centerLng'] as num?)?.toDouble();
      final double? rKm = (c['serviceRadiusKm'] as num?)?.toDouble();
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
                const ButtonSegment<bool>(value: true, label: Text('Pickup'), icon: Icon(Icons.trip_origin, size: 18)),
                ButtonSegment<bool>(
                  value: false,
                  enabled: _pickup != null && _serviceCity != null,
                  label: const Text('Drop-off'),
                  icon: const Icon(Icons.location_on, size: 18),
                ),
              ],
              selected: <bool>{_editingPickup},
              onSelectionChanged: (Set<bool> next) {
                if (next.isEmpty) return;
                setState(() => _editingPickup = next.first);
              },
            ),
          ),
          if (_locationError != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _SoftBanner(icon: Icons.location_off, message: _locationError!, color: theme.colorScheme.errorContainer),
            ),
          if (_pickupServiceError != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: _SoftBanner(
                icon: Icons.info_outline,
                message: _pickupServiceError!,
                color: theme.colorScheme.surfaceContainerHighest,
              ),
            ),
          if (_dropOutsideService)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: _SoftBanner(
                icon: Icons.warning_amber_rounded,
                message: 'Drop-off is outside the $_cityLabel service area. Move the red pin closer to town.',
                color: theme.colorScheme.errorContainer,
              ),
            ),
          Expanded(
            child: Stack(
              children: <Widget>[
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: center,
                    initialZoom: 13,
                    onTap: _onMapTap,
                    interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
                  ),
                  children: <Widget>[
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.example.rider_app',
                    ),
                    if (circles.isNotEmpty) CircleLayer(circles: circles),
                    if (_pickup != null && _drop != null)
                      PolylineLayer(
                        polylines: <Polyline>[
                          Polyline(
                            points: <LatLng>[_pickup!, _drop!],
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
                        onPressed: _locating ? null : _useCurrentLocation,
                        tooltip: 'My location',
                        child: _locating
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
                  if (_serviceCity != null)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.check_circle, color: theme.colorScheme.primary),
                      title: Text('Service area: $_cityLabel', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        _routeKm != null
                            ? 'Route ~${_routeKm!.toStringAsFixed(1)} km straight line'
                            : 'Tap map to set pickup and drop-off',
                      ),
                    ),
                  if (_resolving)
                    const LinearProgressIndicator(minHeight: 2)
                  else
                    const SizedBox(height: 2),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _canConfirm ? _confirm : null,
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

  bool get _canConfirm {
    return _pickup != null &&
        _drop != null &&
        _cityId.isNotEmpty &&
        _routeKm != null &&
        _routeKm! > 0 &&
        !_dropOutsideService &&
        !_resolving;
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
