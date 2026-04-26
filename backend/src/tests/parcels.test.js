import assert from 'node:assert/strict';
import test from 'node:test';
import { findPayoutLedgerByParcelId, upsertDriverLocation } from '../db/store.js';
import { addDriverVehicle } from '../services/driver-vehicles.service.js';
import { createParcel, estimateParcelFare, updateParcelStatus } from '../services/parcels.service.js';
import { signIn } from '../services/auth.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('parcel flow estimates fare and matches correct vehicle driver', async () => {
  const rider = (await signIn({ phone: '+917700000001', role: 'rider', password: 'Pass@123' })).user;
  const driver = (await signIn({ phone: '+917700000002', role: 'driver', password: 'Pass@123' })).user;

  await addDriverVehicle({
    driverId: driver.id,
    vehicleTypeId: 'vt-seater6',
    plateNumber: 'KA05AB1234',
    isActive: true,
    isDefault: true
  });

  await upsertDriverLocation({ driverId: driver.id, cityId: 'blr', lat: 12.95, lng: 77.58, online: true });

  const estimate = await estimateParcelFare({ cityId: 'blr', distanceKm: 8, vehicleTypeId: 'vt-seater6', weightKg: 3 });
  assert.equal(estimate.vehicleTypeId, 'vt-seater6');
  assert.ok(estimate.amount > 0);

  const parcel = await createParcel({
    senderUserId: rider.id,
    cityId: 'blr',
    pickup: { lat: 12.95, lng: 77.58 },
    drop: { lat: 12.98, lng: 77.62 },
    senderName: 'Sender One',
    senderPhone: '+918888888888',
    receiverName: 'Receiver One',
    receiverPhone: '+919999999999',
    receiverEmail: 'receiver@example.com',
    receiverAddress: 'MG Road, Bengaluru',
    itemDescription: 'Documents',
    weightKg: 3,
    distanceKm: 8,
    vehicleTypeId: 'vt-seater6'
  });

  assert.equal(parcel.status, 'matched');
  assert.equal(parcel.driverId, driver.id);
  assert.equal(parcel.senderName, 'Sender One');
  assert.equal(parcel.receiverEmail, 'receiver@example.com');
  assert.ok(parcel.handoffOtp);

  await assert.rejects(
    () => updateParcelStatus({ parcelId: parcel.id, status: 'picked_up', actorUserId: driver.id, otp: '000000' }),
    /Invalid pickup OTP/
  );

  const picked = await updateParcelStatus({
    parcelId: parcel.id,
    status: 'picked_up',
    actorUserId: driver.id,
    otp: parcel.handoffOtp
  });

  assert.equal(picked.status, 'picked_up');
  assert.ok(picked.pickupOtpVerifiedAt);

  const delivered = await updateParcelStatus({
    parcelId: parcel.id,
    status: 'delivered',
    actorUserId: driver.id,
    otp: parcel.handoffOtp
  });

  assert.equal(delivered.status, 'delivered');
  assert.ok(delivered.dropOtpVerifiedAt);

  const ledger = await findPayoutLedgerByParcelId(parcel.id);
  assert.ok(ledger);
  assert.equal(String(ledger.driverId), String(driver.id));
  assert.ok(Number(ledger.amount) > 0);
});
