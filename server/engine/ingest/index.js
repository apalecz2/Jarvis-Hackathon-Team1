const { readCsvText } = require('./readCsv');
const { parseRows } = require('./parseCsv');
const { cleanTransactions } = require('./cleanTransactions');
const { cleanAccounts } = require('./cleanAccounts');

function loadTransactions(path) {
  const text = readCsvText(path);
  const rows = parseRows(text, ['transactionId', 'timestamp', 'type', 'fromAccount', 'toAccount', 'amount', 'channel', 'description']);
  const { records, issues } = cleanTransactions(rows);

  return {
    records,
    issues,
    stats: {
      rowsRead: rows.length,
      recordsOut: records.length,
      malformed: records.filter((row) => row.malformed).length,
    },
  };
}

function loadAccounts(path) {
  const text = readCsvText(path);
  const rows = parseRows(text, ['accountId', 'customerName', 'accountType', 'status', 'balance', 'dailyLimit', 'currency', 'openedDate']);
  const { records, issues } = cleanAccounts(rows);

  return {
    records,
    issues,
    stats: {
      rowsRead: rows.length,
      recordsOut: records.length,
      malformed: records.filter((row) => row.malformed).length,
    },
  };
}

module.exports = { loadTransactions, loadAccounts };
