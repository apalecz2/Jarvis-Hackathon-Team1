const Decimal = require('decimal.js');

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function toUpperOrNull(value) {
  const cleaned = cleanString(value);
  if (cleaned === null) return null;
  return cleaned.toUpperCase();
}

function parseMoney(raw) {
  const value = cleanString(raw);
  if (value === null) return { value: null, ok: false };
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return { value: null, ok: false };

  try {
    return { value: new Decimal(value), ok: true };
  } catch (error) {
    return { value: null, ok: false };
  }
}

function parseTimestamp(raw) {
  const value = cleanString(raw);
  if (value === null) {
    return { iso: null, epochMs: null, ok: false };
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return { iso: null, epochMs: null, ok: false };
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes &&
    date.getSeconds() === seconds;

  if (!valid) {
    return { iso: null, epochMs: null, ok: false };
  }

  return {
    iso: value,
    epochMs: date.getTime(),
    ok: true,
  };
}

module.exports = {
  cleanString,
  toUpperOrNull,
  parseMoney,
  parseTimestamp,
};
