/// Shapes must match the backend: pickup/drop are geo JSON `{ "lat", "lng" }`.
Map<String, double> geoPoint(double lat, double lng) =>
    <String, double>{'lat': lat, 'lng': lng};

/// Estimates return [amount] (rides & parcels). Some older paths used [fare].
double? readEstimateAmount(Map<String, dynamic> json) {
  final a = json['amount'];
  if (a is num) return a.toDouble();
  final f = json['fare'];
  if (f is num) return f.toDouble();
  return null;
}

/// Backend exposes [rideStartOtp] for the rider until the trip is started (verified).
String? readRideStartOtp(Map<String, dynamic> json) {
  final v = json['rideStartOtp'] ?? json['ride_start_otp'];
  if (v == null) return null;
  final s = v.toString().trim();
  return s.isEmpty ? null : s;
}
