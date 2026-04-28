import { getQuests, addQuest } from '../../lib/supabase.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const quests = await getQuests();
      return res.json(quests);
    }

    if (req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const quest = await addQuest(req.body);
      return res.json(quest);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /quests error:', err);
    res.status(500).json({ error: err.message });
  }
}
