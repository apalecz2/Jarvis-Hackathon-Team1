import { loadPipeline, serialize } from './config.js';
import { legs, primaryAccount } from './definitions.js';

const toCents = (s) => Math.round(Number(s) * 100);
const MIN = 60_000;
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** Multi-row INSERT ... RETURNING for `cols`; rows are arrays of values. */
async function bulkInsert(client, table, cols, rows, returning = 'id') {
  const out = [];
  for (const part of chunks(rows, Math.floor(30000 / cols.length))) {
    const ph = part.map((_, r) => `(${cols.map((__, c) => `$${r * cols.length + c + 1}`).join(',')})`).join(',');
    const res = await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${ph} RETURNING ${returning}`, part.flat());
    out.push(...res.rows);
  }
  return out;
}

/** Normalise a stored row into what the steps inspect. */
function prepare(row) {
  const type = row.type ? row.type.trim().toUpperCase() : null;
  const t = {
    transactionId: row.transaction_id, type, from: row.from_account, to: row.to_account,
    ts: row.occurred_at ? Date.parse(`${row.occurred_at}Z`) : null, day: row.occurred_at?.slice(0, 10) ?? null,
    cents: row.amount == null ? null : toCents(row.amount),
  };
  const needs = { TRANSFER: [t.from, t.to], PURCHASE: [t.from], WITHDRAWAL: [t.from], DEPOSIT: [t.to] }[type] ?? [];
  t.malformed = !t.transactionId || t.ts == null || !type || t.cents == null || needs.some((a) => !a);
  return t;
}

/**
 * Process every raw transaction of a run, in file order, inside the caller's DB transaction:
 * validate -> post to balances/ledger -> review flags -> write outcomes. Throws on any failure so
 * the caller rolls back (a file is applied fully or not at all).
 */
export async function processRun(client, runId) {
  // One processing job at a time: balances and daily totals depend on the previous state.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('cboj_process_run'))");

  const steps = await loadPipeline(client);
  const validation = steps.filter((s) => s.enabled && s.def.kind === 'VALIDATION');
  const review = steps.filter((s) => s.enabled && s.def.kind === 'REVIEW');
  await client.query('UPDATE processing_runs SET config = $2 WHERE id = $1', [runId, JSON.stringify(serialize(steps))]);

  const accounts = new Map(
    (await client.query('SELECT account_id, status, balance, daily_limit, currency FROM accounts')).rows.map((a) => [
      a.account_id, { status: a.status, balance: toCents(a.balance), dailyLimit: toCents(a.daily_limit), currency: a.currency, startBalance: toCents(a.balance) },
    ]),
  );
  const rows = (
    await client.query(
      `SELECT id, line_number, transaction_id, to_char(occurred_at,'YYYY-MM-DD"T"HH24:MI:SS') AS occurred_at,
              type, from_account, to_account, amount::text AS amount
         FROM transactions WHERE run_id = $1 ORDER BY line_number`, [runId])
  ).rows;

  // State carried over from earlier runs.
  const minDay = rows.map((r) => r.occurred_at).filter(Boolean).sort()[0]?.slice(0, 10);
  const approvedIds = new Set(
    (await client.query(
      `SELECT DISTINCT t.transaction_id FROM transactions t JOIN outcomes o ON o.transaction_row_id = t.id
        WHERE o.status = 'APPROVED' AND t.transaction_id IS NOT NULL`)).rows.map((r) => r.transaction_id),
  );
  const debits = new Map(); // account -> [{ day, cents }]
  const activity = new Map(); // account -> [ts]
  const push = (map, k, v) => (map.has(k) ? map.get(k).push(v) : map.set(k, [v]));
  if (minDay) {
    const since = `${minDay}T00:00:00`;
    for (const r of (await client.query(
      `SELECT account_id, to_char(occurred_at,'YYYY-MM-DD') AS day, (-delta)::text AS cents
         FROM account_ledger WHERE delta < 0 AND occurred_at >= ($1::timestamp - interval '1 day')`, [since])).rows) {
      push(debits, r.account_id, { day: r.day, cents: toCents(r.cents) });
    }
    for (const r of (await client.query(
      `SELECT COALESCE(t.from_account, t.to_account) AS account_id,
              to_char(t.occurred_at,'YYYY-MM-DD"T"HH24:MI:SS') AS at
         FROM transactions t JOIN outcomes o ON o.transaction_row_id = t.id
        WHERE o.status = 'APPROVED' AND t.occurred_at >= ($1::timestamp - interval '1 day')`, [since])).rows) {
      push(activity, r.account_id, Date.parse(`${r.at}Z`));
    }
  }
  const ctx = {
    accounts, approvedIds,
    debitedToday: (a, day) => (debits.get(a) ?? []).filter((d) => d.day === day).reduce((s, d) => s + d.cents, 0),
    activityInWindow: (a, ts, ms) => (activity.get(a) ?? []).filter((x) => x > ts - ms && x <= ts).length,
  };

  const outcomes = []; // { rowId, status, reason, flags: [{type, detail}], ledger: [{account, delta, after}], at }
  for (const row of rows) {
    const t = prepare(row);
    const out = { rowId: row.id, status: 'APPROVED', reason: null, flags: [], ledger: [], at: row.occurred_at };

    const failed = validation.find((s) => s.def.check(t, s.params, ctx));
    if (failed) {
      out.status = 'REJECTED';
      out.reason = failed.def.rejectReason;
    } else {
      for (const l of legs(t)) {
        const a = accounts.get(l.id);
        a.balance += l.sign * t.cents;
        out.ledger.push({ account: l.id, delta: l.sign * t.cents, after: a.balance });
      }
      // Review steps add this transaction's own amount/count themselves, so they run before it is recorded.
      for (const s of review) {
        const detail = s.def.evaluate(t, s.params, ctx);
        if (detail) out.flags.push({ type: s.def.flagType, detail });
      }
      for (const l of legs(t)) if (l.sign < 0) push(debits, l.id, { day: t.day, cents: t.cents });
      approvedIds.add(t.transactionId);
      push(activity, primaryAccount(t), t.ts);
    }
    outcomes.push(out);
  }

  // ---- persist ----
  const ids = await bulkInsert(client, 'outcomes', ['transaction_row_id', 'status', 'reject_reason'],
    outcomes.map((o) => [o.rowId, o.status, o.reason]), 'id, transaction_row_id');
  const outcomeId = new Map(ids.map((r) => [String(r.transaction_row_id), r.id]));

  const flagRows = outcomes.flatMap((o) => o.flags.map((f) => [outcomeId.get(String(o.rowId)), f.type, f.detail]));
  if (flagRows.length) await bulkInsert(client, 'review_flags', ['outcome_id', 'flag_type', 'detail'], flagRows);

  const ledgerRows = outcomes.flatMap((o) =>
    o.ledger.map((l) => [l.account, outcomeId.get(String(o.rowId)), o.at, (l.delta / 100).toFixed(2), (l.after / 100).toFixed(2)]));
  if (ledgerRows.length) await bulkInsert(client, 'account_ledger', ['account_id', 'outcome_id', 'occurred_at', 'delta', 'balance_after'], ledgerRows);

  for (const [id, a] of accounts) {
    if (a.balance !== a.startBalance) await client.query('UPDATE accounts SET balance = $2 WHERE account_id = $1', [id, (a.balance / 100).toFixed(2)]);
  }
  await client.query("UPDATE processing_runs SET status = 'COMPLETED', completed_at = now() WHERE id = $1", [runId]);
}
