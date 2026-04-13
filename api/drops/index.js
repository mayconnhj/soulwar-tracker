import { getDrops, addDrop } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const drops = await getDrops();
      return res.json(drops);
    }

    if (req.method === 'POST') {
      const drop = await addDrop(req.body);
      return res.json(drop);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /drops error:', err);
    res.status(500).json({ error: err.message });
  }
}
