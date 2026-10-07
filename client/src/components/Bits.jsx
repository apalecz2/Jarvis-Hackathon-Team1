import { label } from '../lib/format';

export const Loading = () => <p className="muted">Loading...</p>;
export const ErrorMsg = ({ error }) => (error ? <p className="error">{error.message || String(error)}</p> : null);

export function Badge({ kind, children }) {
  return <span className={`badge ${kind || ''}`}>{children}</span>;
}

export const StatusBadge = ({ status }) => (
  <Badge kind={{ APPROVED: 'ok', COMPLETED: 'ok', CLEARED: 'ok', REJECTED: 'bad', FAILED: 'bad', ESCALATED: 'bad', PENDING: 'warn', RUNNING: 'warn' }[status]}>
    {label(status)}
  </Badge>
);

export const FlagBadge = ({ type }) => <Badge kind="warn">{label(type)}</Badge>;

export function Stat({ title, value, kind }) {
  return (
    <div className={`stat ${kind || ''}`}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-title">{title}</div>
    </div>
  );
}

export function SummaryCards({ summary }) {
  if (!summary) return null;
  return (
    <div className="stats">
      <Stat title="Processed" value={summary.processed} />
      <Stat title="Approved" value={summary.approved} kind="ok" />
      <Stat title="Rejected" value={summary.rejected} kind="bad" />
      <Stat title="Flagged" value={summary.flagged} kind="warn" />
    </div>
  );
}
