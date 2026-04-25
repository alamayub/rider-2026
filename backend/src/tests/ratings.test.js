import assert from 'node:assert/strict';
import test from 'node:test';
import { createRideRecord, getUserRatingStats } from '../db/store.js';
import { signIn } from '../services/auth.service.js';
import { createRating, getUserPublicRatingSummary } from '../services/ratings.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('rider and driver can rate each other once after completed ride', async () => {
  const rider = (await signIn({ phone: '+910000000001', role: 'rider', password: 'Pass@123' })).user;
  const driver = (await signIn({ phone: '+910000000002', role: 'driver', password: 'Pass@123' })).user;

  const ride = await createRideRecord({
    riderId: rider.id,
    driverId: driver.id,
    cityId: 'blr',
    pickup: { lat: 12.97, lng: 77.59 },
    drop: { lat: 12.99, lng: 77.61 },
    fare: 250,
    status: 'completed',
    actorUserId: rider.id
  });

  const riderRating = await createRating({
    rideId: ride.id,
    fromUserId: rider.id,
    toUserId: driver.id,
    score: 5,
    comment: 'Smooth trip'
  });
  const driverRating = await createRating({
    rideId: ride.id,
    fromUserId: driver.id,
    toUserId: rider.id,
    score: 4,
    comment: 'Good passenger'
  });

  assert.equal(riderRating.score, 5);
  assert.equal(driverRating.score, 4);
  assert.equal(riderRating.recipientStats.totalReceivedRatings, 1);
  assert.equal(Number(riderRating.recipientStats.averageReceivedRating), 5);
  assert.equal(driverRating.recipientStats.totalReceivedRatings, 1);
  assert.equal(Number(driverRating.recipientStats.averageReceivedRating), 4);

  const driverStats = await getUserRatingStats(driver.id);
  const riderStats = await getUserRatingStats(rider.id);
  assert.equal(driverStats.totalReceivedRatings, 1);
  assert.equal(Number(driverStats.averageReceivedRating), 5);
  assert.equal(riderStats.totalReceivedRatings, 1);
  assert.equal(Number(riderStats.averageReceivedRating), 4);

  await assert.rejects(
    () =>
      createRating({
        rideId: ride.id,
        fromUserId: rider.id,
        toUserId: driver.id,
        score: 3,
        comment: 'duplicate'
      }),
    /Rating already submitted for this direction/
  );
});

test('role-specific public rating summary allows rider<->driver only', async () => {
  const rider = (await signIn({ phone: '+910000000011', role: 'rider', password: 'Pass@123' })).user;
  const driver = (await signIn({ phone: '+910000000012', role: 'driver', password: 'Pass@123' })).user;
  const admin = (await signIn({ phone: '+910000000013', role: 'admin', password: 'Pass@123' })).user;

  const ride = await createRideRecord({
    riderId: rider.id,
    driverId: driver.id,
    cityId: 'blr',
    pickup: { lat: 12.97, lng: 77.59 },
    drop: { lat: 12.99, lng: 77.61 },
    fare: 250,
    status: 'completed',
    actorUserId: rider.id
  });
  await createRating({
    rideId: ride.id,
    fromUserId: rider.id,
    toUserId: driver.id,
    score: 5,
    comment: 'great'
  });

  const riderViewOfDriver = await getUserPublicRatingSummary({ viewerRole: 'rider', targetUserId: driver.id });
  assert.equal(riderViewOfDriver.role, 'driver');
  assert.equal(riderViewOfDriver.totalReceivedRatings, 1);

  const adminViewOfDriver = await getUserPublicRatingSummary({ viewerRole: 'admin', targetUserId: driver.id });
  assert.equal(adminViewOfDriver.role, 'driver');

  await assert.rejects(
    () => getUserPublicRatingSummary({ viewerRole: 'rider', targetUserId: rider.id }),
    /Forbidden rating summary access/
  );
  await assert.rejects(
    () => getUserPublicRatingSummary({ viewerRole: 'driver', targetUserId: admin.id }),
    /Forbidden rating summary access/
  );
});
