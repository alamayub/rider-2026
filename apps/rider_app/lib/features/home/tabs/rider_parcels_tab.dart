import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../core/booking_payloads.dart';
import '../../../core/rider_api.dart';
import '../../booking/booking_map_sheet.dart';
import '../widgets/console_widgets.dart';

class RiderParcelsTab extends HookWidget {
  const RiderParcelsTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context) {
    final plLat = useTextEditingController(text: '12.97160');
    final plLng = useTextEditingController(text: '77.59460');
    final drLat = useTextEditingController(text: '12.94000');
    final drLng = useTextEditingController(text: '77.60000');
    final distance = useTextEditingController(text: '5');
    final weight = useTextEditingController(text: '2');
    final itemDescription = useTextEditingController(text: 'Sample parcel');
    final senderName = useTextEditingController(text: 'Rider Sender');
    final senderPhone = useTextEditingController(text: '9800000001');
    final receiverName = useTextEditingController(text: 'Receiver');
    final receiverPhone = useTextEditingController(text: '9800000999');
    final receiverEmail =
        useTextEditingController(text: 'receiver@example.com');
    final receiverAddress = useTextEditingController(text: 'Maitighar');
    final parcelId = useTextEditingController();
    final otp = useTextEditingController();
    final status = useTextEditingController(text: 'picked_up');
    final selectedCityId = useState<String?>(null);
    final selectedVehicleTypeId = useState<String?>(null);
    final estimateResult = useState<Object?>(null);
    final createResult = useState<Object?>(null);
    final parcelDetail = useState<Object?>(null);
    final error = useState<String?>(null);
    final refresh = useState(0);

    final future = useMemoized(
      () => Future.wait<dynamic>(<Future<dynamic>>[
        api.listCities(),
        api.listVehicleTypes(),
        api.listMyParcels()
      ]),
      <Object?>[refresh.value],
    );
    final snap = useFuture(future);
    if (snap.connectionState != ConnectionState.done) {
      return const Center(child: CircularProgressIndicator());
    }
    if (snap.hasError) return RiderErrorView(error: snap.error);
    final cities = snap.data?[0] as List<dynamic>? ?? <dynamic>[];
    final vehicleTypes = snap.data?[1] as List<dynamic>? ?? <dynamic>[];
    final parcels = snap.data?[2] as List<dynamic>? ?? <dynamic>[];

    useEffect(
      () {
        if (selectedCityId.value == null && cities.isNotEmpty) {
          final m = Map<String, dynamic>.from(cities.first as Map);
          selectedCityId.value = (m['id'] ?? m['code'] ?? '').toString();
        }
        if (selectedVehicleTypeId.value == null && vehicleTypes.isNotEmpty) {
          final m = Map<String, dynamic>.from(vehicleTypes.first as Map);
          selectedVehicleTypeId.value = (m['id'] ?? m['code'] ?? '').toString();
        }
        return null;
      },
      <Object?>[cities.length, vehicleTypes.length, snap.data],
    );

    final cid = selectedCityId.value?.trim() ?? '';
    final vtid = selectedVehicleTypeId.value?.trim() ?? '';

    Future<void> estimateParcel() async {
      if (cid.isEmpty || vtid.isEmpty) {
        error.value = 'Select city and vehicle type';
        return;
      }
      error.value = null;
      try {
        estimateResult.value = await api.estimateParcelFare(<String, dynamic>{
          'cityId': cid,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'weightKg': double.tryParse(weight.text.trim()) ?? 0,
          'vehicleTypeId': vtid,
        });
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> createParcel() async {
      if (cid.isEmpty || vtid.isEmpty) {
        error.value = 'Select city and vehicle type';
        return;
      }
      final pickup = geoPoint(double.tryParse(plLat.text.trim()) ?? 0,
          double.tryParse(plLng.text.trim()) ?? 0);
      final drop = geoPoint(double.tryParse(drLat.text.trim()) ?? 0,
          double.tryParse(drLng.text.trim()) ?? 0);
      error.value = null;
      try {
        createResult.value = await api.createParcel(<String, dynamic>{
          'cityId': cid,
          'pickup': pickup,
          'drop': drop,
          'distanceKm': double.tryParse(distance.text.trim()) ?? 0,
          'weightKg': double.tryParse(weight.text.trim()) ?? 0,
          'vehicleTypeId': vtid,
          'itemDescription': itemDescription.text.trim().isNotEmpty
              ? itemDescription.text.trim()
              : 'Item',
          'senderName': senderName.text.trim(),
          'senderPhone': senderPhone.text.trim(),
          'receiverName': receiverName.text.trim(),
          'receiverPhone': receiverPhone.text.trim(),
          'receiverEmail': receiverEmail.text.trim(),
          'receiverAddress': receiverAddress.text.trim(),
        });
        if (createResult.value is Map) {
          final m = createResult.value as Map<String, dynamic>;
          if ((m['id'] ?? '') != '') {
            parcelId.text = m['id'].toString();
          }
        }
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> updateStatus() async {
      error.value = null;
      try {
        createResult.value = await api.updateParcelStatus(
          parcelId.text.trim(),
          status.text.trim(),
          otp: otp.text.trim().isNotEmpty ? otp.text.trim() : null,
        );
        refresh.value++;
      } catch (e) {
        error.value = e.toString();
      }
    }

    Future<void> getParcelDetail() async {
      final id = parcelId.text.trim();
      if (id.isEmpty) return;
      error.value = null;
      try {
        parcelDetail.value = await api.getParcelById(id);
      } catch (e) {
        error.value = e.toString();
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        if (cities.isNotEmpty)
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'City'),
            isExpanded: true,
            initialValue: cid.isEmpty ? null : cid,
            items: cities.map((dynamic c) {
              final m = Map<String, dynamic>.from(c as Map);
              final id = (m['id'] ?? m['code'] ?? '').toString();
              return DropdownMenuItem<String>(
                  value: id, child: Text('${m['name'] ?? id}'));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                selectedCityId.value = v;
              }
            },
          ),
        if (vehicleTypes.isNotEmpty)
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Vehicle type'),
            isExpanded: true,
            initialValue: vtid.isEmpty ? null : vtid,
            items: vehicleTypes.map((dynamic c) {
              final m = Map<String, dynamic>.from(c as Map);
              final id = (m['id'] ?? m['code'] ?? '').toString();
              return DropdownMenuItem<String>(
                  value: id, child: Text('${m['name'] ?? id}'));
            }).toList(),
            onChanged: (v) {
              if (v != null) {
                selectedVehicleTypeId.value = v;
              }
            },
          ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: () async {
            final BookingMapResult? r = await showBookingMapSheet(
              context: context,
              api: api,
              kind: BookingMapKind.parcel,
            );
            if (r == null) return;
            plLat.text = r.pickup.latitude.toStringAsFixed(5);
            plLng.text = r.pickup.longitude.toStringAsFixed(5);
            drLat.text = r.drop.latitude.toStringAsFixed(5);
            drLng.text = r.drop.longitude.toStringAsFixed(5);
            distance.text = r.distanceKm.toStringAsFixed(2);
            selectedCityId.value = r.cityId;
            error.value = null;
          },
          icon: const Icon(Icons.map_outlined),
          label: const Text('Set pickup & drop on map'),
        ),
        const SizedBox(height: 6),
        Text(
          'Distance (km) is straight-line from the map — adjust if you use route distance.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Row(
          children: <Widget>[
            Expanded(
                child: TextField(
                    controller: distance,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Distance km'))),
            const SizedBox(width: 8),
            Expanded(
                child: TextField(
                    controller: weight,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Weight kg'))),
          ],
        ),
        TextField(
            controller: itemDescription,
            decoration: const InputDecoration(
                labelText: 'Item description (required in DB layer)')),
        TextField(
            controller: senderName,
            decoration: const InputDecoration(labelText: 'Sender name')),
        TextField(
            controller: senderPhone,
            decoration: const InputDecoration(labelText: 'Sender phone')),
        TextField(
            controller: receiverName,
            decoration: const InputDecoration(labelText: 'Receiver name')),
        TextField(
            controller: receiverPhone,
            decoration: const InputDecoration(labelText: 'Receiver phone')),
        TextField(
            controller: receiverEmail,
            decoration: const InputDecoration(labelText: 'Receiver email')),
        TextField(
            controller: receiverAddress,
            decoration: const InputDecoration(labelText: 'Receiver address')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: estimateParcel,
                child: const Text('Estimate parcel fare')),
            OutlinedButton(
                onPressed: createParcel, child: const Text('Create parcel')),
          ],
        ),
        const Divider(height: 24),
        const Text('Status / detail',
            style: TextStyle(fontWeight: FontWeight.bold)),
        TextField(
            controller: parcelId,
            decoration: const InputDecoration(labelText: 'Parcel id')),
        TextField(
            controller: status,
            decoration: const InputDecoration(
                labelText: 'Status: picked_up, in_transit, delivered, ...')),
        TextField(
            controller: otp,
            decoration: const InputDecoration(
                labelText: 'Handoff / pickup OTP when required')),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            ElevatedButton(
                onPressed: updateStatus,
                child: const Text('Update parcel status')),
            OutlinedButton(
                onPressed: getParcelDetail,
                child: const Text('Get parcel detail')),
          ],
        ),
        if (estimateResult.value != null)
          RiderJsonPanel(title: 'Parcel estimate', data: estimateResult.value),
        if (createResult.value != null)
          RiderJsonPanel(title: 'Parcel result', data: createResult.value),
        if (parcelDetail.value != null)
          RiderJsonPanel(title: 'Parcel detail', data: parcelDetail.value),
        if (error.value != null)
          Text(error.value!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
        RiderJsonPanel(title: 'My parcels', data: parcels),
      ],
    );
  }
}
