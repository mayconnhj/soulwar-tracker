import { updateQuest, deleteQuest } from '../../lib/supabase.js';
import { requireAuth } from '../../lib/auth.js';
import { sendApiError } from '../../lib/validate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!await requireAuth(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'PUT') return res.json(await updateQuest(id, req.body));
    if (req.method === 'DELETE') return res.json(await deleteQuest(id));
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendApiError(res, err, `API /quests/${id}`);
  }
}
