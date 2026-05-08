import 'package:dio/dio.dart';
import 'package:latlong2/latlong.dart';

import '../config/enums.dart';

class RiderApi {
  RiderApi({required this.baseUrl}) : _dio = Dio(BaseOptions(baseUrl: baseUrl)) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (DioException err, ErrorInterceptorHandler handler) {
          _maybeNotifyUnauthorized(
            err.requestOptions,
            err.response?.statusCode,
          );
          return handler.next(err);
        },
      ),
    );
  }

  final String baseUrl;

  /// Set by [SessionNotifier] so 401/403 on authenticated routes clears the session.
  void Function()? onUnauthorized;

  final Dio _dio;
  String? _accessToken;
  bool _unauthorizedNotified = false;

  static bool _isPublicAuthPath(String path) {
    final String p = path.endsWith('/') && path.length > 1
        ? path.substring(0, path.length - 1)
        : path;
    return p == '/auth/signin' ||
        p == '/auth/register' ||
        p == '/auth/request-otp';
  }

  void _maybeNotifyUnauthorized(RequestOptions ro, int? statusCode) {
    if (statusCode != 401 && statusCode != 403) return;
    if (_isPublicAuthPath(ro.path)) return;
    final Object? auth = ro.headers['Authorization'];
    final String authStr = auth is String ? auth : '';
    if (authStr.isEmpty) return;
    if (_unauthorizedNotified) return;
    _unauthorizedNotified = true;
    onUnauthorized?.call();
  }

  set accessToken(String? value) {
    _accessToken = value;
    if (value != null && value.isNotEmpty) {
      _unauthorizedNotified = false;
    }
  }

  Options get _authOptions => Options(
        headers: <String, String>{
          if (_accessToken != null && _accessToken!.isNotEmpty)
            'Authorization': 'Bearer $_accessToken',
        },
      );

  /// [password] or [otp] must be non-empty (backend rule).
  Future<Map<String, dynamic>> signIn({
    required String phone,
    String? password,
    String? otp,
  }) async {
    if ((password == null || password.isEmpty) &&
        (otp == null || otp.isEmpty)) {
      throw ArgumentError('password or otp is required');
    }
    final response = await _dio.post(
      '/auth/signin',
      data: <String, dynamic>{
        'phone': phone,
        'role': 'rider',
        if (password != null && password.isNotEmpty) 'password': password,
        if (otp != null && otp.isNotEmpty) 'otp': otp,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> register({
    required String phone,
    required String password,
    String? email,
  }) async {
    final response = await _dio.post(
      '/auth/register',
      data: <String, dynamic>{
        'phone': phone,
        'role': 'rider',
        'password': password,
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<void> requestOtp({required String phone}) async {
    await _dio.post(
      '/auth/request-otp',
      data: <String, dynamic>{'phone': phone, 'role': 'rider'},
    );
  }

  Future<Map<String, dynamic>> getMyProfile() async => _getMap('/auth/me');

  Future<Map<String, dynamic>> updateMyProfile(
          {String? email, String? fullName}) async =>
      _map('/auth/me', <String, dynamic>{
        if (email != null) 'email': email.trim(),
        if (fullName != null) 'fullName': fullName.trim(),
      });

  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async =>
      _map('/auth/change-password', <String, dynamic>{
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  /// Registers FCM token with the backend. Uses [validateStatus] so **401 does not throw**
  /// (Dio’s default would surface as an uncaught [DioException] in async callbacks).
  Future<DeviceTokenRegistrationResult> registerDeviceToken({
    required String app,
    required String platform,
    required String token,
  }) async {
    try {
      final Response<dynamic> response = await _dio.post<dynamic>(
        '/notifications/me/device-token',
        data: <String, dynamic>{
          'app': app,
          'platform': platform,
          'token': token,
        },
        options: Options(
          headers: <String, String>{
            if (_accessToken != null && _accessToken!.isNotEmpty)
              'Authorization': 'Bearer $_accessToken',
          },
          validateStatus: (int? status) => status != null && status < 600,
        ),
      );
      final int code = response.statusCode ?? 0;
      if (code >= 200 && code < 300) {
        return DeviceTokenRegistrationResult.success;
      }
      if (code == 401 || code == 403) {
        _maybeNotifyUnauthorized(response.requestOptions, code);
        return DeviceTokenRegistrationResult.unauthorized;
      }
      return DeviceTokenRegistrationResult.rejected;
    } on DioException catch (e) {
      final DioExceptionType t = e.type;
      if (t == DioExceptionType.connectionTimeout ||
          t == DioExceptionType.receiveTimeout ||
          t == DioExceptionType.sendTimeout ||
          t == DioExceptionType.connectionError) {
        return DeviceTokenRegistrationResult.networkError;
      }
      return DeviceTokenRegistrationResult.rejected;
    } catch (_) {
      return DeviceTokenRegistrationResult.networkError;
    }
  }

  Future<List<dynamic>> listMyNotifications({int limit = 100}) =>
      _list('/notifications/me', query: <String, dynamic>{'limit': limit});

  Future<Map<String, dynamic>> getMyNotificationStats() =>
      _getMap('/notifications/me/stats');

  Future<Map<String, dynamic>> markNotificationReceived(
          String notificationId) =>
      _map('/notifications/$notificationId/received', <String, dynamic>{});

  Future<Map<String, dynamic>> markNotificationDelivered(
          String notificationId) =>
      _map('/notifications/$notificationId/delivered', <String, dynamic>{});

  Future<Map<String, dynamic>> markNotificationRead(String notificationId) =>
      _map('/notifications/$notificationId/read', <String, dynamic>{});

  Future<Map<String, dynamic>> getRiderAnalytics() async =>
      _getMap('/analytics/rider');

  /// Service areas (fare + tax config) for ride/parcel booking.
  Future<List<dynamic>> listCities() async => _list('/rides/cities');

  /// Nearest in-service city for map booking, or `null` if [lat]/[lng] are outside all areas (HTTP 404).
  Future<Map<String, dynamic>?> tryResolveCity({required double lat, required double lng}) async {
    try {
      final response = await _dio.get(
        '/rides/cities/resolve',
        queryParameters: <String, dynamic>{'lat': lat, 'lng': lng},
        options: _authOptions,
      );
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return Map<String, dynamic>.from(data);
      }
      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  /// Forward geocode via backend (Nominatim). Returns `{ label, lat, lng }` rows.
  Future<List<Map<String, dynamic>>> searchPlaces(String query,
      {int limit = 8}) async {
    final String q = query.trim();
    if (q.length < 3) {
      return <Map<String, dynamic>>[];
    }
    final Map<String, dynamic> body = await _getMap(
      '/rides/places/search',
      query: <String, dynamic>{
        'q': q,
        'limit': limit,
      },
    );
    final List<dynamic>? results = body['results'] as List<dynamic>?;
    if (results == null) {
      return <Map<String, dynamic>>[];
    }
    return results
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// Reverse geocode via backend (Nominatim). Returns display name or empty string.
  Future<String> reversePlaceLabel({required double lat, required double lng}) async {
    final Map<String, dynamic> body = await _getMap(
      '/rides/places/reverse',
      query: <String, dynamic>{'lat': lat, 'lng': lng},
    );
    return (body['label'] as String?)?.trim() ?? '';
  }

  /// Driving route preview (road polyline + distance) via backend OSRM proxy.
  /// Returns `null` if routing fails or is unavailable (client may fall back to straight line).
  Future<RiderDrivingRoute?> getDrivingRoutePreview({
    required double pickupLat,
    required double pickupLng,
    required double dropLat,
    required double dropLng,
  }) async {
    try {
      final response = await _dio.get(
        '/rides/route',
        queryParameters: <String, dynamic>{
          'pickupLat': pickupLat,
          'pickupLng': pickupLng,
          'dropLat': dropLat,
          'dropLng': dropLng,
        },
        options: _authOptions,
      );
      final Object? data = response.data;
      if (data is! Map) return null;
      final Map<String, dynamic> m = Map<String, dynamic>.from(data);
      final Object? dist = m['distanceKm'];
      final Object? rawPoints = m['points'];
      if (dist is! num || rawPoints is! List) return null;
      final List<LatLng> points = <LatLng>[];
      for (final Object? p in rawPoints) {
        if (p is! Map) continue;
        final Map<String, dynamic> pm = Map<String, dynamic>.from(p);
        final Object? la = pm['lat'];
        final Object? ln = pm['lng'];
        if (la is num && ln is num) {
          points.add(LatLng(la.toDouble(), ln.toDouble()));
        }
      }
      if (points.length < 2) return null;
      final double distanceKm = dist.toDouble();
      if (distanceKm <= 0) return null;
      return RiderDrivingRoute(points: points, distanceKm: distanceKm);
    } on DioException catch (e) {
      final int? code = e.response?.statusCode;
      if (code == 400 ||
          code == 404 ||
          code == 429 ||
          code == 502 ||
          code == 503) {
        return null;
      }
      throw Exception(_friendlyDioError(e));
    }
  }

  Future<List<dynamic>> listVehicleTypes() async =>
      _list('/rides/vehicle-types');
  Future<Map<String, dynamic>> estimateRideFare(
          Map<String, dynamic> body) async =>
      _map('/rides/estimate', body);
  Future<Map<String, dynamic>> estimateRideFareOptions(
          Map<String, dynamic> body) async =>
      _map('/rides/estimate/options', body);
  Future<Map<String, dynamic>> createRide(Map<String, dynamic> body) async =>
      _map('/rides', body);
  Future<List<dynamic>> listMyRides() async => _list('/rides/me');
  Future<Map<String, dynamic>> getRideById(String rideId) async =>
      _getMap('/rides/$rideId');
  Future<Map<String, dynamic>> updateRideStatus(String rideId, String status,
          {String? otp, String? cancellationReason}) =>
      _map('/rides/$rideId/status', <String, dynamic>{
        'status': status,
        if (otp != null && otp.isNotEmpty) 'otp': otp,
        if (cancellationReason != null && cancellationReason.trim().isNotEmpty)
          'cancellationReason': cancellationReason.trim(),
      });

  /// Public catalog: active coupons in their valid window with usage remaining.
  Future<List<dynamic>> listAvailableCoupons() async =>
      _list('/coupons/available');

  Future<Map<String, dynamic>> validateCoupon({
    required String code,
    required double fare,
    String? cityId,
    String? rideId,
  }) async =>
      _map('/coupons/validate', <String, dynamic>{
        'code': code,
        'fare': fare,
        if (cityId != null && cityId.isNotEmpty) 'cityId': cityId,
        if (rideId != null && rideId.isNotEmpty) 'rideId': rideId,
      });

  Future<Map<String, dynamic>> applyCoupon({
    required String code,
    required String rideId,
    required double fare,
  }) async =>
      _map('/coupons/apply', <String, dynamic>{
        'code': code,
        'rideId': rideId,
        'fare': fare,
      });

  /// Optional [cityId] filters in-app “active in window” offers for that city.
  Future<List<dynamic>> listOffers({String? cityId}) async => _list('/offers',
      query: cityId != null && cityId.isNotEmpty
          ? <String, dynamic>{'cityId': cityId}
          : null);

  Future<Map<String, dynamic>> estimateParcelFare(
          Map<String, dynamic> body) async =>
      _map('/parcels/estimate', body);
  Future<Map<String, dynamic>> estimateParcelFareOptions(
          Map<String, dynamic> body) async =>
      _map('/parcels/estimate/options', body);
  Future<Map<String, dynamic>> createParcel(Map<String, dynamic> body) async =>
      _map('/parcels', body);
  Future<List<dynamic>> listMyParcels() async => _list('/parcels/me');
  Future<Map<String, dynamic>> getParcelById(String parcelId) async =>
      _getMap('/parcels/$parcelId');
  Future<Map<String, dynamic>> updateParcelStatus(
          String parcelId, String status, {String? otp}) =>
      _map('/parcels/$parcelId/status', <String, dynamic>{
        'status': status,
        if (otp != null && otp.isNotEmpty) 'otp': otp
      });

  Future<List<dynamic>> listPaymentMethods({String app = 'rider'}) => _list(
      '/payments/methods/list',
      query: <String, dynamic>{'app': app, 'country': 'np', 'currency': 'NPR'});
  Future<Map<String, dynamic>> createPaymentIntent(Map<String, dynamic> body) =>
      _map('/payments/intent', body);
  Future<List<dynamic>> paymentTimeline(String paymentId) =>
      _list('/payments/$paymentId/timeline');

  Future<List<dynamic>> listConversations() async =>
      _list('/messages/conversations');
  Future<Map<String, dynamic>> startConversation({
    required String participantUserId,
    String? rideId,
  }) =>
      _map('/messages/conversations', <String, dynamic>{
        'participantUserId': participantUserId,
        if (rideId != null && rideId.isNotEmpty) 'rideId': rideId,
      });

  /// Opens or resumes the rider ↔ admin support thread (primary active admin).
  Future<Map<String, dynamic>> ensureSupportConversation() async {
    try {
      final response = await _dio.post(
        '/messages/support/conversation',
        options: _authOptions,
      );
      final Object? data = response.data;
      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }
      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Unexpected response from support/conversation',
        response: response,
        type: DioExceptionType.badResponse,
      );
    } on DioException catch (e) {
      throw Exception(_friendlyDioError(e));
    }
  }

  Future<List<dynamic>> listMessages(String conversationId) =>
      _list('/messages/conversations/$conversationId/messages');
  Future<Map<String, dynamic>> sendMessage(
          String conversationId, String content) =>
      _map('/messages/conversations/$conversationId/messages',
          <String, dynamic>{'content': content});

  Future<Map<String, dynamic>> getMyRatingSummary() =>
      _getMap('/ratings/me/summary');
  Future<List<dynamic>> listMyRatings() => _list('/ratings/me');
  Future<Map<String, dynamic>> createRating({
    required String rideId,
    required String toUserId,
    required int score,
    String? comment,
  }) =>
      _map('/ratings', <String, dynamic>{
        'rideId': rideId,
        'toUserId': toUserId,
        'score': score,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      });
  Future<Map<String, dynamic>> getUserRatingSummary(String userId) =>
      _getMap('/ratings/users/$userId/summary');

  Future<Map<String, dynamic>> createReport({
    required String reportedUserId,
    required String reason,
    String? description,
    String? rideId,
  }) =>
      _map('/reports', <String, dynamic>{
        'reportedUserId': reportedUserId,
        'reason': reason,
        if (description != null && description.isNotEmpty)
          'description': description,
        if (rideId != null && rideId.isNotEmpty) 'rideId': rideId,
      });

  Future<List<dynamic>> listMyReports() => _list('/reports/me');

  Future<List<dynamic>> _list(String path,
      {Map<String, dynamic>? query}) async {
    try {
      final response =
          await _dio.get(path, queryParameters: query, options: _authOptions);
      final data = response.data;
      if (data is List) return data;
      if (data is Map<String, dynamic> && data['methods'] is List) {
        return List<dynamic>.from(data['methods'] as List);
      }
      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Unexpected list response from $path',
        response: response,
        type: DioExceptionType.badResponse,
      );
    } on DioException catch (e) {
      throw Exception(_friendlyDioError(e));
    }
  }

  Future<Map<String, dynamic>> _getMap(String path,
      {Map<String, dynamic>? query}) async {
    try {
      final response =
          await _dio.get(path, queryParameters: query, options: _authOptions);
      if (response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }
      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Unexpected map response from $path',
        response: response,
        type: DioExceptionType.badResponse,
      );
    } on DioException catch (e) {
      throw Exception(_friendlyDioError(e));
    }
  }

  Future<Map<String, dynamic>> _map(
      String path, Map<String, dynamic> body) async {
    try {
      final response = await _dio.post(path, data: body, options: _authOptions);
      if (response.data is Map) {
        return Map<String, dynamic>.from(response.data as Map);
      }
      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Unexpected map response from $path',
        response: response,
        type: DioExceptionType.badResponse,
      );
    } on DioException catch (e) {
      throw Exception(_friendlyDioError(e));
    }
  }

  String _friendlyDioError(DioException e) {
    final dynamic data = e.response?.data;
    if (data is Map && data['error'] != null) {
      return data['error'].toString();
    }
    final int? code = e.response?.statusCode;
    if (code == 401) {
      return 'Session expired or unauthorized. Please sign in again.';
    }
    if (code == 403) {
      return 'You are not allowed to do this. If you are signed in with the right account, try again or contact support.';
    }
    if (e.message != null && e.message!.trim().isNotEmpty) {
      return e.message!.trim();
    }
    return 'Request failed. Please try again.';
  }
}

class RiderDrivingRoute {
  const RiderDrivingRoute({required this.points, required this.distanceKm});

  final List<LatLng> points;
  final double distanceKm;
}
