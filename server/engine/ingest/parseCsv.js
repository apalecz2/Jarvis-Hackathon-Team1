const { parse } = require('csv-parse/sync');

function parseRows(text, requiredColumns) {
  const rawRows = parse(text, {
    bom: true,
    columns: false,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  });

  if (rawRows.length === 0) {
    return [];
  }

  const header = rawRows[0];
  const missingColumns = requiredColumns.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  const records = parse(text, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  });

  return records.map((row, index) => {
    const rowNumber = index + 2;
    const rawRow = rawRows[index + 1] || [];
    const hasWrongColumnCount = rawRow.length !== header.length;
    const hasMissingValues = requiredColumns.some((column) => !(column in row) || row[column] === undefined);
    const malformed = hasWrongColumnCount || hasMissingValues;

    return {
      ...row,
      rowNumber,
      malformed: malformed ? 'MALFORMED_ROW' : null,
    };
  });
}

module.exports = { parseRows };
