import { updateDropSale } from '../../../lib/supabase.js';
import { requireAuth } from '../../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req, res)) return;

  const { id } = req.query;

  try {
    const drop = await updateDropSale(id, req.body);
    return res.json(drop);
  } catch (err) {
    console.error(`API /drops/${id}/sale error:`, err);
    res.status(500).json({ error: err.message });
  }
}
