import { getConfig, saveConfig } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const config = await getConfig();
      return res.json(config);
    }

    if (req.method === 'PUT') {
      const config = await saveConfig(req.body);
      return res.json(config);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /config error:', err);
    res.status(500).json({ error: err.message });
  }
}
