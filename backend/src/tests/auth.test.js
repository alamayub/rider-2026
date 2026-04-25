import assert from 'node:assert/strict';
import test from 'node:test';
import { resetMemoryStore } from '../db/store.js';
import { requestSignInOtp, resetAuthRateLimiters, signIn } from '../modules/auth/auth.service.js';

test.beforeEach(() => {
  resetMemoryStore();
  resetAuthRateLimiters();
});

test('password sign in returns tokens and user', async () => {
  const result = await signIn({ phone: '+911234567890', role: 'rider', password: 'Pass@123' });

  assert.ok(result.user.id);
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(result.user.role, 'rider');
});

test('otp sign in returns tokens and user', async () => {
  await signIn({ phone: '+911234567891', role: 'rider', password: 'Pass@123' });
  const otpIssued = await requestSignInOtp({ phone: '+911234567891', role: 'rider' });
  const result = await signIn({ phone: '+911234567891', role: 'rider', otp: otpIssued.otp });

  assert.ok(result.user.id);
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(result.user.role, 'rider');
});

test('otp request enforces cooldown', async () => {
  await signIn({ phone: '+911234567892', role: 'rider', password: 'Pass@123' });
  await requestSignInOtp({ phone: '+911234567892', role: 'rider' });
  await assert.rejects(
    () => requestSignInOtp({ phone: '+911234567892', role: 'rider' }),
    /OTP requested too frequently/
  );
});

test('password sign in locks after repeated failures', async () => {
  await signIn({ phone: '+911234567893', role: 'rider', password: 'Pass@123' });

  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(
      () => signIn({ phone: '+911234567893', role: 'rider', password: 'wrong-pass' }),
      /Invalid password/
    );
  }

  await assert.rejects(
    () => signIn({ phone: '+911234567893', role: 'rider', password: 'Pass@123' }),
    /Too many failed sign-in attempts/
  );
});

test('password sign up enforces strong policy', async () => {
  await assert.rejects(
    () => signIn({ phone: '+911234567894', role: 'rider', password: 'weak123' }),
    /Password must be at least 8 chars/
  );
});

test('otp sign in locks after repeated wrong attempts', async () => {
  await signIn({ phone: '+911234567895', role: 'rider', password: 'Pass@123' });
  const otpIssued = await requestSignInOtp({ phone: '+911234567895', role: 'rider' });
  assert.ok(otpIssued.otp);

  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(
      () => signIn({ phone: '+911234567895', role: 'rider', otp: '000000' }),
      /Invalid OTP/
    );
  }

  await assert.rejects(
    () => signIn({ phone: '+911234567895', role: 'rider', otp: otpIssued.otp }),
    /Too many failed OTP attempts/
  );
});

test('auth rate limit applies per ip + phone for sign in', async () => {
  await signIn({ phone: '+911234567896', role: 'rider', password: 'Pass@123', sourceIp: '10.0.0.9' });
  for (let i = 0; i < 10; i += 1) {
    await assert.rejects(
      () => signIn({ phone: '+911234567896', role: 'rider', password: 'Wrong@123', sourceIp: '10.0.0.9' }),
      /Invalid password|Too many failed sign-in attempts|Too many attempts/
    );
  }
  await assert.rejects(
    () => signIn({ phone: '+911234567896', role: 'rider', password: 'Wrong@123', sourceIp: '10.0.0.9' }),
    /Too many attempts/
  );
});
