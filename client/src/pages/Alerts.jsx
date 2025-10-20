import { useMemo } from 'react';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import AlertPreferencesPanel from '@/components/AlertPreferencesPanel';
import AlertHistory from '@/components/AlertHistory';
import useAlertPreferences from '@/hooks/useAlertPreferences';
import { SignedIn, SignedOut, SignInButton, useUser } from '@/lib/authClient';

const Alerts = () => {
  const { isSignedIn, user } = useUser();
  const identity = useMemo(() => {
    if (!isSignedIn || !user) return null;
    return {
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    };
  }, [isSignedIn, user]);

  const { preferencesQuery, historyQuery, updatePreferences, updating } = useAlertPreferences(
    identity || {}
  );

  const preferences = useMemo(() => {
    const rows = preferencesQuery.data?.data;
    if (!rows) {
      return {};
    }
    return rows.reduce((acc, pref) => {
      acc[pref.coinId] = pref.enabled;
      return acc;
    }, {});
  }, [preferencesQuery.data]);

  if (historyQuery.isLoading || preferencesQuery.isLoading) {
    return <Loader label="Loading alert center" />;
  }

  if (historyQuery.isError || preferencesQuery.isError) {
    return (
      <ErrorState
        message="Unable to load alert data"
        onRetry={() => {
          historyQuery.refetch();
          preferencesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
        <h1 className="text-3xl font-semibold text-neutral-100">Alerts & Notifications</h1>
        <p className="text-sm text-neutral-400">
          Quantora AI keeps total dispatches under 100/day with a 60 min per-user cooldown.
        </p>
      </header>
      <SignedIn>
        <AlertPreferencesPanel
          preferences={preferences}
          onToggle={(coinId, enabled) => updatePreferences({ ...preferences, [coinId]: enabled })}
          disabled={updating}
        />
        {updating && <p className="text-xs text-neutral-400">Updating alert settings...</p>}
      </SignedIn>
      <SignedOut>
        <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 text-sm text-neutral-200">
          <p>Sign in to enable personalized email alerts via Gmail (100/day global cap).</p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-background"
            >
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
      <AlertHistory alerts={historyQuery.data || []} />
    </div>
  );
};

export default Alerts;
