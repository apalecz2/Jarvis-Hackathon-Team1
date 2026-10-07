import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateTime, items } from '../lib/format';
import { ErrorMsg, Loading, StatusBadge } from '../components/Bits';

export default function Runs() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ['runs'], queryFn: () => api('/runs') });
  const reset = useMutation({
    mutationFn: () => api('/runs', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(), // runs, flags and account balances all change
  });
  if (isLoading) return <Loading />;
  const runs = items(data);
  const confirmReset = () =>
    confirm('Delete all runs, transactions, outcomes, flags and ledger entries?\n\nAccounts are kept and their balances are restored to the original values. This cannot be undone.') &&
    reset.mutate();
  return (
    <div className="card">
      <div className="row between">
        <h1>Runs</h1>
        <button className="secondary danger" disabled={reset.isPending || runs.length === 0} onClick={confirmReset}>
          {reset.isPending ? 'Resetting...' : 'Reset all data'}
        </button>
      </div>
      <ErrorMsg error={error} />
      <ErrorMsg error={reset.error} />
      {runs.length === 0 ? (
        <p className="muted">No runs yet. <Link to="/">Upload a file</Link>.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Run</th><th>File</th><th>Status</th><th>Started</th><th className="num">Processed</th><th className="num">Approved</th><th className="num">Rejected</th><th className="num">Flagged</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.runId}>
                  <td><Link to={`/runs/${r.runId}`}>#{r.runId}</Link></td>
                  <td>{r.sourceFile}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{dateTime(r.startedAt)}</td>
                  <td className="num">{r.summary?.processed ?? '—'}</td>
                  <td className="num">{r.summary?.approved ?? '—'}</td>
                  <td className="num">{r.summary?.rejected ?? '—'}</td>
                  <td className="num">{r.summary?.flagged ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
