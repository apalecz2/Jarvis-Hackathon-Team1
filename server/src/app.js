import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import health from './routes/health.js';
import accounts from './routes/accounts.js';
import runs from './routes/runs.js';
import flags from './routes/flags.js';
import pipeline from './routes/pipeline.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind Render's proxy
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use('/api/health', health);

  app.use('/api/accounts', accounts);
  app.use('/api/runs', runs);
  app.use('/api/flags', flags);
  app.use('/api/pipeline', pipeline);
  app.use('/api', notFound);

  // Optional: serve the built React app from the API (single-host deploy).
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

// Vercel runs this file as the serverless entrypoint and needs the app as the default export.
// Locally, src/index.js imports createApp and calls listen().
export default createApp();
