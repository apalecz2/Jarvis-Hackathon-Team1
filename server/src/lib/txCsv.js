import { parse } from 'csv-parse/sync';
import { HttpError } from '../middleware/errorHandler.js';

const HEADERS = ['transactionId', 'timestamp', 'type', 'fromAccount', 'toAccount', 'amount', 'channel', 'description'];
const REQUIRED_HEADERS = ['transactionId', 'timestamp', 'type', 'amount'];
export const MAX_ROWS = 50_000;

const blank = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
// NUMERIC(14,2): at most 12 integer digits and 2 decimals, anything else is stored as NULL (malformed).
const amount = (v) => (/^-?\d{1,12}(\.\d{1,2})?$/.test(v ?? '') ? v : null);
const timestamp = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v ?? '');
  if (!m) return null;
  const [y, mo, d, h, mi, s = 0] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const ok = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && h < 24 && mi < 60 && s < 60;
  return ok ? v.replace(' ', 'T') : null;
};

/**
 * Parse a transaction CSV into raw-row records. Nothing is rejected here: fields that fail to
 * parse become null and the engine's MALFORMED_RECORD step rejects the row, so every line gets an outcome.
 */
export function parseTransactions(buffer) {
  let records;
  try {
    records = parse(buffer, {
      bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true, trim: true, raw: true, info: true,
    });
  } catch (err) {
    throw new HttpError(400, `Could not parse CSV: ${err.message}`, 'BAD_CSV');
  }
  if (records.length < 2) throw new HttpError(400, 'CSV needs a header row and at least one data row', 'BAD_CSV');

  const header = records[0].record.map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length) throw new HttpError(400, `CSV is missing column(s): ${missing.join(', ')}`, 'BAD_CSV');
  if (records.length - 1 > MAX_ROWS) throw new HttpError(400, `Too many rows (max ${MAX_ROWS})`, 'BAD_CSV');
  const idx = Object.fromEntries(HEADERS.map((h) => [h, header.indexOf(h)]));
  const get = (rec, h) => (idx[h] >= 0 ? blank(rec[idx[h]]) : null);

  return records.slice(1).map(({ record, raw: rawWithEol, info }) => {
    const raw = rawWithEol.replace(/\r?\n$/, '');
    return {
    // info.lines is the record's last physical line; quoted fields can span several.
    lineNumber: info.lines - (raw.split('\n').length - 1),
    rawLine: raw,
    transactionId: get(record, 'transactionId'),
    occurredAt: timestamp(get(record, 'timestamp')),
    type: get(record, 'type'),
    fromAccount: get(record, 'fromAccount'),
    toAccount: get(record, 'toAccount'),
    amount: amount(get(record, 'amount')),
    channel: get(record, 'channel'),
    description: get(record, 'description'),
    };
  });
}
