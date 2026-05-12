import { Outlet } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';
import NotificationToasts from '@/components/NotificationToasts';

const AppLayout = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <NotificationToasts />
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <p className="mt-10 text-center text-xs text-neutral-500">
        This platform provides AI-generated market insights and not financial advice.
      </p>
    </main>
  </div>
);

export default AppLayout;
