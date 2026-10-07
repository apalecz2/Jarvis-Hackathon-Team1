import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { dateTime, items, label, money } from '../lib/format';
import { ErrorMsg, FlagBadge, Loading, StatusBadge, SummaryCards } from '../components/Bits';
import CountBars from '../components/CountBars';

const LIMIT = 50;
const FILTERS = [
  { key: 'all', title: 'All', params: {} },
  { key: 'rejected', title: 'Rejected', params: { status: 'REJECTED' } },
  { key: 'approved', title: 'Approved', params: { status: 'APPROVED' } },
  { key: 'flagged', title: 'Flagged', params: { flagged: 'true' } },
];

export default function RunDetail() {
  const { id } = useParams();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const run = useQuery({ queryKey: ['run', id], queryFn: () => api(`/runs/${id}`) });
  const params = FILTERS.find((f) => f.key === filter).params;
  const results = useQuery({
    queryKey: ['results', id, filter, page],
    queryFn: () => api(`/runs/${id}/results${qs({ ...params, page, limit: LIMIT })}`),
    placeholderData: keepPreviousData,
  });

  async function download() {
    const txt = await api(`/runs/${id}/results.txt`, { text: true });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `run-${id}-results.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (run.isLoading) return <Loading />;
  if (run.error) return <ErrorMsg error={run.error} />;
  const r = run.data;
  const rows = items(results.data);
  const total = results.data?.total;
  const hasNext = total != null ? page * LIMIT < total : rows.length === LIMIT;

  return (
    <>
      <div className="row between">
        <h1>
          Run #{r.runId} <StatusBadge status={r.status}>{r.status}</StatusBadge>
        </h1>
        <button className="secondary" onClick={() => download().catch((e) => alert(e.message))}>Download text report</button>
      </div>
      <p className="muted">Started {dateTime(r.startedAt)} · Completed {dateTime(r.completedAt)}</p>
      <SummaryCards summary={r.summary} />

      <div className="grid2">
        <CountBars title="Reject reasons" counts={r.rejectReasons} color="#dc2626" />
        <CountBars title="Flag types" counts={r.flagTypes} color="#d97706" />
      </div>

      <div className="card">
        <div className="row between">
          <h2>Transactions</h2>
          <div className="seg">
            {FILTERS.map((f) => (
              <button key={f.key} className={f.key === filter ? 'active' : ''} onClick={() => { setFilter(f.key); setPage(1); }}>
                {f.title}
              </button>
            ))}
          </div>
        </div>
        <ErrorMsg error={results.error} />
        {results.isLoading ? <Loading /> : rows.length === 0 ? <p className="muted">No transactions match.</p> : (
          <div className="table-wrap tall">
            <table>
              <thead>
                <tr><th>Line</th><th>ID</th><th>Time</th><th>Type</th><th>From</th><th>To</th><th className="num">Amount</th><th>Status</th><th>Reason / flags</th></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.lineNumber} className={t.status === 'REJECTED' ? 'row-bad' : ''}>
                    <td>{t.lineNumber}</td>
                    <td>{t.transactionId ?? '—'}</td>
                    <td>{t.occurredAt ? t.occurredAt.replace('T', ' ') : '—'}</td>
                    <td>{label(t.type)}</td>
                    <td>{t.fromAccount ? <Link to={`/accounts/${t.fromAccount}`}>{t.fromAccount}</Link> : '—'}</td>
                    <td>{t.toAccount ? <Link to={`/accounts/${t.toAccount}`}>{t.toAccount}</Link> : '—'}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="wrap">
                      {t.rejectReason && <span className="reason">{label(t.rejectReason)}</span>}
                      {(t.flags || []).map((f, i) => (
                        <span key={i} title={f.detail}><FlagBadge type={f.type} /></span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row pager">
          <button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page}{total != null ? ` of ${Math.max(1, Math.ceil(total / LIMIT))}` : ''}</span>
          <button className="secondary" disabled={!hasNext} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </>
  );
}
