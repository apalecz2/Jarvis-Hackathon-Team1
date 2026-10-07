const fs = require('fs');
const path = require('path');
const { loadTransactions, loadAccounts } = require('./engine/ingest');

function serializeDecimal(value) {
  if (value && typeof value.toString === 'function' && value.constructor && value.constructor.name === 'Decimal') {
    return value.toString();
  }
  return value;
}

function serializeRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const clone = { ...record };
  if (clone.amount !== undefined) clone.amount = serializeDecimal(clone.amount);
  if (clone.balance !== undefined) clone.balance = serializeDecimal(clone.balance);
  if (clone.dailyLimit !== undefined) clone.dailyLimit = serializeDecimal(clone.dailyLimit);
  if (clone.malformed === undefined) delete clone.malformed;
  return clone;
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsvReport(filePath, issues) {
  const rows = [
    ['rowNumber', 'transactionId', 'field', 'rawValue', 'problem'],
    ...issues.map((issue) => [
      issue.rowNumber ?? '',
      issue.transactionId ?? '',
      issue.field ?? '',
      issue.rawValue === undefined ? '' : JSON.stringify(issue.rawValue),
      issue.problem ?? '',
    ]),
  ];

  const csv = rows.map((line) => line.map((cell) => escapeCsv(cell)).join(',')).join('\n') + '\n';
  fs.writeFileSync(filePath, csv, 'utf8');
}

function groupIssues(issues) {
  const grouped = new Map();
  for (const issue of issues) {
    const key = issue.problem;
    if (!grouped.has(key)) grouped.set(key, new Set());
    if (issue.transactionId !== null && issue.transactionId !== undefined) {
      grouped.get(key).add(issue.transactionId);
    }
  }
  return [...grouped.entries()].map(([problem, ids]) => ({ problem, ids: [...ids].sort() }));
}

function chooseCsvPath(defaultDir, baseName, explicitPath) {
  if (explicitPath) return explicitPath;
  const candidate = path.join(defaultDir, baseName);
  if (fs.existsSync(candidate)) return candidate;
  return path.join(__dirname, 'data', baseName);
}

function main() {
  const root = __dirname;
  const dataDir = path.join(root, 'data');
  const dummyDir = path.join(root, 'dummy');
  const cleanDir = path.join(dataDir, 'clean');
  fs.mkdirSync(cleanDir, { recursive: true });

  const accountArg = process.argv[2] || (fs.existsSync(path.join(dummyDir, 'accounts (1).csv')) ? path.join(dummyDir, 'accounts (1).csv') : null);
  const transactionArg = process.argv[3] || (fs.existsSync(path.join(dummyDir, 'transactions (1).csv')) ? path.join(dummyDir, 'transactions (1).csv') : null);

  const accountPath = accountArg || chooseCsvPath(dataDir, 'accounts.csv');
  const transactionPath = transactionArg || chooseCsvPath(dataDir, 'transactions.csv');

  const transactions = loadTransactions(transactionPath);
  const accounts = loadAccounts(accountPath);

  const txJson = JSON.stringify(transactions.records.map(serializeRecord), null, 2);
  const accountJson = JSON.stringify(accounts.records.map(serializeRecord), null, 2);

  fs.writeFileSync(path.join(cleanDir, 'transactions.clean.json'), txJson + '\n', 'utf8');
  fs.writeFileSync(path.join(cleanDir, 'accounts.clean.json'), accountJson + '\n', 'utf8');
  writeCsvReport(path.join(cleanDir, 'cleaning_report.csv'), [...transactions.issues, ...accounts.issues]);

  console.log(`transactions rowsRead=${transactions.stats.rowsRead}, recordsOut=${transactions.stats.recordsOut}, malformed=${transactions.stats.malformed}`);
  console.log(`accounts rowsRead=${accounts.stats.rowsRead}, recordsOut=${accounts.stats.recordsOut}, malformed=${accounts.stats.malformed}`);

  for (const group of groupIssues([...transactions.issues, ...accounts.issues])) {
    console.log(`${group.problem}: ${group.ids.join(', ') || '(none)'}`);
  }
}

main();
