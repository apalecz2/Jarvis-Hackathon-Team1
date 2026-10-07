const { cleanString, toUpperOrNull, parseMoney, parseTimestamp } = require('./normalize');

function addIssue(issues, rowNumber, transactionId, field, rawValue, problem) {
  issues.push({
    rowNumber,
    transactionId: transactionId ?? null,
    field,
    rawValue,
    problem,
  });
}

function cleanTransactions(rows) {
  const records = [];
  const issues = [];

  for (const row of rows) {
    const record = { ...row };
    const rowNumber = row.rowNumber ?? null;
    const transactionId = toUpperOrNull(row.transactionId);
    record.transactionId = transactionId;
    record.fromAccount = toUpperOrNull(row.fromAccount);
    record.toAccount = toUpperOrNull(row.toAccount);

    if (row.malformed) {
      record.malformed = row.malformed;
      addIssue(issues, rowNumber, transactionId, 'row', row, 'MALFORMED_ROW');
    }

    const typeValue = row.type;
    const normalizedType = toUpperOrNull(typeValue);
    if (typeValue !== undefined && typeValue !== null && String(typeValue).trim() !== '' && normalizedType !== String(typeValue).trim()) {
      record.type = normalizedType;
      addIssue(issues, rowNumber, transactionId, 'type', typeValue, 'NORMALIZED_CASE');
    } else {
      record.type = normalizedType;
    }

    const channelValue = row.channel;
    const normalizedChannel = toUpperOrNull(channelValue);
    if (channelValue !== undefined && channelValue !== null && String(channelValue).trim() !== '' && normalizedChannel !== String(channelValue).trim()) {
      record.channel = normalizedChannel;
      addIssue(issues, rowNumber, transactionId, 'channel', channelValue, 'NORMALIZED_CASE');
    } else {
      record.channel = normalizedChannel;
    }

    const rawAmount = row.amount;
    record.rawAmount = rawAmount;
    const amountResult = parseMoney(rawAmount);
    if (!amountResult.ok) {
      if (!record.malformed) record.malformed = 'MALFORMED_AMOUNT';
      addIssue(issues, rowNumber, transactionId, 'amount', rawAmount, 'MALFORMED_AMOUNT');
    } else {
      record.amount = amountResult.value;
    }

    const timestampResult = parseTimestamp(row.timestamp);
    if (!timestampResult.ok) {
      if (!record.malformed) record.malformed = 'MALFORMED_TIMESTAMP';
      addIssue(issues, rowNumber, transactionId, 'timestamp', row.timestamp, 'MALFORMED_TIMESTAMP');
    } else {
      record.timestamp = timestampResult.iso;
      record.epochMs = timestampResult.epochMs;
    }

    record.description = cleanString(row.description);

    records.push(record);
  }

  return { records, issues };
}

module.exports = { cleanTransactions };
