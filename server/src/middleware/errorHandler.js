import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const send = (res, status, code, message) => res.status(status).json({ error: { code, message } });

export const notFound = (req, res) => send(res, 404, 'NOT_FOUND', 'Not found');

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return send(res, 400, 'VALIDATION', `${i.path.join('.') || 'request'}: ${i.message}`);
  }
  if (err.code === 'LIMIT_FILE_SIZE') return send(res, 413, 'FILE_TOO_LARGE', 'File too large (max 5 MB)');
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
    return send(res, status, 'INTERNAL', 'Internal server error');
  }
  send(res, status, err.code || 'ERROR', err.message);
}

/** Wrap async route handlers so rejected promises reach errorHandler (Express 4). */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
