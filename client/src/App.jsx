import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Upload from './pages/Upload';
import Runs from './pages/Runs';
import RunDetail from './pages/RunDetail';
import Flags from './pages/Flags';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Upload />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/runs/:id" element={<RunDetail />} />
        <Route path="/flags" element={<Flags />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="*" element={<p className="muted">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
