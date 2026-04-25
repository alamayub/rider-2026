import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findUserById } from '../db/store.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    const dbUser = await findUserById(req.user.sub);
    if (!dbUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (dbUser.status === 'suspended' || dbUser.status === 'banned') {
      return res.status(403).json({ error: `Account is ${dbUser.status}` });
    }
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}
