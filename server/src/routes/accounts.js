import { Router } from 'express';
import { query } from '../db/pool.js';
import { HttpError, wrap } from '../middleware/errorHandler.js';

const router = Router();

const ACCOUNT = `account_id AS id, customer_name AS "customerName", account_type AS "accountType", status,
  balance::text AS balance, daily_limit::text AS "dailyLimit", currency, opened_date::text AS "openedDate"`;

router.get('/', wrap(async (req, res) => {
  res.json((await query(`SELECT ${ACCOUNT} FROM accounts ORDER BY account_id`)).rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const { rows: [account] } = await query(`SELECT ${ACCOUNT} FROM accounts WHERE account_id = $1`, [req.params.id]);
  if (!account) throw new HttpError(404, 'Account not found', 'NOT_FOUND');
  const { rows: ledger } = await query(
    `SELECT l.id::int AS id, to_char(l.occurred_at,'YYYY-MM-DD"T"HH24:MI:SS') AS "occurredAt", t.transaction_id AS "transactionId", t.type,
            l.delta::text AS delta, l.balance_after::text AS "balanceAfter"
       FROM account_ledger l JOIN outcomes o ON o.id = l.outcome_id JOIN transactions t ON t.id = o.transaction_row_id
      WHERE l.account_id = $1 ORDER BY l.occurred_at DESC, l.id DESC LIMIT 500`, [req.params.id]);
  res.json({ account, ledger });
}));

export default router;
