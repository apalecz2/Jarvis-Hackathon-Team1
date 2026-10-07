/** Display-only formatting; amounts travel as exact decimal strings. */
export const money = (v, currency = 'CAD') => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString('en-CA', { style: 'currency', currency });
};
export const dateTime = (v) => (v ? new Date(v).toLocaleString() : '—');
export const label = (s) => (s ? s.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—');
/** Accept either a bare array or a { items } envelope. */
export const items = (d) => (Array.isArray(d) ? d : d?.items ?? d?.results ?? []);
