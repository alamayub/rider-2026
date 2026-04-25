import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateFare } from '../services/rides.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('estimate fare varies by vehicle type multiplier', async () => {
  const bikeFare = await estimateFare({ cityId: 'blr', distanceKm: 10, vehicleTypeId: 'vt-bike' });
  const premiumFare = await estimateFare({ cityId: 'blr', distanceKm: 10, vehicleTypeId: 'vt-premium' });

  assert.equal(bikeFare.vehicleTypeId, 'vt-bike');
  assert.equal(premiumFare.vehicleTypeId, 'vt-premium');
  assert.ok(premiumFare.amount > bikeFare.amount);
});
