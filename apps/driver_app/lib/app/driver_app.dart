import 'package:flutter/material.dart';
import '../features/home/driver_home_page.dart';

class DriverApp extends StatelessWidget {
  const DriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Driver App',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.blue),
      home: const DriverHomePage(),
    );
  }
}
