import { Outlet } from 'react-router-dom';
import Navbar from '@/components/Navbar';

const AppLayout = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24">
      <Outlet />
    </main>
  </div>
);

export default AppLayout;
