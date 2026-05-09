import { updateDropSale } from '../../../lib/supabase.js';
import { requireAuth } from '../../../lib/auth.js';
import { sendApiError } from '../../../lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!await requireAuth(req, res)) return;

  const { id } = req.query;

  try {
    return res.json(await updateDropSale(id, req.body));
  } catch (err) {
    sendApiError(res, err, `API /drops/${id}/sale`);
  }
}
