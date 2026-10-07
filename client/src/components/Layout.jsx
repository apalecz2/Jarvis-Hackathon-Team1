import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getToken, setToken } from '../lib/api';

export default function Layout() {
  const [token, setTok] = useState(getToken());
  const [editing, setEditing] = useState(false);

  function save(e) {
    e.preventDefault();
    setToken(token.trim());
    setEditing(false);
  }

  return (
    <>
      <header className="nav">
        <NavLink to="/" className="brand">CBOJ Transactions</NavLink>
        <nav>
          <NavLink to="/" end>Upload</NavLink>
          <NavLink to="/runs">Runs</NavLink>
          <NavLink to="/flags">Review queue</NavLink>
          <NavLink to="/accounts">Accounts</NavLink>
        </nav>
        <span className="spacer" />
        {editing ? (
          <form className="row tight" onSubmit={save}>
            <input type="password" placeholder="Admin token" value={token} onChange={(e) => setTok(e.target.value)} autoFocus />
            <button>Save</button>
          </form>
        ) : (
          <button className="secondary" onClick={() => setEditing(true)}>
            {getToken() ? 'Admin token set' : 'Set admin token'}
          </button>
        )}
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
