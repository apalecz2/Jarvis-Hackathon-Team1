const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('node:path');
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');
const { env } = require('./env');
const { requireAuth } = require('./middleware/requireAuth');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const health = require('./routes/health');
const datasets = require('./routes/datasets');
const query = require('./routes/query');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.use('/api/health', health);
  app.use('/api/datasets', requireAuth, datasets);
  app.use(
    '/api/query',
    requireAuth,
    rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }),
    query,
  );
  app.use('/api', notFound);

  const dist = path.resolve(path.dirname(fileURLToPath(require('node:url').pathToFileURL(__filename).href)), '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
module.exports.default = createApp();
