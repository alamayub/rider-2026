import 'package:dio/dio.dart';

class RiderApi {
  RiderApi({required this.baseUrl}) : _dio = Dio(BaseOptions(baseUrl: baseUrl));

  final String baseUrl;
  final Dio _dio;
  String? _accessToken;

  set accessToken(String? value) {
    _accessToken = value;
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

  Future<Map<String, dynamic>> registerDeviceToken({
    required String app,
    required String platform,
    required String token,
  }) async {
    return _map('/notifications/me/device-token', <String, dynamic>{
      'app': app,
      'platform': platform,
      'token': token,
    });
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

  Future<List<dynamic>> listVehicleTypes() async =>
      _list('/rides/vehicle-types');
  Future<Map<String, dynamic>> estimateRideFare(
          Map<String, dynamic> body) async =>
      _map('/rides/estimate', body);
  Future<Map<String, dynamic>> createRide(Map<String, dynamic> body) async =>
      _map('/rides', body);
  Future<List<dynamic>> listMyRides() async => _list('/rides/me');
  Future<Map<String, dynamic>> getRideById(String rideId) async =>
      _getMap('/rides/$rideId');
  Future<Map<String, dynamic>> updateRideStatus(String rideId, String status,
          {String? otp}) =>
      _map('/rides/$rideId/status', <String, dynamic>{
        'status': status,
        if (otp != null && otp.isNotEmpty) 'otp': otp
      });

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
    final response = await _dio.post('/messages/support/conversation');
    return Map<String, dynamic>.from(response.data as Map);
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
  }

  Future<Map<String, dynamic>> _getMap(String path,
      {Map<String, dynamic>? query}) async {
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
  }

  Future<Map<String, dynamic>> _map(
      String path, Map<String, dynamic> body) async {
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
  }
}
