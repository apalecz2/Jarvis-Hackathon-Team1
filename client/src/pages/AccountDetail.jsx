import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateTime, label, money } from '../lib/format';
import { Badge, ErrorMsg, Loading } from '../components/Bits';

export default function AccountDetail() {
  const { id } = useParams();
  const { data, error, isLoading } = useQuery({ queryKey: ['account', id], queryFn: () => api(`/accounts/${id}`) });
  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg error={error} />;
  const a = data.account ?? data;
  const ledger = data.ledger ?? [];
  const cur = a.currency;
  return (
    <>
      <p><Link to="/accounts">← Accounts</Link></p>
      <div className="card">
        <h1>{a.id} <Badge kind={a.status === 'ACTIVE' ? 'ok' : 'bad'}>{a.status}</Badge></h1>
        <div className="stats">
          <div className="stat"><div className="stat-value">{money(a.balance, cur)}</div><div className="stat-title">Balance</div></div>
          <div className="stat"><div className="stat-value">{money(a.dailyLimit, cur)}</div><div className="stat-title">Daily limit</div></div>
          <div className="stat"><div className="stat-value">{cur}</div><div className="stat-title">Currency</div></div>
        </div>
      </div>
      <div className="card">
        <h2>Ledger</h2>
        {ledger.length === 0 ? <p className="muted">No ledger entries.</p> : (
          <div className="table-wrap tall">
            <table>
              <thead>
                <tr><th>Time</th><th>Transaction</th><th>Type</th><th className="num">Change</th><th className="num">Balance after</th></tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td>{e.occurredAt ? e.occurredAt.replace('T', ' ') : dateTime(e.createdAt)}</td>
                    <td>{e.transactionId ?? '—'}</td>
                    <td>{label(e.type)}</td>
                    <td className={`num ${Number(e.delta) < 0 ? 'neg' : 'pos'}`}>{money(e.delta, cur)}</td>
                    <td className="num">{money(e.balanceAfter, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
