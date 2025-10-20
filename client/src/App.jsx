import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import CoinDetail from '@/pages/CoinDetail';
import Alerts from '@/pages/Alerts';
import Profile from '@/pages/Profile';

const App = () => (
  <Routes>
    <Route path="/" element={<AppLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="coin/:id" element={<CoinDetail />} />
      <Route path="alerts" element={<Alerts />} />
      <Route path="profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
);

export default App;
