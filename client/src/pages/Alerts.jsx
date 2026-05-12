import NotificationControls from '@/components/NotificationControls';
import NotificationHistory from '@/components/NotificationHistory';
import { SignedIn } from '@/lib/authClient';

const Alerts = () => {
  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow">
        <h1 className="text-3xl font-semibold text-neutral-100">Notifications</h1>
        <p className="text-sm text-neutral-400">
          Quantora AI signal alerts by email, browser push, and in-page popups.
        </p>
      </header>
      <NotificationControls />
      <SignedIn>
        <NotificationHistory />
      </SignedIn>
    </div>
  );
};

export default Alerts;
