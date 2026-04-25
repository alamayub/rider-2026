import assert from 'node:assert/strict';
import test from 'node:test';
import { createRideRecord, getUserRatingStats, resetMemoryStore } from '../db/store.js';
import { signIn } from '../modules/auth/auth.service.js';
import { createRating } from '../modules/ratings/ratings.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

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
