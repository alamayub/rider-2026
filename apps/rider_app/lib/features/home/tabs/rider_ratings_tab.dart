import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../core/rider_api.dart';
import '../widgets/console_widgets.dart';

class RiderRatingsTab extends HookWidget {
  const RiderRatingsTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final targetUser = useTextEditingController();
    final rideId = useTextEditingController();
    final score = useTextEditingController(text: '5');
    final comment = useTextEditingController();
    final lookupUser = useTextEditingController();
    final reportUser = useTextEditingController();
    final reportReason = useTextEditingController(text: 'driver_behaviour');
    final reportDescription = useTextEditingController();
    final reportRideId = useTextEditingController();
    final error = useState<String?>(null);
    final refresh = useState(0);

    final ratingsFuture = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.getMyRatingSummary(),
        api.listMyRatings(),
        api.listMyReports()
      ]),
      <Object?>[refresh.value],
    );
    final ratingsSnap = useFuture(ratingsFuture);

    Future<void> submitRating() async {
      error.value = null;
      try {
        await api.createRating(
          rideId: rideId.text.trim(),
          toUserId: targetUser.text.trim(),
          score: int.tryParse(score.text.trim()) ?? 5,
          comment: comment.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> lookupRating() async {
      error.value = null;
      try {
        await api.getUserRatingSummary(lookupUser.text.trim());
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> submitReport() async {
      error.value = null;
      try {
        await api.createReport(
          reportedUserId: reportUser.text.trim(),
          reason: reportReason.text.trim(),
          description: reportDescription.text.trim(),
          rideId: reportRideId.text.trim(),
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    if (ratingsSnap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (ratingsSnap.hasError) {
      return RiderErrorView(error: ratingsSnap.error);
    }

    final myRatings = ratingsSnap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final myReports = ratingsSnap.data?[2] as List<dynamic>? ?? <dynamic>[];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            'You have ${myRatings.length} rating(s) and ${myReports.length} report(s).',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
        const Text('Rate Driver',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: rideId,
            decoration: const InputDecoration(labelText: 'Ride id')),
        TextField(
            controller: targetUser,
            decoration: const InputDecoration(labelText: 'Driver user id')),
        TextField(
            controller: score,
            decoration: const InputDecoration(labelText: 'Score (1-5)')),
        TextField(
            controller: comment,
            decoration: const InputDecoration(labelText: 'Comment')),
        ElevatedButton(
            onPressed: submitRating, child: const Text('Submit Rating')),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: lookupUser,
                    decoration: const InputDecoration(
                        labelText: 'Driver user id for summary'))),
            const SizedBox(width: 8),
            OutlinedButton(
                onPressed: lookupRating, child: const Text('Lookup')),
          ],
        ),
        const Divider(height: 28),
        const Text('Report Driver',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: reportUser,
            decoration:
                const InputDecoration(labelText: 'Reported driver user id')),
        TextField(
            controller: reportRideId,
            decoration: const InputDecoration(labelText: 'Ride id (optional)')),
        TextField(
            controller: reportReason,
            decoration: const InputDecoration(labelText: 'Reason')),
        TextField(
            controller: reportDescription,
            decoration: const InputDecoration(labelText: 'Description')),
        ElevatedButton(
            onPressed: submitReport, child: const Text('Submit Report')),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ],
    );
  }
}
