import 'package:dio/dio.dart';

class ApiClient {
  ApiClient(String baseUrl) : _dio = Dio(BaseOptions(baseUrl: baseUrl));

  final Dio _dio;

  Future<Response<dynamic>> get(String path, {Map<String, dynamic>? query}) {
    return _dio.get(path, queryParameters: query);
  }

  Future<Response<dynamic>> post(String path, {Object? body}) {
    return _dio.post(path, data: body);
  }
}
