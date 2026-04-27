import assert from 'node:assert/strict';
import test from 'node:test';
import { countRides } from '../db/store.js';
import { createRide, estimateFare, resolveCityForLocation, updateRideStatus } from '../services/rides.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('estimate fare uses city config', async () => {
  const estimate = await estimateFare({ cityId: 'blr', distanceKm: 10, vehicleTypeId: 'vt-cab' });
  assert.equal(estimate.amount, 220);
});

test('resolveCityForLocation returns nearest in-service city', async () => {
  const b = await resolveCityForLocation(12.97, 77.59);
  assert.ok(b);
  const id = String(b.id ?? '');
  const code = String(b.code ?? '');
  const name = String(b.name ?? '').toLowerCase();
  assert.ok(
    id === 'blr' || code === 'blr' || name.includes('bengaluru'),
    `expected Bengaluru service city, got id=${id} code=${code} name=${b.name}`
  );
  assert.ok(typeof b.matchedDistanceKm === 'number');
});

test('resolveCityForLocation returns null far from any service area', async () => {
  const out = await resolveCityForLocation(48.8566, 2.3522);
  assert.equal(out, null);
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
