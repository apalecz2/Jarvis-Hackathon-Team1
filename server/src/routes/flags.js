import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { HttpError, wrap } from '../middleware/errorHandler.js';

const router = Router();
const REVIEW = z.enum(['PENDING', 'CLEARED', 'ESCALATED']);

const SELECT = `
  SELECT f.id::int AS id, f.flag_type AS "flagType", f.detail, f.review_status AS "reviewStatus", t.run_id::int AS "runId",
         jsonb_build_object('transactionId', t.transaction_id, 'type', t.type, 'fromAccount', t.from_account,
                            'toAccount', t.to_account, 'amount', t.amount::text, 'occurredAt', to_char(t.occurred_at,'YYYY-MM-DD"T"HH24:MI:SS')) AS transaction
    FROM review_flags f JOIN outcomes o ON o.id = f.outcome_id JOIN transactions t ON t.id = o.transaction_row_id`;

router.get('/', wrap(async (req, res) => {
  const { reviewStatus, runId } = z.object({ reviewStatus: REVIEW.optional(), runId: z.coerce.number().int().optional() }).parse(req.query);
  const where = [];
  const params = [];
  if (reviewStatus) { params.push(reviewStatus); where.push(`f.review_status = $${params.length}`); }
  if (runId) { params.push(runId); where.push(`t.run_id = $${params.length}`); }
  const { rows } = await query(`${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.run_id DESC, f.id`, params);
  res.json(rows);
}));

router.patch('/:id', wrap(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { reviewStatus } = z.object({ reviewStatus: REVIEW }).parse(req.body);
  const { rows } = await query('UPDATE review_flags SET review_status = $2 WHERE id = $1 RETURNING id, review_status AS "reviewStatus"', [id, reviewStatus]);
  if (!rows[0]) throw new HttpError(404, 'Flag not found', 'NOT_FOUND');
  res.json(rows[0]);
}));

export default router;
