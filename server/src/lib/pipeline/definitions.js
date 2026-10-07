/**
 * Step catalogue. Validation steps run in order and the first failure rejects the transaction
 * (its reject reason is recorded). Review steps run on approved transactions and can each add a
 * flag. Operators can reorder/disable steps and edit params; `locked` steps are structural
 * (the engine cannot post a transaction without them) so they stay on and pinned first.
 */

export const TX_TYPES = ['TRANSFER', 'PURCHASE', 'DEPOSIT', 'WITHDRAWAL'];

const cents = (n) => Math.round(n * 100);
const fmt = (c) => (c / 100).toFixed(2);

/** Which accounts a transaction type touches. */
export function legs(t) {
  switch (t.type) {
    case 'TRANSFER': return [{ id: t.from, sign: -1 }, { id: t.to, sign: 1 }];
    case 'PURCHASE':
    case 'WITHDRAWAL': return [{ id: t.from, sign: -1 }];
    case 'DEPOSIT': return [{ id: t.to, sign: 1 }];
    default: return [];
  }
}

/** The account whose activity (limit, velocity) a transaction counts against. */
export const primaryAccount = (t) => t.from ?? t.to;

export const VALIDATION_STEPS = [
  {
    key: 'MALFORMED_RECORD', locked: true, rejectReason: 'MALFORMED_RECORD',
    label: 'Well-formed record',
    description: 'Transaction ID, timestamp, type and a numeric amount are present, and the accounts the type needs are filled in.',
    check: (t) => t.malformed,
  },
  {
    key: 'UNSUPPORTED_TYPE', locked: true, rejectReason: 'UNSUPPORTED_TYPE',
    label: 'Supported type',
    description: 'Only the selected transaction types are processed (type is matched case-insensitively).',
    params: [{ key: 'allowedTypes', label: 'Allowed types', type: 'list', options: TX_TYPES, default: TX_TYPES }],
    check: (t, p) => !p.allowedTypes.includes(t.type),
  },
  {
    key: 'INVALID_ACCOUNT', locked: true, rejectReason: 'INVALID_ACCOUNT',
    label: 'Accounts exist',
    description: 'Every account the transaction touches exists in the accounts table.',
    check: (t, p, ctx) => legs(t).some((l) => !ctx.accounts.has(l.id)),
  },
  {
    key: 'INACTIVE_ACCOUNT', rejectReason: 'INACTIVE_ACCOUNT',
    label: 'Accounts active',
    description: 'Every account the transaction touches has an allowed status.',
    params: [{ key: 'activeStatuses', label: 'Statuses treated as active', type: 'list', default: ['ACTIVE'], help: 'Comma separated, e.g. ACTIVE' }],
    check: (t, p, ctx) => legs(t).some((l) => !p.activeStatuses.includes(ctx.accounts.get(l.id).status.toUpperCase())),
  },
  {
    key: 'INVALID_AMOUNT', rejectReason: 'INVALID_AMOUNT',
    label: 'Positive amount',
    description: 'Amount must be greater than zero.',
    check: (t) => t.cents <= 0,
  },
  {
    key: 'DUPLICATE_TRANSACTION', rejectReason: 'DUPLICATE_TRANSACTION',
    label: 'Not a duplicate',
    description: 'No approved transaction (in this or an earlier run) has the same transaction ID.',
    check: (t, p, ctx) => ctx.approvedIds.has(t.transactionId),
  },
  {
    key: 'SAME_ACCOUNT_TRANSFER', rejectReason: 'SAME_ACCOUNT_TRANSFER',
    label: 'Transfer between different accounts',
    description: 'A transfer cannot have the same source and destination account.',
    check: (t) => t.type === 'TRANSFER' && t.from === t.to,
  },
  {
    key: 'CURRENCY_MISMATCH', rejectReason: 'CURRENCY_MISMATCH',
    label: 'Matching currencies',
    description: 'Both accounts of a transfer hold the same currency (no FX conversion is performed).',
    check: (t, p, ctx) => t.type === 'TRANSFER' && ctx.accounts.get(t.from).currency !== ctx.accounts.get(t.to).currency,
  },
  {
    key: 'INSUFFICIENT_FUNDS', rejectReason: 'INSUFFICIENT_FUNDS',
    label: 'Sufficient funds',
    description: 'A debit may not take the account balance below zero.',
    check: (t, p, ctx) => legs(t).some((l) => l.sign < 0 && ctx.accounts.get(l.id).balance - t.cents < 0),
  },
];

export const REVIEW_STEPS = [
  {
    key: 'LARGE_AMOUNT', flagType: 'LARGE_AMOUNT',
    label: 'Large amount',
    description: 'Flag approved transactions at or above a size threshold.',
    params: [{ key: 'threshold', label: 'Threshold (amount ≥)', type: 'number', default: 10000, min: 0 }],
    evaluate: (t, p) => (t.cents >= cents(p.threshold) ? `Amount ${fmt(t.cents)} ≥ threshold ${fmt(cents(p.threshold))}` : null),
  },
  {
    key: 'DAILY_LIMIT_EXCEEDED', flagType: 'DAILY_LIMIT_EXCEEDED',
    label: 'Daily limit exceeded',
    description: "Flag when an account's debits for the calendar day exceed its daily limit.",
    evaluate: (t, p, ctx) => {
      const l = legs(t).find((x) => x.sign < 0);
      if (!l) return null;
      const acct = ctx.accounts.get(l.id);
      const total = ctx.debitedToday(l.id, t.day) + t.cents;
      return total > acct.dailyLimit ? `${l.id} debited ${fmt(total)} on ${t.day}, limit ${fmt(acct.dailyLimit)}` : null;
    },
  },
  {
    key: 'HIGH_VELOCITY', flagType: 'HIGH_VELOCITY',
    label: 'High velocity',
    description: 'Flag when an account is involved in many approved transactions in a short window.',
    params: [
      { key: 'count', label: 'Transactions (≥)', type: 'number', default: 5, min: 2 },
      { key: 'windowMinutes', label: 'Window (minutes)', type: 'number', default: 10, min: 1 },
    ],
    evaluate: (t, p, ctx) => {
      const acct = primaryAccount(t);
      const n = ctx.activityInWindow(acct, t.ts, p.windowMinutes * 60_000) + 1;
      return n >= p.count ? `${acct}: ${n} txns in ${p.windowMinutes} min` : null;
    },
  },
];

export const STEPS = [
  ...VALIDATION_STEPS.map((s) => ({ ...s, kind: 'VALIDATION' })),
  ...REVIEW_STEPS.map((s) => ({ ...s, kind: 'REVIEW' })),
];
export const STEP_BY_KEY = new Map(STEPS.map((s) => [s.key, s]));

export const defaultParams = (step) => Object.fromEntries((step.params ?? []).map((p) => [p.key, p.default]));
