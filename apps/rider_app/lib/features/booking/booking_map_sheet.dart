import 'dart:async';

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

class _BookingMapBody extends StatefulWidget {
  const _BookingMapBody({required this.api, required this.kind});

  final RiderApi api;
  final BookingMapKind kind;

  @override
  State<_BookingMapBody> createState() => _BookingMapBodyState();
}

class _BookingMapBodyState extends State<_BookingMapBody> {
  final MapController _mapController = MapController();
  final TextEditingController _pickupField = TextEditingController();
  final TextEditingController _dropField = TextEditingController();
  final FocusNode _pickupFocus = FocusNode();
  final FocusNode _dropFocus = FocusNode();
  final LayerLink _pickupLayerLink = LayerLink();
  final LayerLink _dropLayerLink = LayerLink();

  Timer? _pickupSearchDebounce;
  Timer? _dropSearchDebounce;

  LatLng? _pickup;
  LatLng? _drop;
  bool _editingPickup = true;

  List<Map<String, dynamic>> _pickupSuggestions = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _dropSuggestions = <Map<String, dynamic>>[];
  bool _searchingPickup = false;
  bool _searchingDrop = false;

  Map<String, dynamic>? _serviceCity;
  String? _pickupServiceError;
  String? _locationError;
  bool _resolving = false;
  bool _locating = false;

  static const LatLng _fallbackCenter = LatLng(12.9716, 77.5946);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initPickupFromGpsOrFallback());
  }

  Future<void> _initPickupFromGpsOrFallback() async {
    await _trySetDefaultPickupFromGps();
    if (mounted && _pickup == null) {
      await _bootstrapMap();
    }
  }

  Future<void> _bootstrapMap() async {
    try {
      final List<dynamic> cities = await widget.api.listCities();
      final List<Map<String, dynamic>> withCenter = cities
          .cast<Map>()
          .map((dynamic e) => Map<String, dynamic>.from(e))
          .where((Map<String, dynamic> m) {
        return m['centerLat'] != null && m['centerLng'] != null;
      }).toList();
      if (withCenter.isNotEmpty && mounted) {
        final Map<String, dynamic> first = withCenter.first;
        final LatLng c = LatLng(
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

  Future<void> _trySetDefaultPickupFromGps() async {
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
      if (!mounted) return;
      final LatLng here = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _pickup = here;
        _pickupField.text = 'Loading address…';
        _editingPickup = false;
      });
      _mapController.move(here, 14);
      await _resolvePickupCity();
      unawaited(_applyReverseLabel(here, forPickup: true));
    } catch (_) {
      // Fall back to listCities center in _bootstrapMap.
    }
  }

  void _schedulePickupSearch(String query) {
    _pickupSearchDebounce?.cancel();
    _pickupSearchDebounce = Timer(const Duration(milliseconds: 450), () {
      unawaited(_runPickupSearch(query));
    });
  }

  void _scheduleDropSearch(String query) {
    _dropSearchDebounce?.cancel();
    _dropSearchDebounce = Timer(const Duration(milliseconds: 450), () {
      unawaited(_runDropSearch(query));
    });
  }

  Future<void> _runPickupSearch(String q) async {
    final String t = q.trim();
    if (t.length < 3) {
      if (mounted) {
        setState(() {
          _pickupSuggestions = <Map<String, dynamic>>[];
          _searchingPickup = false;
        });
      }
      return;
    }
    setState(() => _searchingPickup = true);
    try {
      final List<Map<String, dynamic>> hits = await widget.api.searchPlaces(t);
      if (!mounted) return;
      setState(() {
        _pickupSuggestions = hits;
        _searchingPickup = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pickupSuggestions = <Map<String, dynamic>>[];
        _searchingPickup = false;
      });
    }
  }

  Future<void> _runDropSearch(String q) async {
    final String t = q.trim();
    if (t.length < 3) {
      if (mounted) {
        setState(() {
          _dropSuggestions = <Map<String, dynamic>>[];
          _searchingDrop = false;
        });
      }
      return;
    }
    setState(() => _searchingDrop = true);
    try {
      final List<Map<String, dynamic>> hits = await widget.api.searchPlaces(t);
      if (!mounted) return;
      setState(() {
        _dropSuggestions = hits;
        _searchingDrop = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _dropSuggestions = <Map<String, dynamic>>[];
        _searchingDrop = false;
      });
    }
  }

  void _applyPickupPlace(Map<String, dynamic> m) {
    final double? lat = (m['lat'] as num?)?.toDouble();
    final double? lng = (m['lng'] as num?)?.toDouble();
    final String label = (m['label'] as String?)?.trim() ?? '';
    if (lat == null || lng == null) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _pickup = LatLng(lat, lng);
      _pickupField.text = label.isNotEmpty ? label : '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      _pickupSuggestions = <Map<String, dynamic>>[];
      _editingPickup = false;
    });
    _mapController.move(LatLng(lat, lng), 15);
    unawaited(_resolvePickupCity());
  }

  void _applyDropPlace(Map<String, dynamic> m) {
    final double? lat = (m['lat'] as num?)?.toDouble();
    final double? lng = (m['lng'] as num?)?.toDouble();
    final String label = (m['label'] as String?)?.trim() ?? '';
    if (lat == null || lng == null) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _drop = LatLng(lat, lng);
      _dropField.text = label.isNotEmpty ? label : '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      _dropSuggestions = <Map<String, dynamic>>[];
    });
    _mapController.move(LatLng(lat, lng), 15);
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
      final bool updatedPickup = _editingPickup || _pickup == null;
      if (!mounted) return;
      setState(() {
        if (_editingPickup || _pickup == null) {
          _pickup = here;
          _pickupField.text = 'Loading address…';
          _editingPickup = false;
        } else {
          _drop = here;
          _dropField.text = 'Loading address…';
        }
        _locating = false;
      });
      _mapController.move(here, 15);
      await _resolvePickupCity();
      unawaited(_applyReverseLabel(here, forPickup: updatedPickup));
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
      final Map<String, dynamic>? resolved =
          await widget.api.tryResolveCity(lat: p.latitude, lng: p.longitude);
      if (!mounted) return;
      if (resolved == null) {
        setState(() {
          _serviceCity = null;
          _pickupServiceError =
              'We are not here yet. Try moving the pickup pin into the shaded service area or search for an address inside our coverage.';
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

  String _shortCoordLabel(LatLng p) =>
      '${p.latitude.toStringAsFixed(5)}, ${p.longitude.toStringAsFixed(5)}';

  bool _sameLatLng(LatLng? a, LatLng b) {
    if (a == null) return false;
    return (a.latitude - b.latitude).abs() < 1e-7 && (a.longitude - b.longitude).abs() < 1e-7;
  }

  Future<void> _applyReverseLabel(LatLng point, {required bool forPickup}) async {
    try {
      final String label =
          await widget.api.reversePlaceLabel(lat: point.latitude, lng: point.longitude);
      if (!mounted) return;
      final String t = label.trim();
      if (t.isEmpty) {
        setState(() {
          if (forPickup && _sameLatLng(_pickup, point)) {
            _pickupField.text = _shortCoordLabel(point);
          } else if (!forPickup && _sameLatLng(_drop, point)) {
            _dropField.text = _shortCoordLabel(point);
          }
        });
        return;
      }
      setState(() {
        if (forPickup && _sameLatLng(_pickup, point)) {
          _pickupField.text = t;
        } else if (!forPickup && _sameLatLng(_drop, point)) {
          _dropField.text = t;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (forPickup && _sameLatLng(_pickup, point)) {
          _pickupField.text = _shortCoordLabel(point);
        } else if (!forPickup && _sameLatLng(_drop, point)) {
          _dropField.text = _shortCoordLabel(point);
        }
      });
    }
  }

  void _onMapTap(TapPosition _, LatLng point) {
    FocusScope.of(context).unfocus();
    final bool pickup = _editingPickup;
    setState(() {
      if (pickup) {
        _pickup = point;
        _pickupField.text = 'Loading address…';
      } else {
        _drop = point;
        _dropField.text = 'Loading address…';
      }
    });
    if (pickup) {
      unawaited(_resolvePickupCity());
    }
    unawaited(_applyReverseLabel(point, forPickup: pickup));
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

  bool get _canEditDrop => _pickup != null && _serviceCity != null;

  @override
  void dispose() {
    _pickupSearchDebounce?.cancel();
    _dropSearchDebounce?.cancel();
    _pickupField.dispose();
    _dropField.dispose();
    _pickupFocus.dispose();
    _dropFocus.dispose();
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
                  enabled: _canEditDrop,
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
                          link: _pickupLayerLink,
                          child: TextField(
                            controller: _pickupField,
                            focusNode: _pickupFocus,
                            decoration: InputDecoration(
                              labelText: 'Pickup',
                              hintText: 'Search address (3+ characters)',
                              isDense: true,
                              suffixIcon: _searchingPickup
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
                            onTap: () => setState(() => _editingPickup = true),
                            onChanged: (String v) => _schedulePickupSearch(v),
                          ),
                        ),
                        if (_pickupSuggestions.isNotEmpty)
                          CompositedTransformFollower(
                            link: _pickupLayerLink,
                            showWhenUnlinked: false,
                            targetAnchor: Alignment.bottomLeft,
                            followerAnchor: Alignment.topLeft,
                            offset: const Offset(0, 4),
                            child: SizedBox(
                              width: fieldWidth,
                              child: _SuggestionList(
                                hits: _pickupSuggestions,
                                onPick: _applyPickupPlace,
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
                          link: _dropLayerLink,
                          child: TextField(
                            controller: _dropField,
                            focusNode: _dropFocus,
                            enabled: _canEditDrop,
                            decoration: InputDecoration(
                              labelText: 'Drop-off',
                              hintText: _canEditDrop
                                  ? 'Search address (3+ characters)'
                                  : 'Set a valid pickup first',
                              isDense: true,
                              suffixIcon: _searchingDrop
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
                            onTap: () => setState(() => _editingPickup = false),
                            onChanged: (String v) {
                              if (_canEditDrop) {
                                _scheduleDropSearch(v);
                              }
                            },
                          ),
                        ),
                        if (_dropSuggestions.isNotEmpty && _canEditDrop)
                          CompositedTransformFollower(
                            link: _dropLayerLink,
                            showWhenUnlinked: false,
                            targetAnchor: Alignment.bottomLeft,
                            followerAnchor: Alignment.topLeft,
                            offset: const Offset(0, 4),
                            child: SizedBox(
                              width: fieldWidth,
                              child: _SuggestionList(
                                hits: _dropSuggestions,
                                onPick: _applyDropPlace,
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
                            : 'Set pickup and drop-off above or on the map',
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
