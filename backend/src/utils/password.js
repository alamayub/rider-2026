import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
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
