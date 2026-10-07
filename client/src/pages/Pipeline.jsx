import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { label } from '../lib/format';
import { Badge, ErrorMsg, Loading } from '../components/Bits';

/** One parameter input, driven by the server-supplied param schema. */
function Param({ spec, value, onChange }) {
  if (spec.type === 'number') {
    return (
      <label>{spec.label}
        <input type="number" min={spec.min} step="any" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  if (spec.options) {
    return (
      <div className="field">
        <span className="field-label">{spec.label}</span>
        <div className="checks">
          {spec.options.map((o) => (
            <label key={o} className="check">
              <input
                type="checkbox"
                checked={value.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((v) => v !== o))}
              />
              {label(o)}
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label>{spec.label}{spec.help && <span className="muted"> ({spec.help})</span>}
      <input value={value.join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))} />
    </label>
  );
}

function Step({ step, index, count, onChange, onMove, ordered }) {
  return (
    <div className={`step ${step.enabled ? '' : 'off'}`}>
      <div className="step-head">
        {ordered && <span className="step-num">{index + 1}</span>}
        <div className="grow">
          <strong>{step.label}</strong>{' '}
          <Badge kind={ordered ? 'bad' : 'warn'}>{ordered ? `Rejects: ${label(step.outcome)}` : `Flags: ${label(step.outcome)}`}</Badge>
          {step.locked && <Badge>Required</Badge>}
          <div className="muted">{step.description}</div>
        </div>
        {ordered && !step.locked && (
          <div className="row tight">
            <button className="secondary" aria-label="Move up" disabled={index === 0 || count.firstMovable === index} onClick={() => onMove(-1)}>↑</button>
            <button className="secondary" aria-label="Move down" disabled={index === count.last} onClick={() => onMove(1)}>↓</button>
          </div>
        )}
        <label className="switch">
          <input type="checkbox" checked={step.enabled} disabled={step.locked} onChange={(e) => onChange({ enabled: e.target.checked })} />
          {step.enabled ? 'On' : 'Off'}
        </label>
      </div>
      {step.paramSchema.length > 0 && step.enabled && (
        <div className="params">
          {step.paramSchema.map((spec) => (
            <Param key={spec.key} spec={spec} value={step.params[spec.key]} onChange={(v) => onChange({ params: { ...step.params, [spec.key]: v } })} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Pipeline() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ['pipeline'], queryFn: () => api('/pipeline') });
  const [steps, setSteps] = useState(null);
  useEffect(() => { if (data) setSteps(data.steps); }, [data]);

  const done = (d) => { qc.setQueryData(['pipeline'], d); setSteps(d.steps); };
  const save = useMutation({ mutationFn: () => api('/pipeline', { method: 'PUT', body: { steps } }), onSuccess: done });
  const reset = useMutation({ mutationFn: () => api('/pipeline/reset', { method: 'POST' }), onSuccess: done });

  if (isLoading || (!steps && !error)) return <Loading />;
  if (!steps) return <ErrorMsg error={error} />;

  const update = (key, patch) => { save.reset(); setSteps(steps.map((s) => (s.key === key ? { ...s, ...patch } : s))); };
  const move = (key, dir) => {
    const i = steps.findIndex((s) => s.key === key);
    const j = i + dir;
    if (steps[j]?.kind !== 'VALIDATION' || steps[j].locked) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    save.reset();
    setSteps(next);
  };

  const validation = steps.filter((s) => s.kind === 'VALIDATION');
  const review = steps.filter((s) => s.kind === 'REVIEW');
  const dirty = JSON.stringify(steps) !== JSON.stringify(data.steps);
  const count = { last: validation.length - 1, firstMovable: validation.findIndex((s) => !s.locked) };

  return (
    <>
      <div className="row between">
        <h1>Processing pipeline</h1>
        <div className="row tight">
          <button className="secondary" disabled={reset.isPending} onClick={() => confirm('Restore the default pipeline?') && reset.mutate()}>Reset to defaults</button>
          <button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
      <p className="muted">Changes apply to the next file you process. Each run keeps a snapshot of the pipeline it used.</p>
      <ErrorMsg error={save.error} />
      <ErrorMsg error={reset.error} />
      {save.isSuccess && !dirty && <p className="notice">Saved.</p>}

      <div className="card">
        <h2>1. Validation checks</h2>
        <p className="muted">Run top to bottom; the first check a transaction fails rejects it with that reason. Order therefore decides which reason is reported when several apply.</p>
        {validation.map((s, i) => (
          <Step key={s.key} step={s} index={i} count={count} ordered onMove={(d) => move(s.key, d)} onChange={(p) => update(s.key, p)} />
        ))}
      </div>

      <div className="card">
        <h2>2. Review flags</h2>
        <p className="muted">Applied to approved transactions only. A flagged transaction is still processed; it is added to the review queue.</p>
        {review.map((s, i) => (
          <Step key={s.key} step={s} index={i} count={count} onChange={(p) => update(s.key, p)} />
        ))}
      </div>
    </>
  );
}
