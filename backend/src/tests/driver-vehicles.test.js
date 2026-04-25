import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertDriverLocation } from '../db/store.js';
import { signIn } from '../services/auth.service.js';
import { findNearestAvailableDriver } from '../services/dispatch.service.js';
import { addDriverVehicle } from '../services/driver-vehicles.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('dispatch selects only drivers with requested vehicle type', async () => {
  const driverBike = (await signIn({ phone: '+919900000001', role: 'driver', password: 'Pass@123' })).user;
  const driverPremium = (await signIn({ phone: '+919900000002', role: 'driver', password: 'Pass@123' })).user;

  await addDriverVehicle({
    driverId: driverBike.id,
    vehicleTypeId: 'vt-bike',
    plateNumber: 'KA01BK1111',
    isActive: true,
    isDefault: true
  });

  await addDriverVehicle({
    driverId: driverPremium.id,
    vehicleTypeId: 'vt-premium',
    plateNumber: 'KA01PR2222',
    isActive: true,
    isDefault: true
  });

  await upsertDriverLocation({ driverId: driverBike.id, cityId: 'blr', lat: 12.97, lng: 77.59, online: true });
  await upsertDriverLocation({ driverId: driverPremium.id, cityId: 'blr', lat: 12.98, lng: 77.6, online: true });

  const selectedPremium = await findNearestAvailableDriver('blr', { lat: 12.96, lng: 77.58 }, 'vt-premium');
  assert.equal(selectedPremium, driverPremium.id);
});
