import 'package:flutter/material.dart';

class RiderErrorView extends StatelessWidget {
  const RiderErrorView({super.key, required this.error});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          error?.toString() ?? 'Unknown error',
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      ),
    );
  }
}

class RiderStatCard extends StatelessWidget {
  const RiderStatCard({super.key, required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 165,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Text(value, style: Theme.of(context).textTheme.titleLarge),
            ],
          ),
        ),
      ),
    );
  }
}
