import 'package:flutter/material.dart';

import 'enums.dart';

export 'enums.dart';

/// Snackbars tied to [Theme.of] / [ScaffoldMessenger].
///
/// ```dart
/// context.showAppSnackBar('Saved', type: AppSnackBarType.success);
/// ```
extension AppSnackbars on BuildContext {
  /// Clears queued snackbars, then shows a floating bar for [type].
  void showAppSnackBar(
    String message, {
    AppSnackBarType type = AppSnackBarType.error,
  }) {
    if (!mounted) return;
    final ScaffoldMessengerState? messenger = ScaffoldMessenger.maybeOf(this);
    if (messenger == null) return;
    final ColorScheme scheme = Theme.of(this).colorScheme;
    final (Color backgroundColor, Color foregroundColor) = switch (type) {
      AppSnackBarType.error => (scheme.error, scheme.onError),
      AppSnackBarType.info => (
          scheme.primaryContainer,
          scheme.onPrimaryContainer,
        ),
      AppSnackBarType.success => (
          scheme.tertiaryContainer,
          scheme.onTertiaryContainer,
        ),
    };

    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: TextStyle(fontSize: 13, color: foregroundColor),
        ),
        backgroundColor: backgroundColor,
      ),
    );
  }
}
