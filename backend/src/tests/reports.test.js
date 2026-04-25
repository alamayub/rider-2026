import assert from 'node:assert/strict';
import test from 'node:test';
import { findUserById, resetMemoryStore } from '../db/store.js';
import { signIn } from '../modules/auth/auth.service.js';
import { submitReport } from '../modules/reports/reports.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

test('auto suspend then ban based on open report thresholds', async () => {
  const reporter = (await signIn({ phone: '+911111111111', role: 'rider' })).user;
  const reported = (await signIn({ phone: '+922222222222', role: 'driver' })).user;

  for (let i = 0; i < 3; i += 1) {
    await submitReport({
      rideId: null,
      reporterUserId: reporter.id,
      reportedUserId: reported.id,
      reason: `unsafe_behavior_${i}`,
      description: 'unsafe behavior'
    });
  }

  const suspendedUser = await findUserById(reported.id);
  assert.equal(suspendedUser.status, 'suspended');

  for (let i = 3; i < 5; i += 1) {
    await submitReport({
      rideId: null,
      reporterUserId: reporter.id,
      reportedUserId: reported.id,
      reason: `unsafe_behavior_${i}`,
      description: 'unsafe behavior'
    });
  }

  const bannedUser = await findUserById(reported.id);
  assert.equal(bannedUser.status, 'banned');
});
