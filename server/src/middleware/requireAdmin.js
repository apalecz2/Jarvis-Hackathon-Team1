import crypto from 'node:crypto';
import { env } from '../env.js';

const digest = (s) => crypto.createHash('sha256').update(s).digest();

/** Reads are open; every other method needs `Authorization: Bearer <ADMIN_TOKEN>`. */
export function requireAdminForWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const fail = (status, code, message) => res.status(status).json({ error: { code, message } });
  if (!env.ADMIN_TOKEN) return fail(503, 'ADMIN_TOKEN_UNSET', 'Writes are disabled: set ADMIN_TOKEN on the server');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!crypto.timingSafeEqual(digest(token), digest(env.ADMIN_TOKEN))) {
    return fail(401, 'UNAUTHORIZED', 'Missing or invalid admin token');
  }
  next();
}
