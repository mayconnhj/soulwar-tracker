import { checkPassword } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ok = await checkPassword(req.body.password);
    if (ok) {
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: 'Senha incorreta' });
    }
  } catch (err) {
    console.error('API /login error:', err);
    res.status(500).json({ error: err.message });
  }
}
