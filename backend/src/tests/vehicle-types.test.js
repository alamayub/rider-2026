import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryStore } from '../db/store.js';
import { estimateFare } from '../modules/rides/rides.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

test('estimate fare varies by vehicle type multiplier', async () => {
  const bikeFare = await estimateFare({ cityId: 'blr', distanceKm: 10, vehicleTypeId: 'vt-bike' });
  const premiumFare = await estimateFare({ cityId: 'blr', distanceKm: 10, vehicleTypeId: 'vt-premium' });

  assert.equal(bikeFare.vehicleTypeId, 'vt-bike');
  assert.equal(premiumFare.vehicleTypeId, 'vt-premium');
  assert.ok(premiumFare.amount > bikeFare.amount);
});
