import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryStore } from '../db/store.js';
import { signIn } from '../modules/auth/auth.service.js';

test.beforeEach(() => {
  resetMemoryStore();
});

test('sign in returns tokens and user', async () => {
  const result = await signIn({ phone: '+911234567890', role: 'rider' });

  assert.ok(result.user.id);
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(result.user.role, 'rider');
});
