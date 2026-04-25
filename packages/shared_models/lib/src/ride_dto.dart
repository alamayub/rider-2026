class RideDto {
  final String id;
  final String status;
  final int fare;

  RideDto({required this.id, required this.status, required this.fare});

  factory RideDto.fromJson(Map<String, dynamic> json) => RideDto(
        id: json['id'] as String,
        status: json['status'] as String,
        fare: (json['fare'] as num).toInt(),
      );
}
