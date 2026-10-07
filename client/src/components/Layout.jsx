import { NavLink, Outlet } from 'react-router-dom';

const icon = (d) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const LINKS = [
  { to: '/', label: 'Upload', end: true, icon: icon(<><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></>) },
  { to: '/runs', label: 'Runs', icon: icon(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>) },
  { to: '/flags', label: 'Review queue', icon: icon(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>) },
  { to: '/pipeline', label: 'Pipeline', icon: icon(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>) },
  { to: '/accounts', label: 'Accounts', icon: icon(<><path d="M3 10 12 4l9 6" /><path d="M5 10v8M10 10v8M14 10v8M19 10v8" /><path d="M3 20h18" /></>) },
];

export default function Layout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">CB</span>
          <span className="brand-text">
            <strong>CBOJ</strong>
            <small>Transaction Engine</small>
          </span>
        </NavLink>
        <nav>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.icon}
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Canadian Bank of Jarvis</div>
      </aside>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
