const fs = require('fs');

function readCsvText(path) {
  const raw = fs.readFileSync(path);
  return raw.toString('utf8').replace(/^\uFEFF/, '');
}

module.exports = { readCsvText };
