import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { items, label, money } from '../lib/format';
import { ErrorMsg, FlagBadge, Loading } from '../components/Bits';

export default function Flags() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ['flags'], queryFn: () => api('/flags?reviewStatus=PENDING') });
  const review = useMutation({
    mutationFn: ({ id, reviewStatus }) => api(`/flags/${id}`, { method: 'PATCH', body: { reviewStatus } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flags'] }),
  });

  if (isLoading) return <Loading />;
  const flags = items(data);
  return (
    <div className="card">
      <h1>Review queue</h1>
      <ErrorMsg error={error} />
      <ErrorMsg error={review.error} />
      {flags.length === 0 ? <p className="muted">Nothing pending review.</p> : (
        <div className="table-wrap tall">
          <table>
            <thead>
              <tr><th>Flag</th><th>Detail</th><th>Run</th><th>Transaction</th><th>Type</th><th>From</th><th>To</th><th className="num">Amount</th><th /></tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const t = f.transaction || f;
                const busy = review.isPending && review.variables?.id === f.id;
                return (
                  <tr key={f.id}>
                    <td><FlagBadge type={f.type ?? f.flagType} /></td>
                    <td className="wrap">{f.detail}</td>
                    <td>{f.runId != null ? <Link to={`/runs/${f.runId}`}>#{f.runId}</Link> : '—'}</td>
                    <td>{t.transactionId ?? '—'}</td>
                    <td>{label(t.type)}</td>
                    <td>{t.fromAccount ?? '—'}</td>
                    <td>{t.toAccount ?? '—'}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td className="actions">
                      <button className="secondary" disabled={busy} onClick={() => review.mutate({ id: f.id, reviewStatus: 'CLEARED' })}>Clear</button>
                      <button className="secondary danger" disabled={busy} onClick={() => review.mutate({ id: f.id, reviewStatus: 'ESCALATED' })}>Escalate</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
