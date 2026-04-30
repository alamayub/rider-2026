import 'package:flutter/material.dart';

import '../../../core/booking_payloads.dart';
import '../widgets/console_widgets.dart';

/// Styled list of rides for the Rides tab.
class RiderMyRidesSection extends StatelessWidget {
  const RiderMyRidesSection({
    super.key,
    required this.rides,
    required this.onUseRideId,
  });

  final List<dynamic> rides;
  final ValueChanged<String> onUseRideId;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme cs = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const SizedBox(height: 20),
        Row(
          children: <Widget>[
            Text(
              'My rides',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(width: 10),
            DecoratedBox(
              decoration: BoxDecoration(
                color: cs.primaryContainer,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                child: Text(
                  '${rides.length}',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: cs.onPrimaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Tap a card to load its id into the tools above.',
          style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        if (rides.isEmpty)
          Card(
            elevation: 0,
            color: cs.surfaceContainerLow,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
              child: Column(
                children: <Widget>[
                  Icon(Icons.directions_car_outlined, size: 40, color: cs.outline),
                  const SizedBox(height: 12),
                  Text(
                    'No rides yet',
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Request a ride above — your trips will show up here.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          )
        else
          ...rides.map((dynamic raw) {
            final Map<String, dynamic> m = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RiderRideCard(ride: m, onUseRideId: onUseRideId),
            );
          }),
        if (rides.isNotEmpty) ...<Widget>[
          const SizedBox(height: 4),
          Theme(
            data: theme.copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(bottom: 8),
              title: Text(
                'Raw API response',
                style: theme.textTheme.labelLarge?.copyWith(color: cs.onSurfaceVariant),
              ),
              children: <Widget>[RiderJsonPanel(title: 'rides/me', data: rides)],
            ),
          ),
        ],
      ],
    );
  }
}

class _RiderRideCard extends StatelessWidget {
  const _RiderRideCard({required this.ride, required this.onUseRideId});

  final Map<String, dynamic> ride;
  final ValueChanged<String> onUseRideId;

  static String _formatStatus(String raw) {
    final String s = raw.replaceAll('_', ' ').trim();
    if (s.isEmpty) return '—';
    return s.split(RegExp(r'\s+')).map((String w) {
      if (w.isEmpty) return w;
      return w[0].toUpperCase() + (w.length > 1 ? w.substring(1).toLowerCase() : '');
    }).join(' ');
  }

  static String? _formatGeo(Object? geo) {
    if (geo is! Map) return null;
    final Map<String, dynamic> m = Map<String, dynamic>.from(geo);
    final double? lat = (m['lat'] as num?)?.toDouble();
    final double? lng = (m['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return null;
    return '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme cs = theme.colorScheme;
    final String statusRaw = (ride['status'] ?? '').toString();
    final String statusLabel = _formatStatus(statusRaw);
    final String id = (ride['id'] ?? '').toString();
    final Object? fareRaw = ride['fare'] ?? ride['amount'];
    final String? fareText = fareRaw?.toString();
    final String? pickupLine = _formatGeo(ride['pickup']);
    final String? dropLine = _formatGeo(ride['drop'] ?? ride['drop_location']);
    final String? otp = readRideStartOtp(ride);
    final String? created =
        (ride['createdAt'] ?? ride['created_at'] ?? ride['updatedAt'] ?? ride['updated_at'])
            ?.toString();

    final _RideStatusLook look = _RideStatusLook.fromStatus(statusRaw, cs: cs);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: id.isEmpty ? null : () => onUseRideId(id),
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.65)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[
                cs.surfaceContainerLowest,
                cs.surfaceContainerLow.withValues(alpha: 0.92),
              ],
            ),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: cs.shadow.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: look.chipBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: Text(
                          statusLabel,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: look.chipFg,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (fareText != null)
                      Text(
                        fareText,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Icon(Icons.tag, size: 16, color: cs.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Expanded(
                      child: SelectableText(
                        id.isEmpty ? '—' : id,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (id.isNotEmpty)
                      TextButton.icon(
                        onPressed: () => onUseRideId(id),
                        icon: const Icon(Icons.content_paste_go_rounded, size: 18),
                        label: const Text('Use id'),
                        style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                      ),
                  ],
                ),
                if (created != null && created.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 4),
                  Row(
                    children: <Widget>[
                      Icon(Icons.schedule, size: 15, color: cs.outline),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          created,
                          style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                if (pickupLine != null || dropLine != null) ...<Widget>[
                  const SizedBox(height: 10),
                  if (pickupLine != null)
                    _RideGeoRow(icon: Icons.trip_origin, label: 'Pickup', value: pickupLine, cs: cs, theme: theme),
                  if (dropLine != null) ...<Widget>[
                    const SizedBox(height: 6),
                    _RideGeoRow(icon: Icons.flag, label: 'Drop-off', value: dropLine, cs: cs, theme: theme),
                  ],
                ],
                if (otp != null) ...<Widget>[
                  const SizedBox(height: 14),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: cs.primaryContainer.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Icon(Icons.lock_outline, size: 18, color: cs.onPrimaryContainer),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Trip start code',
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    color: cs.onPrimaryContainer,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          SelectableText(
                            otp,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              letterSpacing: 8,
                              fontWeight: FontWeight.w800,
                              color: cs.onPrimaryContainer,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Share with your driver to begin the trip.',
                            style: theme.textTheme.bodySmall?.copyWith(color: cs.onPrimaryContainer.withValues(alpha: 0.9)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RideGeoRow extends StatelessWidget {
  const _RideGeoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.cs,
    required this.theme,
  });

  final IconData icon;
  final String label;
  final String value;
  final ColorScheme cs;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(icon, size: 16, color: cs.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(label, style: theme.textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant)),
              Text(
                value,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RideStatusLook {
  const _RideStatusLook({required this.chipBg, required this.chipFg});

  final Color chipBg;
  final Color chipFg;

  factory _RideStatusLook.fromStatus(String raw, {required ColorScheme cs}) {
    final String s = raw.toLowerCase();
    if (s.contains('cancel')) {
      return _RideStatusLook(chipBg: cs.errorContainer, chipFg: cs.onErrorContainer);
    }
    if (s == 'completed') {
      return _RideStatusLook(
        chipBg: cs.tertiaryContainer,
        chipFg: cs.onTertiaryContainer,
      );
    }
    if (s == 'in_progress' || s == 'arrived') {
      return _RideStatusLook(chipBg: cs.secondaryContainer, chipFg: cs.onSecondaryContainer);
    }
    if (s == 'matched' || s == 'requested') {
      return _RideStatusLook(chipBg: cs.primaryContainer, chipFg: cs.onPrimaryContainer);
    }
    return _RideStatusLook(chipBg: cs.surfaceContainerHighest, chipFg: cs.onSurfaceVariant);
  }
}
