// Central enum definitions for the rider app.

enum AppSnackBarType {
  success,
  info,
  error,
}

/// Result of [RiderApi.registerDeviceToken] — never throws for HTTP 401/4xx (handled explicitly).
enum DeviceTokenRegistrationResult {
  success,
  unauthorized,
  rejected,
  networkError,
}

enum BookingMapKind {
  ride,
  parcel,
}
