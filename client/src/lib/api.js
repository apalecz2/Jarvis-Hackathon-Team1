const BASE = import.meta.env.VITE_API_URL || '';

/** fetch wrapper: parses JSON, throws Error(message) from { error: { code, message } }. */
export async function api(path, { method = 'GET', body, form, text } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Cannot reach the API. Check that the server is running and retry.');
  }
  if (res.status === 204) return null;
  if (res.ok && text) return res.text();
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error?.message || `Request failed (${res.status})`);
    e.code = json.error?.code;
    throw e;
  }
  return json;
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => v !== '' && v != null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
