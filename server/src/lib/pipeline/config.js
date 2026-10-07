import { z } from 'zod';
import { query } from '../../db/pool.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { STEPS, STEP_BY_KEY, defaultParams } from './definitions.js';

/** Validate/normalise one step's params against its schema; unknown keys are dropped. */
function cleanParams(step, input = {}) {
  const out = {};
  for (const spec of step.params ?? []) {
    const v = input[spec.key] ?? spec.default;
    if (spec.type === 'number') {
      const n = z.coerce.number().finite().min(spec.min ?? -Infinity).safeParse(v);
      if (!n.success) throw new HttpError(400, `${step.label}: ${spec.label} must be a number${spec.min != null ? ` ≥ ${spec.min}` : ''}`, 'VALIDATION');
      out[spec.key] = n.data;
    } else {
      const raw = Array.isArray(v) ? v : String(v).split(',');
      const list = [...new Set(raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
      if (list.length === 0) throw new HttpError(400, `${step.label}: ${spec.label} needs at least one value`, 'VALIDATION');
      if (spec.options && list.some((s) => !spec.options.includes(s))) {
        throw new HttpError(400, `${step.label}: ${spec.label} must be from ${spec.options.join(', ')}`, 'VALIDATION');
      }
      out[spec.key] = list;
    }
  }
  return out;
}

/** The effective pipeline: code catalogue + stored overrides, ordered. */
export async function loadPipeline(db = { query }) {
  const { rows } = await db.query('SELECT key, position, enabled, params FROM pipeline_steps');
  const stored = new Map(rows.map((r) => [r.key, r]));
  const steps = STEPS.map((def, i) => {
    const s = stored.get(def.key);
    let params;
    try { params = cleanParams(def, s?.params); } catch { params = defaultParams(def); }
    return {
      def,
      position: def.locked ? i - 1000 : s?.position ?? i,
      enabled: def.locked ? true : s?.enabled ?? true,
      params,
    };
  });
  steps.sort((a, b) => a.position - b.position);
  return steps;
}

/** Shape sent to the client / stored as a run snapshot. */
export const serialize = (steps) =>
  steps.map(({ def, enabled, params }) => ({
    key: def.key,
    kind: def.kind,
    label: def.label,
    description: def.description,
    locked: !!def.locked,
    outcome: def.rejectReason ?? def.flagType,
    enabled,
    params,
    paramSchema: def.params ?? [],
  }));

/**
 * Persist an ordered list of { key, enabled, params }. Validation steps keep the locked ones first,
 * in catalogue order; steps omitted from the request keep their current settings and position.
 */
export async function savePipeline(db, input) {
  const current = await loadPipeline(db);
  const byKey = new Map(current.map((s) => [s.def.key, s]));
  const seen = new Set();
  const next = [];
  for (const item of input) {
    const cur = byKey.get(item.key);
    if (!cur) throw new HttpError(400, `Unknown step: ${item.key}`, 'VALIDATION');
    if (seen.has(item.key)) throw new HttpError(400, `Duplicate step: ${item.key}`, 'VALIDATION');
    seen.add(item.key);
    next.push({
      def: cur.def,
      enabled: cur.def.locked ? true : item.enabled ?? cur.enabled,
      params: cleanParams(cur.def, item.params ?? cur.params),
    });
  }
  for (const cur of current) if (!seen.has(cur.def.key)) next.push(cur);

  const rank = (s) => (s.def.locked ? STEPS.indexOf(STEP_BY_KEY.get(s.def.key)) : 1000);
  next.sort((a, b) => rank(a) - rank(b)); // stable: locked pinned first, the rest keep requested order

  for (const [position, s] of next.entries()) {
    await db.query(
      `INSERT INTO pipeline_steps (key, position, enabled, params) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET position = $2, enabled = $3, params = $4`,
      [s.def.key, position, s.enabled, JSON.stringify(s.params)],
    );
  }
}

export const resetPipeline = (db) => db.query('DELETE FROM pipeline_steps');
