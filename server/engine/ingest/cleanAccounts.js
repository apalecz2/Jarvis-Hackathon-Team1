const { cleanString, toUpperOrNull, parseMoney } = require('./normalize');

function addIssue(issues, rowNumber, transactionId, field, rawValue, problem) {
  issues.push({
    rowNumber,
    transactionId: transactionId ?? null,
    field,
    rawValue,
    problem,
  });
}

function cleanAccounts(rows) {
  const records = [];
  const issues = [];
  const seenIds = new Set();

  for (const row of rows) {
    const record = { ...row };
    const rowNumber = row.rowNumber ?? null;
    const accountId = toUpperOrNull(row.accountId);
    record.accountId = accountId;
    record.accountType = toUpperOrNull(row.accountType);
    record.status = toUpperOrNull(row.status);
    record.currency = toUpperOrNull(row.currency);
    record.customerName = cleanString(row.customerName);
    record.openedDate = String(row.openedDate ?? '');

    const balanceResult = parseMoney(row.balance);
    if (!balanceResult.ok) {
      record.malformed = 'MALFORMED_AMOUNT';
      addIssue(issues, rowNumber, accountId, 'balance', row.balance, 'MALFORMED_AMOUNT');
    } else {
      record.balance = balanceResult.value;
    }

    const limitResult = parseMoney(row.dailyLimit);
    if (!limitResult.ok) {
      record.malformed = 'MALFORMED_AMOUNT';
      addIssue(issues, rowNumber, accountId, 'dailyLimit', row.dailyLimit, 'MALFORMED_AMOUNT');
    } else {
      record.dailyLimit = limitResult.value;
    }

    if (seenIds.has(accountId)) {
      addIssue(issues, rowNumber, accountId, 'accountId', accountId, 'DUPLICATE_ACCOUNT_ID');
    } else if (accountId !== null) {
      seenIds.add(accountId);
    }

    records.push(record);
  }

  return { records, issues };
}

module.exports = { cleanAccounts };
