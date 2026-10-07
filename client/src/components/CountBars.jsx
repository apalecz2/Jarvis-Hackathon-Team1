import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { label } from '../lib/format';

/** Horizontal bar chart of a { KEY: count } object. */
export default function CountBars({ title, counts, color }) {
  const data = Object.entries(counts || {}).map(([k, v]) => ({ name: label(k), value: v })).sort((a, b) => b.value - a.value);
  return (
    <div className="card">
      <h2>{title}</h2>
      {data.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34 + 30)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={170} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
