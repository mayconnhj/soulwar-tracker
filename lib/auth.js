import { createHmac } from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_KEY || 'fallback-secret';
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 horas

export function createToken() {
  const ts = Date.now().toString();
  const sig = createHmac('sha256', SECRET).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return false;
  const [ts, sig] = token.split('.');
  if (!ts || !sig) return false;

  const expected = createHmac('sha256', SECRET).update(ts).digest('hex');
  if (sig !== expected) return false;

  // Verifica se o token ainda nao expirou
  if (Date.now() - parseInt(ts) > TOKEN_TTL) return false;

  return true;
}

export function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token ausente' });
    return false;
  }
  if (!verifyToken(auth.slice(7))) {
    res.status(401).json({ error: 'Token invalido ou expirado' });
    return false;
  }
  return true;
}
