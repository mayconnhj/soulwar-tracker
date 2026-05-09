import { createHmac } from 'crypto';
import { getAuthVersion } from './supabase.js';

const SECRET = process.env.AUTH_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error(
    'AUTH_SECRET ausente ou muito curto. ' +
    'Defina uma string aleatoria de no minimo 32 caracteres no .env. ' +
    'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Token: <ts>.<authVersion>.<sig>
// sig = HMAC-SHA256(SECRET, "<ts>.<authVersion>")
// Quando authVersion muda no servidor (changePassword), tokens antigos
// nao batem mais com a versao atual e sao rejeitados.

export async function createToken() {
  const ts = Date.now().toString();
  const v = await getAuthVersion();
  const payload = `${ts}.${v}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export async function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ts, v, sig] = parts;
  if (!ts || !v || !sig) return false;

  const expected = createHmac('sha256', SECRET).update(`${ts}.${v}`).digest('hex');
  if (sig !== expected) return false;
  if (Date.now() - parseInt(ts) > TOKEN_TTL) return false;

  // Compara a versao do token com a versao atual no banco.
  let current;
  try { current = await getAuthVersion(); } catch { return false; }
  if (Number(v) !== current) return false;
  return true;
}

export async function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token ausente' });
    return false;
  }
  const valid = await verifyToken(auth.slice(7));
  if (!valid) {
    res.status(401).json({ error: 'Sessao expirada' });
    return false;
  }
  return true;
}
