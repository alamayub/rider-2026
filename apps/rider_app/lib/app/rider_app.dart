import 'package:flutter/material.dart';
import '../features/home/rider_home_page.dart';

class RiderApp extends StatelessWidget {
  const RiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rider App',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.green),
      home: const RiderHomePage(),
    );
  }
}
