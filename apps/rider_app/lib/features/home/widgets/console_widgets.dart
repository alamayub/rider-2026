import 'dart:convert';
import 'dart:developer';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

String _encodePrettyJson(Object? data) {
  try {
    return const JsonEncoder.withIndent('  ').convert(data);
  } catch (_) {
    return data?.toString() ?? 'null';
  }
}

/// Debug / console JSON panel shared across rider tabs.
class RiderJsonPanel extends HookWidget {
  const RiderJsonPanel({super.key, required this.title, required this.data});

  final String title;
  final Object? data;

  @override
  Widget build(BuildContext context) {
    final Future<String> jsonFuture =
        useMemoized(() => compute(_encodePrettyJson, data), <Object?>[data]);
    final AsyncSnapshot<String> jsonSnap = useFuture(jsonFuture);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SelectableText(
              jsonSnap.data ?? 'Formatting JSON...',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class RiderErrorView extends StatelessWidget {
  const RiderErrorView({super.key, required this.error});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    log('ERROR: ${error.toString()}');
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
