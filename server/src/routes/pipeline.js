import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { wrap } from '../middleware/errorHandler.js';
import { loadPipeline, resetPipeline, savePipeline, serialize } from '../lib/pipeline/config.js';

const router = Router();

const body = z.object({
  steps: z.array(z.object({ key: z.string(), enabled: z.boolean().optional(), params: z.record(z.any()).optional() })).max(50),
});

const current = async (db) => ({ steps: serialize(await loadPipeline(db)) });

router.get('/', wrap(async (req, res) => res.json(await current({ query }))));

// Order in `steps` is the execution order of the validation steps.
router.put('/', wrap(async (req, res) => {
  const { steps } = body.parse(req.body);
  res.json(await withTransaction(async (client) => {
    await savePipeline(client, steps);
    return current(client);
  }));
}));

router.post('/reset', wrap(async (req, res) => {
  res.json(await withTransaction(async (client) => {
    await resetPipeline(client);
    return current(client);
  }));
}));

export default router;
