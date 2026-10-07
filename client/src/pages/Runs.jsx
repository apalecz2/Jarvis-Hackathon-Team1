import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateTime, items } from '../lib/format';
import { ErrorMsg, Loading, StatusBadge } from '../components/Bits';

export default function Runs() {
  const { data, error, isLoading } = useQuery({ queryKey: ['runs'], queryFn: () => api('/runs') });
  if (isLoading) return <Loading />;
  const runs = items(data);
  return (
    <div className="card">
      <h1>Runs</h1>
      <ErrorMsg error={error} />
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
