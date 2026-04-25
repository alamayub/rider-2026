import {
  createRideRecord,
  createCouponRedemptionRecord,
  findCouponByCode,
  findCityById,
  findRideById,
  incrementCouponUsage,
  insertRideEvent,
  listRidesByUserRole,
  updateRideStatusRecord
} from '../../db/store.js';
import { findNearestAvailableDriver } from '../dispatch/dispatch.service.js';

export async function estimateFare({ cityId, distanceKm }) {
  const city = await findCityById(cityId);
  if (!city) throw new Error('Unknown city');

  return {
    cityId,
    distanceKm,
    amount: Math.round(city.baseFare + city.perKm * distanceKm)
  };
}

export async function createRide({ riderId, cityId, pickup, drop, distanceKm, couponCode }) {
  const estimate = await estimateFare({ cityId, distanceKm });
  const driverId = await findNearestAvailableDriver(cityId, pickup);
  let finalFare = estimate.amount;
  let couponResult = null;

  if (couponCode) {
    const coupon = await findCouponByCode(couponCode);
    if (!coupon) throw new Error('Coupon not found');
    if (!coupon.isActive) throw new Error('Coupon inactive');
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new Error('Coupon usage limit reached');
    if (new Date(coupon.startsAt).getTime() > Date.now() || new Date(coupon.endsAt).getTime() < Date.now()) {
      throw new Error('Coupon not valid at this time');
    }
    if (estimate.amount < coupon.minFare) throw new Error('Fare does not meet coupon minimum');

    let discountAmount =
      coupon.discountType === 'percentage'
        ? (estimate.amount * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    if (coupon.maxDiscount != null) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
    }
    discountAmount = Math.round(discountAmount);
    finalFare = Math.max(0, estimate.amount - discountAmount);
    couponResult = { coupon, discountAmount };
  }

  const ride = await createRideRecord({
    riderId,
    driverId,
    cityId,
    pickup,
    drop,
    fare: finalFare,
    status: driverId ? 'matched' : 'requested',
    actorUserId: riderId
  });

  await insertRideEvent({ rideId: ride.id, type: 'ride_created', payload: { riderId, cityId }, actorUserId: riderId });
  if (driverId) {
    await insertRideEvent({ rideId: ride.id, type: 'driver_matched', payload: { driverId }, actorUserId: riderId });
  }
  if (couponResult) {
    await incrementCouponUsage(couponResult.coupon.id, riderId);
    await createCouponRedemptionRecord({
      couponId: couponResult.coupon.id,
      couponCode: couponResult.coupon.code,
      rideId: ride.id,
      riderId,
      discountAmount: couponResult.discountAmount,
      actorUserId: riderId
    });
    await insertRideEvent({
      rideId: ride.id,
      type: 'coupon_applied',
      payload: { couponCode: couponResult.coupon.code, discountAmount: couponResult.discountAmount },
      actorUserId: riderId
    });
  }

  return ride;
}

export async function updateRideStatus({ rideId, status, actorUserId }) {
  const ride = await updateRideStatusRecord({ rideId, status, actorUserId });
  if (!ride) throw new Error('Ride not found');

  await insertRideEvent({ rideId: ride.id, type: 'status_changed', payload: { status }, actorUserId });
  return ride;
}

export async function getRideById(rideId) {
  return findRideById(rideId);
}

export async function listRidesByUser(userId, role) {
  return listRidesByUserRole(userId, role);
}
