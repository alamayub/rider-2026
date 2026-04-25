import { applyCouponToRide, createCoupon, getCoupons, validateCoupon } from '../services/coupons.service.js';

export async function createCouponController(req, res) {
  try {
    const coupon = await createCoupon(req.body, req.user.sub);
    return res.status(201).json(coupon);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listCouponsController(_req, res) {
  return res.json(await getCoupons());
}

export async function validateCouponController(req, res) {
  try {
    const { code, fare } = req.body;
    if (!code || fare == null) return res.status(400).json({ error: 'code and fare are required' });

    return res.json(await validateCoupon({ code, fare: Number(fare) }));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function applyCouponController(req, res) {
  try {
    const { code, fare, rideId } = req.body;
    if (!code || fare == null || !rideId) {
      return res.status(400).json({ error: 'code, fare and rideId are required' });
    }

    return res.json(
      await applyCouponToRide({
        code,
        fare: Number(fare),
        rideId,
        riderId: req.user.sub,
        actorUserId: req.user.sub
      })
    );
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
