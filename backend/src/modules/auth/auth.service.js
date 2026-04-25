import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { createUser, findUserByPhoneRole } from '../../db/store.js';

export async function signIn({ phone, email, role }) {
  let user = await findUserByPhoneRole(phone, role);

  if (!user) {
    user = await createUser({ phone, email: email || null, role });
  }
  if (user.status === 'suspended' || user.status === 'banned') {
    throw new Error(`Account is ${user.status}`);
  }

  const accessToken = jwt.sign({ sub: user.id, role: user.role, phone: user.phone, email: user.email }, env.jwtSecret, {
    expiresIn: '15m'
  });

  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, env.jwtSecret, {
    expiresIn: '7d'
  });

  return { user, accessToken, refreshToken };
}
