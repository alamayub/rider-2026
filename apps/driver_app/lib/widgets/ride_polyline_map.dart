import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../services/driver_api.dart';

const Color _kPickupPinColor = Color(0xFF2E7D32);
const Color _kDropPinColor = Color(0xFFC62828);

/// Read-only map: pickup/drop pins and driving route (via [DriverApi.getDrivingRoutePreview]) when available.
class RidePolylineMap extends HookWidget {
  const RidePolylineMap({
    super.key,
    required this.api,
    required this.pickup,
    required this.drop,
    this.height = 200,
  });

  final DriverApi api;
  final LatLng pickup;
  final LatLng drop;
  final double height;

  @override
  Widget build(BuildContext context) {
    final MapController mapController = useMemoized(MapController.new, const <Object>[]);
    useEffect(() {
      return () {
        mapController.dispose();
      };
    }, <Object>[mapController]);

    final roadRoute = useState<List<LatLng>?>(null);
    final routingBusy = useState<bool>(false);

    useEffect(() {
      roadRoute.value = null;
      bool cancelled = false;
      final Timer t = Timer(const Duration(milliseconds: 350), () async {
        if (cancelled) return;
        routingBusy.value = true;
        try {
          DriverDrivingRoute? r;
          try {
            r = await api.getDrivingRoutePreview(
              pickupLat: pickup.latitude,
              pickupLng: pickup.longitude,
              dropLat: drop.latitude,
              dropLng: drop.longitude,
            );
          } catch (_) {
            r = null;
          }
          if (cancelled || !context.mounted) return;
          roadRoute.value = r?.points;
        } finally {
          if (!cancelled && context.mounted) {
            routingBusy.value = false;
          }
        }
      });
      return () {
        cancelled = true;
        t.cancel();
      };
    }, <Object?>[
      pickup.latitude,
      pickup.longitude,
      drop.latitude,
      drop.longitude,
    ]);

    final ThemeData theme = Theme.of(context);
    final LatLng center = LatLng(
      (pickup.latitude + drop.latitude) / 2,
      (pickup.longitude + drop.longitude) / 2,
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: center,
                initialZoom: 12,
                interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
              ),
              children: <Widget>[
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.driver_app',
                ),
                if (roadRoute.value != null && roadRoute.value!.length >= 2)
                  PolylineLayer(
                    polylines: <Polyline>[
                      Polyline(
                        points: roadRoute.value!,
                        strokeWidth: 4,
                        color: theme.colorScheme.primary.withValues(alpha: 0.88),
                      ),
                    ],
                  ),
                MarkerLayer(
                  markers: <Marker>[
                    Marker(
                      width: 40,
                      height: 40,
                      point: pickup,
                      child: Icon(Icons.location_on, color: _kPickupPinColor, size: 36),
                    ),
                    Marker(
                      width: 40,
                      height: 40,
                      point: drop,
                      child: Icon(Icons.location_on, color: _kDropPinColor, size: 38),
                    ),
                  ],
                ),
              ],
            ),
            if (routingBusy.value)
              const Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(color: Color(0x33000000)),
                    child: Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Full-screen map for pickup → drop (same routing as [RidePolylineMap]).
Future<void> pushDriverRideRouteFullscreen({
  required BuildContext context,
  required DriverApi api,
  required LatLng pickup,
  required LatLng drop,
}) async {
  await Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (BuildContext ctx) {
        return Scaffold(
          appBar: AppBar(title: const Text('Trip route')),
          body: SafeArea(
            child: LayoutBuilder(
              builder: (BuildContext _, BoxConstraints c) {
                final double h = c.maxHeight > 0 ? c.maxHeight : 400;
                return RidePolylineMap(api: api, pickup: pickup, drop: drop, height: h);
              },
            ),
          ),
        );
      },
    ),
  );
}
