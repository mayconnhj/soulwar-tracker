import { checkPassword } from '../lib/supabase.js';
import { createToken } from '../lib/auth.js';
import { sendApiError } from '../lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ok = await checkPassword(req.body && req.body.password);
    if (ok) res.json({ ok: true, token: createToken() });
    else res.status(401).json({ error: 'Senha incorreta' });
  } catch (err) {
    sendApiError(res, err, 'API /login');
  }
}
