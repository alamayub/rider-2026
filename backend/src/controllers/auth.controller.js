import { requestSignInOtp, signIn } from '../services/auth.service.js';

function isValidRole(role) {
  return ['rider', 'driver', 'admin'].includes(role);
}

export async function signInController(req, res) {
  const { phone, email, role, password, otp } = req.body;
  const sourceIp = req.ip;

  if (!phone || !role) {
    return res.status(400).json({ error: 'phone and role are required' });
  }

  if (!isValidRole(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }

  if (!password && !otp) {
    return res.status(400).json({ error: 'password or otp is required' });
  }

  try {
    const result = await signIn({ phone, email, role, password, otp, sourceIp });
    return res.json(result);
  } catch (error) {
    return res.status(403).json({ error: 'Authentication failed' });
  }
}

export async function requestSignInOtpController(req, res) {
  const { phone, email, role } = req.body;
  const sourceIp = req.ip;
  if (!phone || !role) {
    return res.status(400).json({ error: 'phone and role are required' });
  }
  if (!isValidRole(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }

  try {
    const result = await requestSignInOtp({ phone, email, role, sourceIp });
    return res.json(result);
  } catch (error) {
    return res.status(202).json({ message: 'If the account exists, OTP will be sent' });
  }
}
