import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryStore } from '../db/store.js';
import { signIn } from '../modules/auth/auth.service.js';
import { getMyKyc, reviewDriverKyc, submitDriverKyc } from '../modules/driver-kyc/driver-kyc.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

test('driver can submit KYC and admin can approve', async () => {
  const driver = (await signIn({ phone: '+918800000001', role: 'driver', password: 'Pass@123' })).user;
  const admin = (await signIn({ phone: '+918800000002', role: 'admin', password: 'Pass@123' })).user;

  const submitted = await submitDriverKyc({
    driverId: driver.id,
    fullName: 'Driver One',
    licenseNumber: 'DL-12345',
    documentUrl: 'https://example.com/driver-license.png'
  });

  assert.equal(submitted.status, 'submitted');

  const approved = await reviewDriverKyc({
    driverId: driver.id,
    reviewerAdminId: admin.id,
    action: 'approve'
  });

  assert.equal(approved.status, 'approved');

  const latest = await getMyKyc(driver.id);
  assert.equal(latest.status, 'approved');
});
