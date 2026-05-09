import { changePassword } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { sendApiError } from '../lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await requireAuth(req, res)) return;

  try {
    const { currentPassword, newPassword } = req.body || {};
    await changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err) {
    sendApiError(res, err, 'API /change-password');
  }
}
