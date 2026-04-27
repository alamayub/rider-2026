import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

/// Great-circle distance in kilometres (WGS84 sphere approximation).
double haversineKm(LatLng a, LatLng b) {
  const double earthRadiusKm = 6371;
  final double dLat = _toRad(b.latitude - a.latitude);
  final double dLon = _toRad(b.longitude - a.longitude);
  final double lat1 = _toRad(a.latitude);
  final double lat2 = _toRad(b.latitude);
  final double h = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.sin(dLon / 2) * math.sin(dLon / 2) * math.cos(lat1) * math.cos(lat2);
  final double c = 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
  return earthRadiusKm * c;
}

double _toRad(double deg) => deg * math.pi / 180;

bool pointInsideServiceCircle({
  required LatLng point,
  required LatLng center,
  required double radiusKm,
}) {
  return haversineKm(point, center) <= radiusKm;
}
