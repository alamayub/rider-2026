import assert from 'node:assert/strict';
import test from 'node:test';
import { countRides, resetMemoryStore } from '../db/store.js';
import { createRide, estimateFare } from '../modules/rides/rides.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

test('estimate fare uses city config', async () => {
  const estimate = await estimateFare({ cityId: 'blr', distanceKm: 10 });
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
