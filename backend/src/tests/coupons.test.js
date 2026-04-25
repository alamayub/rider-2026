import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoupon, validateCoupon } from '../services/coupons.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('validate coupon computes final fare', async () => {
  await createCoupon(
    {
      code: 'SAVE20',
      discountType: 'percentage',
      discountValue: 20,
      maxDiscount: 100,
      minFare: 100,
      startsAt: '2020-01-01T00:00:00.000Z',
      endsAt: '2099-01-01T00:00:00.000Z'
    },
    'admin-1'
  );

  const result = await validateCoupon({ code: 'save20', fare: 300 });
  assert.equal(result.discountAmount, 60);
  assert.equal(result.finalFare, 240);
});
