import { getConfig, saveConfig } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { sendApiError } from '../lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return res.json(await getConfig());

    if (req.method === 'PUT') {
      if (!await requireAuth(req, res)) return;
      return res.json(await saveConfig(req.body));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendApiError(res, err, 'API /config');
  }
}
