import 'package:dio/dio.dart';

class DriverApi {
  DriverApi({required this.baseUrl}) : _dio = Dio(BaseOptions(baseUrl: baseUrl));

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
        'role': 'driver',
        'password': password,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<void> requestOtp({required String phone}) async {
    await _dio.post(
      '/auth/request-otp',
      data: <String, dynamic>{'phone': phone, 'role': 'driver'},
    );
  }

  Future<Map<String, dynamic>> getDriverAnalytics() async => _getMap('/analytics/driver');

  Future<List<dynamic>> listMyRides() async => _list('/rides/me');

  Future<Map<String, dynamic>> updateRideStatus({
    required String rideId,
    required String status,
    String? otp,
  }) async =>
      _map('/rides/$rideId/status', <String, dynamic>{
        'status': status,
        if (otp != null && otp.isNotEmpty) 'otp': otp,
      });

  Future<List<dynamic>> listVehicleTypes() async => _list('/rides/vehicle-types');

  Future<List<dynamic>> listDriverVehicles() async => _list('/driver-vehicles');

  Future<Map<String, dynamic>> addDriverVehicle({
    required String vehicleTypeId,
    required String plateNumber,
    required String modelName,
    required String color,
    bool isActive = true,
    bool isDefault = false,
  }) async =>
      _map('/driver-vehicles', <String, dynamic>{
        'vehicleTypeId': vehicleTypeId,
        'plateNumber': plateNumber,
        'modelName': modelName,
        'color': color,
        'isActive': isActive,
        'isDefault': isDefault,
      });

  Future<Map<String, dynamic>> getMyKyc() async => _getMap('/driver-kyc/me');

  Future<Map<String, dynamic>> submitKyc({
    required String fullName,
    required String licenseNumber,
    required String documentUrl,
  }) async =>
      _map('/driver-kyc/submit', <String, dynamic>{
        'fullName': fullName,
        'licenseNumber': licenseNumber,
        'documentUrl': documentUrl,
      });

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

  Future<Map<String, dynamic>> getMyRatingSummary() async => _getMap('/ratings/me/summary');
  Future<List<dynamic>> listMyRatings() async => _list('/ratings/me');

  Future<Map<String, dynamic>> createRating({
    required String rideId,
    required String toUserId,
    required int score,
    String? comment,
  }) async =>
      _map('/ratings', <String, dynamic>{
        'rideId': rideId,
        'toUserId': toUserId,
        'score': score,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      });

  Future<Map<String, dynamic>> getUserRatingSummary(String userId) async => _getMap('/ratings/users/$userId/summary');

  Future<List<dynamic>> _list(String path, {Map<String, dynamic>? query}) async {
    final response = await _dio.get(path, queryParameters: query, options: _authOptions);
    if (response.data is List) return response.data as List<dynamic>;
    throw DioException(
      requestOptions: response.requestOptions,
      message: 'Unexpected list response from $path',
      response: response,
      type: DioExceptionType.badResponse,
    );
  }

  Future<Map<String, dynamic>> _getMap(String path, {Map<String, dynamic>? query}) async {
    final response = await _dio.get(path, queryParameters: query, options: _authOptions);
    if (response.data is Map) return Map<String, dynamic>.from(response.data as Map);
    throw DioException(
      requestOptions: response.requestOptions,
      message: 'Unexpected map response from $path',
      response: response,
      type: DioExceptionType.badResponse,
    );
  }

  Future<Map<String, dynamic>> _map(String path, Map<String, dynamic> body) async {
    final response = await _dio.post(path, data: body, options: _authOptions);
    if (response.data is Map) return Map<String, dynamic>.from(response.data as Map);
    throw DioException(
      requestOptions: response.requestOptions,
      message: 'Unexpected map response from $path',
      response: response,
      type: DioExceptionType.badResponse,
    );
  }
}

