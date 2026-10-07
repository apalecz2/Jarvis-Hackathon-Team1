const { HttpError } = require('../middleware/errorHandler');

function assertReadOnlySql(sql) {
  const cleaned = String(sql || '').trim().replace(/;+\s*$/, '');
  if (!cleaned) throw new HttpError(400, 'Query is empty');
  if (cleaned.length > 5000) throw new HttpError(400, 'Query is too long');
  if (cleaned.includes(';')) throw new HttpError(400, 'Only a single statement is allowed');
  if (!/^(select|with|values|table)\b/i.test(cleaned)) {
    throw new HttpError(400, 'Only SELECT queries (including WITH ... SELECT) are allowed');
  }
  return cleaned;
}

module.exports = { assertReadOnlySql };
