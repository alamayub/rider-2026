import 'package:dio/dio.dart';

class AdminApi {
  AdminApi({required this.baseUrl}) : _dio = Dio(BaseOptions(baseUrl: baseUrl));

  final String baseUrl;
  final Dio _dio;
  String? _accessToken;

  set accessToken(String? value) {
    _accessToken = value;
  }

  Options get _authOptions => Options(
        headers: <String, String>{
          if (_accessToken != null && _accessToken!.isNotEmpty) 'Authorization': 'Bearer $_accessToken',
        },
      );

  Future<Map<String, dynamic>> signIn({
    required String phone,
    required String password,
  }) async {
    final response = await _dio.post(
      '/auth/signin',
      data: <String, dynamic>{
        'phone': phone,
        'role': 'admin',
        'password': password,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<void> requestOtp({required String phone}) async {
    await _dio.post(
      '/auth/request-otp',
      data: <String, dynamic>{'phone': phone, 'role': 'admin'},
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

  Future<Map<String, dynamic>> getMyNotificationStats() => _getMap('/notifications/me/stats');

  Future<Map<String, dynamic>> getAdminNotificationStats() => _getMap('/notifications/admin/stats');

  Future<Map<String, dynamic>> sendAdminNotification({
    required String recipientUserId,
    required String type,
    required String title,
    required String body,
    String channel = 'push',
    Map<String, dynamic>? payload,
  }) =>
      _map('/notifications/admin/send', <String, dynamic>{
        'recipientUserId': recipientUserId,
        'type': type,
        'title': title,
        'body': body,
        'channel': channel,
        if (payload != null) 'payload': payload,
      });

  Future<Map<String, dynamic>> markNotificationReceived(String notificationId) =>
      _map('/notifications/$notificationId/received', <String, dynamic>{});

  Future<Map<String, dynamic>> markNotificationDelivered(String notificationId) =>
      _map('/notifications/$notificationId/delivered', <String, dynamic>{});

  Future<Map<String, dynamic>> markNotificationRead(String notificationId) =>
      _map('/notifications/$notificationId/read', <String, dynamic>{});

  Future<List<dynamic>> getCities() async => _list('/admin/cities');
  Future<Map<String, dynamic>> createCity(String name, {bool isActive = true}) async =>
      _map('/admin/cities', <String, dynamic>{'name': name, 'isActive': isActive});
  Future<List<dynamic>> getLiveRides() async => _list('/admin/rides/live');
  Future<List<dynamic>> getReports() async => _list('/admin/reports');
  Future<Map<String, dynamic>> createReport({
    required String reportedUserId,
    required String reason,
    String? description,
    String? rideId,
  }) async =>
      _map('/reports', <String, dynamic>{
        'reportedUserId': reportedUserId,
        'reason': reason,
        if (description != null && description.isNotEmpty) 'description': description,
        if (rideId != null && rideId.isNotEmpty) 'rideId': rideId,
      });
  Future<List<dynamic>> listMyReports() async => _list('/reports/me');
  Future<List<dynamic>> getAuditLogs() async => _list('/admin/audit-logs');
  Future<List<dynamic>> getVehicleTypes() async => _list('/admin/vehicle-types');
  Future<Map<String, dynamic>> getRideById(String rideId) async => _getMap('/rides/$rideId');
  Future<Map<String, dynamic>> getParcelById(String parcelId) async => _getMap('/parcels/$parcelId');

  Future<Map<String, dynamic>> createVehicleType({
    required String id,
    required String code,
    required String name,
    required int capacity,
    required double fareMultiplier,
  }) async =>
      _map('/admin/vehicle-types', <String, dynamic>{
        'id': id,
        'code': code,
        'name': name,
        'capacity': capacity,
        'fareMultiplier': fareMultiplier,
        'isActive': true,
      });

  Future<Map<String, dynamic>> getAdminAnalytics() async => _getMap('/analytics/admin');

  Future<List<dynamic>> listDriverKyc({String? status}) async => _list(
        '/driver-kyc/admin',
        query: <String, dynamic>{if (status != null && status.isNotEmpty) 'status': status},
      );

  Future<Map<String, dynamic>> reviewDriverKyc({
    required String driverId,
    required String action,
    String? rejectionReason,
  }) async =>
      _map('/driver-kyc/admin/$driverId/review', <String, dynamic>{
        'action': action,
        if (rejectionReason != null && rejectionReason.isNotEmpty) 'rejectionReason': rejectionReason,
      });

  Future<Map<String, dynamic>> getPaymentsReconciliation() async => _getMap('/payments/admin/reconciliation');
  Future<List<dynamic>> getPaymentTimeline(String paymentId) async => _list('/payments/$paymentId/timeline');

  Future<Map<String, dynamic>> updatePaymentStatus({
    required String paymentId,
    required String status,
    String? providerPaymentId,
    String? failureCode,
    String? failureReason,
  }) async =>
      _patch('/payments/$paymentId/status', <String, dynamic>{
        'status': status,
        if (providerPaymentId != null && providerPaymentId.isNotEmpty) 'providerPaymentId': providerPaymentId,
        if (failureCode != null && failureCode.isNotEmpty) 'failureCode': failureCode,
        if (failureReason != null && failureReason.isNotEmpty) 'failureReason': failureReason,
      });

  Future<Map<String, dynamic>> createRefund({
    required String paymentId,
    required double amount,
    required String reason,
    String? providerRefundId,
  }) async =>
      _map('/payments/$paymentId/refunds', <String, dynamic>{
        'amount': amount,
        'reason': reason,
        if (providerRefundId != null && providerRefundId.isNotEmpty) 'providerRefundId': providerRefundId,
      });

  Future<Map<String, dynamic>> createPayout({
    required String paymentId,
    required String driverId,
    required double amount,
    String currency = 'NPR',
    String? note,
  }) async =>
      _map('/payments/$paymentId/payouts', <String, dynamic>{
        'driverId': driverId,
        'amount': amount,
        'currency': currency,
        if (note != null && note.isNotEmpty) 'note': note,
      });

  Future<Map<String, dynamic>> getGroupedPaymentMethods({String app = 'admin'}) async =>
      _getMap('/payments/methods/grouped', query: <String, dynamic>{'app': app, 'country': 'np', 'currency': 'NPR'});

  Future<Map<String, dynamic>> upsertPaymentMethod(Map<String, dynamic> body) async =>
      _map('/payments/methods/admin', body);

  Future<List<dynamic>> listConversations() async => _list('/messages/conversations');

  Future<Map<String, dynamic>> startConversation({
    required String participantUserId,
    String? rideId,
  }) async =>
      _map('/messages/conversations', <String, dynamic>{
        'participantUserId': participantUserId,
        if (rideId != null && rideId.isNotEmpty) 'rideId': rideId,
      });

  Future<List<dynamic>> listMessages(String conversationId) async =>
      _list('/messages/conversations/$conversationId/messages');

  Future<Map<String, dynamic>> sendMessage({
    required String conversationId,
    required String content,
  }) async =>
      _map('/messages/conversations/$conversationId/messages', <String, dynamic>{'content': content});

  Future<Map<String, dynamic>> getUserRatingSummary(String userId) async => _getMap('/ratings/users/$userId/summary');

  Future<List<dynamic>> _list(String path, {Map<String, dynamic>? query}) async {
    final response = await _dio.get(path, queryParameters: query, options: _authOptions);
    final data = response.data;
    if (data is List) return data;
    if (data is Map<String, dynamic> && data['methods'] is List) return List<dynamic>.from(data['methods'] as List);
    throw DioException(
      requestOptions: response.requestOptions,
      message: 'Unexpected list response from $path',
      response: response,
      type: DioExceptionType.badResponse,
    );
  }

  Future<Map<String, dynamic>> _getMap(String path, {Map<String, dynamic>? query}) async {
    final response = await _dio.get(path, queryParameters: query, options: _authOptions);
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

  Future<Map<String, dynamic>> _map(String path, Map<String, dynamic> body) async {
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

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) async {
    final response = await _dio.patch(path, data: body, options: _authOptions);
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

