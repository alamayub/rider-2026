import { createCouponRecord, createCouponRedemptionRecord, findCouponByCode, incrementCouponUsage, listCoupons } from '../db/store.js';

export async function createCoupon(payload, actorUserId) {
  if (!payload.code || !payload.discountType || payload.discountValue == null || !payload.startsAt || !payload.endsAt) {
    throw new Error('code, discountType, discountValue, startsAt, endsAt are required');
  }
  if (!['percentage', 'fixed'].includes(payload.discountType)) {
    throw new Error('discountType must be percentage or fixed');
  }
  return createCouponRecord(payload, actorUserId);
}

export async function getCoupons() {
  return listCoupons();
}

export async function validateCoupon({ code, fare }) {
  const coupon = await findCouponByCode(code);
  if (!coupon) throw new Error('Coupon not found');
  if (!coupon.isActive) throw new Error('Coupon inactive');

  const now = Date.now();
  if (new Date(coupon.startsAt).getTime() > now || new Date(coupon.endsAt).getTime() < now) {
    throw new Error('Coupon not valid at this time');
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon usage limit reached');
  }
  if (fare < coupon.minFare) {
    throw new Error('Fare does not meet coupon minimum');
  }

  let discountAmount = coupon.discountType === 'percentage' ? (fare * Number(coupon.discountValue)) / 100 : Number(coupon.discountValue);
  if (coupon.maxDiscount != null) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
  discountAmount = Math.round(discountAmount);

  return {
    coupon,
    discountAmount,
    finalFare: Math.max(0, fare - discountAmount)
  };
}

export async function applyCouponToRide({ code, fare, rideId, riderId, actorUserId }) {
  const validated = await validateCoupon({ code, fare });
  await incrementCouponUsage(validated.coupon.id, actorUserId || riderId);
  await createCouponRedemptionRecord({
    couponId: validated.coupon.id,
    couponCode: validated.coupon.code,
    rideId,
    riderId,
    discountAmount: validated.discountAmount,
    actorUserId: actorUserId || riderId
  });

  return validated;
}
