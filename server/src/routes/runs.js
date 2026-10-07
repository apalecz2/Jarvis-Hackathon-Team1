import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { HttpError, wrap } from '../middleware/errorHandler.js';
import { parseTransactions } from '../lib/txCsv.js';
import { processRun } from '../lib/pipeline/engine.js';
import { textReport } from '../lib/report.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const idSchema = z.coerce.number().int().positive();

const RUN_COLS = `r.id::int AS "runId", r.source_file AS "sourceFile", r.status, r.started_at AS "startedAt", r.completed_at AS "completedAt",
  jsonb_build_object('processed', COALESCE(s.processed,0), 'approved', COALESCE(s.approved,0),
                     'rejected', COALESCE(s.rejected,0), 'flagged', COALESCE(s.flagged,0)) AS summary`;
const RUN_FROM = 'FROM processing_runs r LEFT JOIN run_summary s ON s.run_id = r.id';

async function getRun(id, db = { query }) {
  const { rows: [run] } = await db.query(`SELECT ${RUN_COLS} ${RUN_FROM} WHERE r.id = $1`, [id]);
  if (!run) throw new HttpError(404, 'Run not found', 'NOT_FOUND');
  return run;
}

// The summary view returns bigint counts as strings; make them numbers.
const num = (summary) => Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, Number(v)]));
const withNums = (r) => ({ ...r, summary: num(r.summary) });

const RESULT_SELECT = `
  SELECT t.line_number AS "lineNumber", t.transaction_id AS "transactionId",
         to_char(t.occurred_at,'YYYY-MM-DD"T"HH24:MI:SS') AS "occurredAt", t.type,
         t.from_account AS "fromAccount", t.to_account AS "toAccount", t.amount::text AS amount,
         t.channel, t.description, o.status, o.reject_reason AS "rejectReason",
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'type', f.flag_type, 'detail', f.detail, 'reviewStatus', f.review_status) ORDER BY f.id)
                     FROM review_flags f WHERE f.outcome_id = o.id), '[]'::jsonb) AS flags
    FROM transactions t JOIN outcomes o ON o.transaction_row_id = t.id`;

router.get('/', wrap(async (req, res) => {
  const { rows } = await query(`SELECT ${RUN_COLS} ${RUN_FROM} ORDER BY r.id DESC`);
  res.json(rows.map(withNums));
}));

router.post('/', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Attach a CSV file in the "file" field', 'VALIDATION');
  const rows = parseTransactions(req.file.buffer);
  const cols = ['run_id', 'line_number', 'raw_line', 'transaction_id', 'occurred_at', 'type', 'from_account', 'to_account', 'amount', 'channel', 'description'];

  const runId = await withTransaction(async (client) => {
    const { rows: [{ id }] } = await client.query('INSERT INTO processing_runs (source_file) VALUES ($1) RETURNING id', [req.file.originalname]);
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      const ph = part.map((_, r) => `(${cols.map((__, c) => `$${r * cols.length + c + 1}`).join(',')})`).join(',');
      await client.query(
        `INSERT INTO transactions (${cols.join(',')}) VALUES ${ph}`,
        part.flatMap((r) => [id, r.lineNumber, r.rawLine, r.transactionId, r.occurredAt, r.type, r.fromAccount, r.toAccount, r.amount, r.channel, r.description]),
      );
    }
    await processRun(client, id);
    return id;
  });
  res.status(201).json(withNums(await getRun(runId)));
}));

router.get('/:id', wrap(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const run = withNums(await getRun(id));
  const [reasons, flags, cfg] = await Promise.all([
    query(`SELECT o.reject_reason AS k, count(*)::int AS n FROM outcomes o JOIN transactions t ON t.id = o.transaction_row_id
            WHERE t.run_id = $1 AND o.reject_reason IS NOT NULL GROUP BY 1`, [id]),
    query(`SELECT f.flag_type AS k, count(*)::int AS n FROM review_flags f JOIN outcomes o ON o.id = f.outcome_id
             JOIN transactions t ON t.id = o.transaction_row_id WHERE t.run_id = $1 GROUP BY 1`, [id]),
    query('SELECT config FROM processing_runs WHERE id = $1', [id]),
  ]);
  const toObj = (rows) => Object.fromEntries(rows.map((r) => [r.k, r.n]));
  res.json({ ...run, rejectReasons: toObj(reasons.rows), flagTypes: toObj(flags.rows), pipeline: cfg.rows[0].config });
}));

const resultsQuery = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function resultsWhere(id, q) {
  const where = ['t.run_id = $1'];
  const params = [id];
  if (q.status) { params.push(q.status); where.push(`o.status = $${params.length}`); }
  if (q.flagged === 'true') where.push('EXISTS (SELECT 1 FROM review_flags f WHERE f.outcome_id = o.id)');
  return { sql: where.join(' AND '), params };
}

router.get('/:id/results', wrap(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const q = resultsQuery.parse(req.query);
  await getRun(id);
  const { sql, params } = resultsWhere(id, q);
  const [items, total] = await Promise.all([
    query(`${RESULT_SELECT} WHERE ${sql} ORDER BY t.line_number LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`, params),
    query(`SELECT count(*)::int AS n FROM transactions t JOIN outcomes o ON o.transaction_row_id = t.id WHERE ${sql}`, params),
  ]);
  res.json({ items: items.rows, total: total.rows[0].n, page: q.page, limit: q.limit });
}));

router.get('/:id/results.txt', wrap(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const run = withNums(await getRun(id));
  const { rows } = await query(`${RESULT_SELECT} WHERE t.run_id = $1 ORDER BY t.line_number`, [id]);
  res.type('text/plain').send(textReport({ run, results: rows, summary: run.summary }));
}));

export default router;
