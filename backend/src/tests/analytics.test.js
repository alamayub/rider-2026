import assert from 'node:assert/strict';
import test from 'node:test';
import { createPenaltyRecord, createRideRecord, listCities } from '../db/store.js';
import { signIn } from '../services/auth.service.js';
import { getAdminAnalytics, getDriverAnalytics, getRiderAnalytics } from '../services/analytics.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('driver rider admin analytics include earnings commission penalties and rides', async () => {
  const rider = (await signIn({ phone: '+910000001001', role: 'rider', password: 'Pass@123' })).user;
  const driver = (await signIn({ phone: '+910000001002', role: 'driver', password: 'Pass@123' })).user;
  const cities = await listCities();
  const cityId = cities[0]?.id;
  if (!cityId) throw new Error('No city');

  await createRideRecord({
    riderId: rider.id,
    driverId: driver.id,
    cityId,
    pickup: { lat: 1, lng: 1 },
    drop: { lat: 2, lng: 2 },
    fare: 500,
    status: 'completed',
    actorUserId: rider.id
  });

  await createRideRecord({
    riderId: rider.id,
    driverId: driver.id,
    cityId,
    pickup: { lat: 1, lng: 1 },
    drop: { lat: 3, lng: 3 },
    fare: 400,
    status: 'cancelled',
    actorUserId: rider.id
  });

  await createPenaltyRecord({ userId: driver.id, rideId: null, amount: 50, reason: 'Late arrival', actorUserId: 'admin' });

  const driverStats = await getDriverAnalytics(driver.id);
  const riderStats = await getRiderAnalytics(rider.id);
  const adminStats = await getAdminAnalytics();
  const match = adminStats.cityRevenue.find((c) => String(c.cityId) === String(cityId));
  if (match) {
    assert.equal(match.periods.all.commissionEarned, adminStats.periods.all.commissionEarned);
  }
  assert.equal(adminStats.platformRevenue.periods.all.commissionEarned, adminStats.periods.all.commissionEarned);

  assert.equal(driverStats.periods.all.totalRides, 2);
  assert.equal(driverStats.periods.all.completedRides, 1);
  assert.equal(driverStats.periods.all.cancelledRides, 1);
  assert.equal(driverStats.periods.all.grossEarnings, 500);
  assert.equal(driverStats.periods.all.commissionGiven, 100);
  assert.equal(driverStats.periods.all.penaltiesAmount, 50);

  assert.equal(riderStats.periods.all.totalRides, 2);
  assert.equal(riderStats.periods.all.totalSpent, 500);

  assert.equal(adminStats.periods.all.totalRides, 2);
  assert.equal(adminStats.periods.all.commissionEarned, 100);
  assert.equal(adminStats.periods.all.penaltiesCollected, 50);
});
