import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SKIP_ENV_CHECK = '1';
process.env.NODE_ENV = 'test';

const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { parseTransactions } = await import('../src/lib/txCsv.js');
const { VALIDATION_STEPS, REVIEW_STEPS } = await import('../src/lib/pipeline/definitions.js');
const { textReport } = await import('../src/lib/report.js');

const app = createApp();

test('GET /api/health is public', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
});

test('upload without a file is a 400 with a structured error', async () => {
  const res = await request(app).post('/api/runs');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION');
});

test('unknown API routes 404 as JSON', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.ok(res.body.error.message);
});

const csv = [
  'transactionId,timestamp,type,fromAccount,toAccount,amount,channel,description',
  'TX1,2026-10-15T06:02:15,TRANSFER,ACC1,ACC2,193.06,ONLINE,Transfer',
  'TX2,2026-10-15T06:05:14,purchase,ACC1,,12.5O,POS,"Indigo, Inc"',
  ',not-a-time,DEPOSIT,,ACC2,-5,ATM,',
].join('\n');

test('transaction CSV keeps bad rows, nulling fields that do not parse', () => {
  const rows = parseTransactions(Buffer.from(csv));
  assert.equal(rows.length, 3);
  assert.deepEqual([rows[0].lineNumber, rows[1].lineNumber, rows[2].lineNumber], [2, 3, 4]);
  assert.equal(rows[1].amount, null); // "12.5O"
  assert.equal(rows[1].description, 'Indigo, Inc');
  assert.equal(rows[2].transactionId, null);
  assert.equal(rows[2].occurredAt, null);
  assert.equal(rows[2].amount, '-5'); // negative parses; INVALID_AMOUNT rejects it later
  assert.ok(rows[1].rawLine.includes('12.5O'));
});

test('CSV without required headers is rejected', () => {
  assert.throws(() => parseTransactions(Buffer.from('a,b\n1,2')), /missing column/);
});

const step = (k) => VALIDATION_STEPS.find((s) => s.key === k);
const accounts = new Map([
  ['A', { status: 'ACTIVE', balance: 1000, currency: 'CAD', dailyLimit: 5000 }],
  ['B', { status: 'FROZEN', balance: 0, currency: 'USD', dailyLimit: 5000 }],
]);

test('validation steps', () => {
  const ctx = { accounts, approvedIds: new Set(['TX9']) };
  const tx = (o) => ({ type: 'TRANSFER', from: 'A', to: 'B', cents: 500, ...o });
  assert.equal(step('INVALID_ACCOUNT').check(tx({ to: 'Z' }), {}, ctx), true);
  assert.equal(step('INACTIVE_ACCOUNT').check(tx(), { activeStatuses: ['ACTIVE'] }, ctx), true);
  assert.equal(step('INVALID_AMOUNT').check(tx({ cents: 0 }), {}, ctx), true);
  assert.equal(step('DUPLICATE_TRANSACTION').check(tx({ transactionId: 'TX9' }), {}, ctx), true);
  assert.equal(step('SAME_ACCOUNT_TRANSFER').check(tx({ to: 'A' }), {}, ctx), true);
  assert.equal(step('CURRENCY_MISMATCH').check(tx(), {}, ctx), true);
  assert.equal(step('INSUFFICIENT_FUNDS').check(tx({ cents: 1001 }), {}, ctx), true);
  assert.equal(step('INSUFFICIENT_FUNDS').check(tx({ cents: 1000 }), {}, ctx), false);
  assert.equal(step('INSUFFICIENT_FUNDS').check({ type: 'DEPOSIT', to: 'B', cents: 99 }, {}, ctx), false);
});

test('review steps', () => {
  const t = { type: 'PURCHASE', from: 'A', cents: 1_000_000, day: '2026-10-15', ts: 0 };
  const big = REVIEW_STEPS.find((s) => s.key === 'LARGE_AMOUNT');
  assert.ok(big.evaluate(t, { threshold: 10000 }, {}));
  assert.equal(big.evaluate({ ...t, cents: 999_999 }, { threshold: 10000 }, {}), null);

  const ctx = { accounts, debitedToday: () => 4800, activityInWindow: () => 4 };
  assert.match(REVIEW_STEPS.find((s) => s.key === 'DAILY_LIMIT_EXCEEDED').evaluate({ ...t, cents: 300 }, {}, ctx), /limit 50\.00/);
  assert.equal(REVIEW_STEPS.find((s) => s.key === 'DAILY_LIMIT_EXCEEDED').evaluate({ ...t, cents: 200 }, {}, ctx), null);
  const vel = REVIEW_STEPS.find((s) => s.key === 'HIGH_VELOCITY');
  assert.match(vel.evaluate(t, { count: 5, windowMinutes: 10 }, ctx), /5 txns in 10 min/);
  assert.equal(vel.evaluate(t, { count: 6, windowMinutes: 10 }, ctx), null);
});

test('text report matches the brief', () => {
  const out = textReport({
    run: { runId: 1, sourceFile: 'f.csv' },
    summary: { processed: 2, approved: 1, rejected: 1, flagged: 1 },
    results: [
      { transactionId: 'TX1', lineNumber: 2, status: 'APPROVED', flags: [{ type: 'LARGE_AMOUNT', detail: 'big' }] },
      { transactionId: 'TX2', lineNumber: 3, status: 'REJECTED', rejectReason: 'INVALID_ACCOUNT', flags: [] },
    ],
  });
  assert.match(out, /TX1 APPROVED\nTX2 REJECTED - INVALID ACCOUNT/);
  assert.match(out, /Flagged For Review: 1/);
  assert.match(out, /TX1 LARGE AMOUNT - big/);
});
