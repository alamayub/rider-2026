import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import {
  clearUserAuthOtp,
  createUser,
  findUserByPhoneRole,
  setUserAuthOtp,
  updateUserOtpGuard,
  updateUserOtpWindow,
  updateUserSignInGuard
} from '../db/store.js';

const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_WINDOW_MAX = 5;
const MAX_FAILED_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 10 * 60 * 1000;
const MAX_FAILED_SIGNIN_ATTEMPTS = 5;
const SIGNIN_LOCK_MS = 10 * 60 * 1000;
const AUTH_RATE_WINDOW_MS = 10 * 60 * 1000;
const AUTH_RATE_MAX = 10;

const authRateBuckets = new Map();

function getClientKey(identifier, sourceIp) {
  const idKey = String(identifier || 'unknown-identifier');
  const ipKey = String(sourceIp || 'unknown-ip');
  return `${ipKey}:${idKey}`;
}

export function consumeAuthRateLimit({ scope, identifier, sourceIp }) {
  const nowMs = Date.now();
  const key = `${scope}:${getClientKey(identifier, sourceIp)}`;
  const existing = authRateBuckets.get(key);
  if (!existing || nowMs - existing.startedAt > AUTH_RATE_WINDOW_MS) {
    authRateBuckets.set(key, { startedAt: nowMs, count: 1 });
    return;
  }
  if (existing.count >= AUTH_RATE_MAX) {
    throw new Error('Too many attempts. Try again later');
  }
  existing.count += 1;
}

export function resetAuthRateLimiters() {
  authRateBuckets.clear();
}

function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 8) return false;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = String(storedHash).split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, digest] = parts;
  const candidate = scryptSync(String(password), salt, 64).toString('hex');
  const digestBuffer = Buffer.from(digest, 'hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  if (digestBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(digestBuffer, candidateBuffer);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role, phone: user.phone, email: user.email }, env.jwtSecret, {
    expiresIn: '15m'
  });

  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, env.jwtSecret, {
    expiresIn: '7d'
  });

  return { accessToken, refreshToken };
}

export async function requestSignInOtp({ phone, email, role, sourceIp }) {
  consumeAuthRateLimit({ scope: 'request-otp', identifier: phone, sourceIp });
  let user = await findUserByPhoneRole(phone, role);

  if (!user) {
    user = await createUser({ phone, email: email || null, role });
  }
  if (user.status === 'suspended' || user.status === 'banned') {
    throw new Error(`Account is ${user.status}`);
  }

  const nowMs = Date.now();
  const lastSentMs = user.authOtpLastSentAt ? new Date(user.authOtpLastSentAt).getTime() : 0;
  if (lastSentMs && nowMs - lastSentMs < OTP_RESEND_COOLDOWN_MS) {
    throw new Error('OTP requested too frequently. Please wait before retrying');
  }

  const windowStartMs = user.authOtpWindowStartedAt ? new Date(user.authOtpWindowStartedAt).getTime() : 0;
  let windowStartedAt = user.authOtpWindowStartedAt;
  let windowCount = Number(user.authOtpWindowCount || 0);
  if (!windowStartMs || nowMs - windowStartMs > OTP_WINDOW_MS) {
    windowStartedAt = new Date(nowMs).toISOString();
    windowCount = 0;
  }
  if (windowCount >= OTP_WINDOW_MAX) {
    throw new Error('OTP limit exceeded. Try again later');
  }

  await updateUserOtpWindow({
    userId: user.id,
    windowStartedAt,
    windowCount: windowCount + 1,
    actorUserId: user.id
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await setUserAuthOtp({ userId: user.id, otp, expiresAt, actorUserId: user.id });

  const payload = { userId: user.id, phone: user.phone, role: user.role, expiresAt };
  if (env.nodeEnv === 'development' || env.nodeEnv === 'test') {
    payload.otp = otp;
  }
  return payload;
}

export async function registerRiderOrDriver({ phone, email, password, role, sourceIp }) {
  const r = String(role || '').trim();
  if (r !== 'rider' && r !== 'driver') {
    throw new Error('Registration is only available for rider or driver');
  }
  const p = String(phone || '').trim();
  if (!p) {
    throw new Error('phone is required');
  }
  if (!password) {
    throw new Error('password is required');
  }

  consumeAuthRateLimit({ scope: 'register', identifier: p, sourceIp });

  const existing = await findUserByPhoneRole(p, r);
  if (existing) {
    throw new Error('An account with this phone number already exists');
  }

  if (!validatePasswordStrength(password)) {
    throw new Error(
      'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character'
    );
  }

  const passwordHash = hashPassword(password);
  let user = await createUser({ phone: p, email: email ? String(email).trim() || null : null, role: r, passwordHash });
  user = await updateUserSignInGuard({
    userId: user.id,
    failedSigninCount: 0,
    signinLockedUntil: null,
    actorUserId: user.id
  });
  const tokens = buildTokens(user);
  return { user, ...tokens };
}

export async function signIn({ phone, email, role, password, otp, sourceIp }) {
  consumeAuthRateLimit({ scope: 'signin', identifier: phone, sourceIp });
  if (!password && !otp) {
    throw new Error('password or otp is required');
  }

  let user = await findUserByPhoneRole(phone, role);
  const passwordHash = password ? hashPassword(password) : null;

  if (!user && passwordHash) {
    if (!validatePasswordStrength(password)) {
      throw new Error('Password must be at least 8 chars and include upper, lower, number, and special character');
    }
    user = await createUser({ phone, email: email || null, role, passwordHash });
  }

  if (!user) throw new Error('Account not found. Sign up with password first');
  if (user.status === 'suspended' || user.status === 'banned') throw new Error(`Account is ${user.status}`);

  const lockUntilMs = user.signinLockedUntil ? new Date(user.signinLockedUntil).getTime() : 0;
  if (lockUntilMs && Date.now() < lockUntilMs) {
    throw new Error('Too many failed sign-in attempts. Try again later');
  }

  if (passwordHash) {
    if (!verifyPassword(password, user.passwordHash)) {
      const failedCount = Number(user.failedSigninCount || 0) + 1;
      const shouldLock = failedCount >= MAX_FAILED_SIGNIN_ATTEMPTS;
      await updateUserSignInGuard({
        userId: user.id,
        failedSigninCount: shouldLock ? 0 : failedCount,
        signinLockedUntil: shouldLock ? new Date(Date.now() + SIGNIN_LOCK_MS).toISOString() : null,
        actorUserId: user.id
      });
      throw new Error('Invalid password');
    }
  } else {
    const nowMs = Date.now();
    const otpLockUntilMs = user.otpLockedUntil ? new Date(user.otpLockedUntil).getTime() : 0;
    if (otpLockUntilMs && nowMs < otpLockUntilMs) {
      throw new Error('Too many failed OTP attempts. Try again later');
    }
    const expiresMs = user.authOtpExpiresAt ? new Date(user.authOtpExpiresAt).getTime() : 0;
    if (!user.authOtp || String(user.authOtp) !== String(otp)) {
      const failedCount = Number(user.failedOtpCount || 0) + 1;
      const shouldLock = failedCount >= MAX_FAILED_OTP_ATTEMPTS;
      await updateUserOtpGuard({
        userId: user.id,
        failedOtpCount: shouldLock ? 0 : failedCount,
        otpLockedUntil: shouldLock ? new Date(Date.now() + OTP_LOCK_MS).toISOString() : null,
        actorUserId: user.id
      });
      throw new Error('Invalid OTP');
    }
    if (!expiresMs || Number.isNaN(expiresMs) || nowMs > expiresMs) {
      throw new Error('OTP expired');
    }
    user = await clearUserAuthOtp({ userId: user.id, actorUserId: user.id });
    user = await updateUserOtpGuard({ userId: user.id, failedOtpCount: 0, otpLockedUntil: null, actorUserId: user.id });
  }

  user = await updateUserSignInGuard({ userId: user.id, failedSigninCount: 0, signinLockedUntil: null, actorUserId: user.id });
  const tokens = buildTokens(user);
  return { user, ...tokens };
}
