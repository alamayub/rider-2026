import assert from 'node:assert/strict';
import test from 'node:test';
import { countRides, resetMemoryStore } from '../db/store.js';
import { createRide, estimateFare, updateRideStatus } from '../modules/rides/rides.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

test('estimate fare uses city config', async () => {
  const estimate = await estimateFare({ cityId: 'blr', distanceKm: 10, vehicleTypeId: 'vt-cab' });
  assert.equal(estimate.amount, 220);
});

test('create ride stores new ride', async () => {
  const before = await countRides();

  await createRide({
    riderId: 'rider-1',
    cityId: 'blr',
    pickup: { lat: 12.1, lng: 77.1 },
    drop: { lat: 12.2, lng: 77.2 },
    distanceKm: 5
  });

  const after = await countRides();
  assert.equal(after, before + 1);
});

test('ride start requires valid OTP before in_progress', async () => {
  const ride = await createRide({
    riderId: 'rider-otp-1',
    cityId: 'blr',
    pickup: { lat: 12.1, lng: 77.1 },
    drop: { lat: 12.2, lng: 77.2 },
    distanceKm: 5,
    vehicleTypeId: 'vt-cab'
  });

  await assert.rejects(
    () => updateRideStatus({ rideId: ride.id, status: 'in_progress', actorUserId: 'driver-otp-1', otp: '000000' }),
    /Invalid ride start OTP/
  );

  const started = await updateRideStatus({
    rideId: ride.id,
    status: 'in_progress',
    actorUserId: 'driver-otp-1',
    otp: ride.rideStartOtp
  });

  assert.equal(started.status, 'in_progress');
  assert.ok(started.rideStartOtpVerifiedAt);
});
