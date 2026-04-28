import { updateQuest, deleteQuest } from '../../lib/supabase.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireAuth(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'PUT') {
      const quest = await updateQuest(id, req.body);
      return res.json(quest);
    }

    if (req.method === 'DELETE') {
      const result = await deleteQuest(id);
      return res.json(result);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`API /quests/${id} error:`, err);
    if (err.code === 'PGRST116') return res.status(404).json({ error: 'Quest not found' });
    res.status(500).json({ error: err.message });
  }
}
