import { signIn } from './auth.service.js';

export async function signInController(req, res) {
  const { phone, email, role } = req.body;

  if (!phone || !role) {
    return res.status(400).json({ error: 'phone and role are required' });
  }

  if (!['rider', 'driver', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }

  try {
    const result = await signIn({ phone, email, role });
    return res.json(result);
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
}
