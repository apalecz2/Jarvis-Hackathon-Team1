import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { items, money } from '../lib/format';
import { Badge, ErrorMsg, Loading } from '../components/Bits';

export default function Accounts() {
  const { data, error, isLoading } = useQuery({ queryKey: ['accounts'], queryFn: () => api('/accounts') });
  if (isLoading) return <Loading />;
  return (
    <div className="card">
      <h1>Accounts</h1>
      <ErrorMsg error={error} />
      <div className="table-wrap tall">
        <table>
          <thead>
            <tr><th>Account</th><th>Status</th><th>Currency</th><th className="num">Balance</th><th className="num">Daily limit</th></tr>
          </thead>
          <tbody>
            {items(data).map((a) => (
              <tr key={a.id}>
                <td><Link to={`/accounts/${a.id}`}>{a.id}</Link></td>
                <td><Badge kind={a.status === 'ACTIVE' ? 'ok' : 'bad'}>{a.status}</Badge></td>
                <td>{a.currency}</td>
                <td className="num">{money(a.balance, a.currency)}</td>
                <td className="num">{money(a.dailyLimit, a.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
