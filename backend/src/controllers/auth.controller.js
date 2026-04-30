import {
  changePassword,
  getMyProfile,
  registerRiderOrDriver,
  requestSignInOtp,
  signIn,
  updateMyProfile
} from '../services/auth.service.js';

function isValidRole(role) {
  return ['rider', 'driver', 'admin'].includes(role);
}

function isRiderOrDriver(role) {
  return role === 'rider' || role === 'driver';
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
    const msg = error?.message || 'Authentication failed';
    if (msg.includes('Too many attempts')) {
      return res.status(429).json({ error: msg });
    }
    if (msg.includes('Too many failed sign-in') || msg.includes('Too many failed OTP')) {
      return res.status(429).json({ error: msg });
    }
    if (msg.includes('Account is')) {
      return res.status(403).json({ error: msg });
    }
    if (msg.includes('Password must') || msg.includes('password or otp is required')) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes('Invalid password') || msg.includes('Invalid OTP') || msg.includes('OTP expired')) {
      return res.status(401).json({ error: msg });
    }
    if (msg.includes('Account not found')) {
      return res.status(401).json({ error: msg });
    }
    return res.status(401).json({ error: msg });
  }
}

export async function registerController(req, res) {
  const { phone, email, password, role } = req.body;
  const sourceIp = req.ip;

  if (!phone || !password || !role) {
    return res.status(400).json({ error: 'phone, password, and role are required' });
  }

  if (!isRiderOrDriver(role)) {
    return res.status(400).json({ error: 'registration is only allowed for rider or driver' });
  }

  try {
    const result = await registerRiderOrDriver({
      phone,
      email: email || null,
      password,
      role,
      sourceIp
    });
    return res.status(201).json(result);
  } catch (error) {
    const msg = error?.message || 'Registration failed';
    if (msg.includes('already exists')) {
      return res.status(409).json({ error: msg });
    }
    if (msg.includes('Too many attempts')) {
      return res.status(429).json({ error: msg });
    }
    if (msg.includes('Password must')) {
      return res.status(400).json({ error: msg });
    }
    return res.status(400).json({ error: msg });
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

export async function getMyProfileController(req, res) {
  try {
    return res.json(await getMyProfile({ userId: req.user.sub }));
  } catch (error) {
    const msg = error?.message || 'Failed to fetch profile';
    if (msg.includes('not found')) {
      return res.status(404).json({ error: msg });
    }
    return res.status(400).json({ error: msg });
  }
}

export async function updateMyProfileController(req, res) {
  try {
    const updated = await updateMyProfile({
      userId: req.user.sub,
      email: req.body?.email,
      fullName: req.body?.fullName
    });
    return res.json(updated);
  } catch (error) {
    const msg = error?.message || 'Failed to update profile';
    if (msg.includes('not found')) {
      return res.status(404).json({ error: msg });
    }
    return res.status(400).json({ error: msg });
  }
}

export async function changePasswordController(req, res) {
  try {
    const result = await changePassword({
      userId: req.user.sub,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword
    });
    return res.json(result);
  } catch (error) {
    const msg = error?.message || 'Failed to change password';
    if (msg.toLowerCase().includes('incorrect')) {
      return res.status(403).json({ error: msg });
    }
    if (msg.includes('not found')) {
      return res.status(404).json({ error: msg });
    }
    return res.status(400).json({ error: msg });
  }
}
