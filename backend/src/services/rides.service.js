import {
  createRideRecord,
  createCouponRedemptionRecord,
  findCouponByCode,
  findCityById,
  findRideById,
  findVehicleTypeById,
  incrementCouponUsage,
  insertRideEvent,
  listCities,
  listVehicleTypes,
  markRideStartOtpVerified,
  listRidesByUserRole,
  updateRideStatusRecord
} from '../db/store.js';
import { findNearestAvailableDriver } from './dispatch.service.js';
import { ensureDriverPayoutsAfterRideCompleted } from './payments.service.js';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Hides `rideStartOtp` from drivers and after verification / terminal states.
 * Riders see the code until they share it with the driver and the trip goes in_progress (verified).
 */
export function toRideResponseForUser(ride, userId, role) {
  if (!ride) return null;
  const out = { ...ride };
  const uid = String(userId);
  const rRole = String(role || '');
  const isRider = rRole === 'rider' && String(ride.riderId) === uid;
  const isDriver = rRole === 'driver' && ride.driverId != null && String(ride.driverId) === uid;
  const isAdmin = rRole === 'admin';

  if (isAdmin) {
    return out;
  }

  const otpVerified = out.rideStartOtpVerifiedAt != null && String(out.rideStartOtpVerifiedAt).trim() !== '';
  const terminal = ['completed', 'cancelled'].includes(String(out.status));

  if (!isRider && !isDriver) {
    delete out.rideStartOtp;
    return out;
  }
  if (isDriver || otpVerified || terminal) {
    delete out.rideStartOtp;
    return out;
  }
  return out;
}

export async function getRideByIdForUser(rideId, userId, role) {
  const ride = await findRideById(rideId);
  if (!ride) return null;
  const uid = String(userId);
  const isRider = String(ride.riderId) === uid;
  const isDriver = ride.driverId != null && String(ride.driverId) === uid;
  const isAdmin = String(role) === 'admin';
  if (!isRider && !isDriver && !isAdmin) {
    throw new Error('FORBIDDEN_GET_RIDE');
  }
  return toRideResponseForUser(ride, userId, role);
}

export async function estimateFare({ cityId, distanceKm, vehicleTypeId }) {
  const city = await findCityById(cityId);
  if (!city) throw new Error('Unknown city');
  const vehicleType = vehicleTypeId
    ? await findVehicleTypeById(vehicleTypeId)
    : (await listVehicleTypes({ onlyActive: true }))[0] || null;
  if (!vehicleType) throw new Error('Vehicle type not found');
  if (!vehicleType.isActive) throw new Error('Vehicle type inactive');

  const baseAmount = city.baseFare + city.perKm * distanceKm;
  const amount = Math.round(baseAmount * Number(vehicleType.fareMultiplier || 1));

  return {
    cityId: city.id,
    distanceKm,
    vehicleTypeId: vehicleType.id,
    amount
  };
}

export async function createRide({ riderId, cityId, pickup, drop, distanceKm, couponCode, vehicleTypeId }) {
  const estimate = await estimateFare({ cityId, distanceKm, vehicleTypeId });
  const driverId = await findNearestAvailableDriver(estimate.cityId, pickup, estimate.vehicleTypeId);
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
    cityId: estimate.cityId,
    pickup,
    drop,
    fare: finalFare,
    vehicleTypeId: estimate.vehicleTypeId,
    rideStartOtp: generateOtp(),
    status: driverId ? 'matched' : 'requested',
    actorUserId: riderId
  });

  await insertRideEvent({ rideId: ride.id, type: 'ride_created', payload: { riderId, cityId: estimate.cityId }, actorUserId: riderId });
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

export async function updateRideStatus({ rideId, status, actorUserId, otp }) {
  const existing = await findRideById(rideId);
  if (!existing) throw new Error('Ride not found');

  if (status === 'in_progress') {
    if (!otp) throw new Error('Ride start OTP is required');
    if (String(otp) !== String(existing.rideStartOtp)) throw new Error('Invalid ride start OTP');
    await markRideStartOtpVerified({ rideId, actorUserId });
  }

  const ride = await updateRideStatusRecord({ rideId, status, actorUserId });
  if (!ride) throw new Error('Ride not found');

  await insertRideEvent({ rideId: ride.id, type: 'status_changed', payload: { status }, actorUserId });
  if (status === 'completed') {
    await ensureDriverPayoutsAfterRideCompleted({ rideId: ride.id, actorUserId });
  }
  return ride;
}

export async function getRideById(rideId) {
  return findRideById(rideId);
}

export async function listRidesByUser(userId, role) {
  return listRidesByUserRole(userId, role);
}

export async function listRidesByUserForViewer(userId, role) {
  const rides = await listRidesByUserRole(userId, role);
  return rides.map((r) => toRideResponseForUser(r, userId, role));
}

export async function listAvailableVehicleTypes() {
  return listVehicleTypes({ onlyActive: true });
}

export async function listBookingCities() {
  return listCities();
}
