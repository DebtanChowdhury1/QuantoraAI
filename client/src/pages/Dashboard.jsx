import { useMemo } from 'react';
import { motion } from 'framer-motion';
import CoinTable from '@/components/CoinTable';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import StatCards from '@/components/StatCards';
import AccuracyCard from '@/components/AccuracyCard';
import useMarkets from '@/hooks/useMarkets';
import useAlertPreferences from '@/hooks/useAlertPreferences';
import { useUser, SignedIn, SignedOut, SignInButton } from '@/lib/authClient';

const Dashboard = () => {
  const { markets, isLoading, isError, marketsQuery, predictionsQuery, predictionError } = useMarkets();
  const errorMessage = marketsQuery.error?.message || "Unable to load markets. Please retry.";
  const { isSignedIn, user } = useUser();

  const identity = useMemo(() => {
    if (!isSignedIn || !user) return null;
    return {
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    };
  }, [isSignedIn, user]);

  const { preferencesQuery, updatePreferences, updating } = useAlertPreferences(identity || {});

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

  const handleToggleAlert = async (coinId, enabled) => {
    if (!identity) {
      return;
    }
    const next = { ...preferences, [coinId]: enabled };
    await updatePreferences(next);
  };

  if (isLoading) {
    return <Loader label="Loading market data" />;
  }

  if (isError) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => {
          marketsQuery.refetch();
          predictionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-100">Market Dashboard</h1>
            <p className="text-sm text-neutral-400">
              Real-time CoinGecko pricing blended with Quantora AI signals.
            </p>
          </div>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-background"
              >
                Sign in to manage alerts
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </motion.section>

      <StatCards markets={markets} />
      <AccuracyCard predictions={predictionsQuery.data?.data || []} />

      
      {predictionError && (
        <p className="text-xs text-red-400">AI signals temporarily unavailable: {predictionError.message}</p>
      )}

      <CoinTable
        markets={markets}
        alertPreferences={preferences}
        onToggleAlert={identity ? handleToggleAlert : undefined}
      />

      <SignedIn>
        {updating && <p className="text-xs text-neutral-400">Saving preferences...</p>}
      </SignedIn>
    </div>
  );
};

export default Dashboard;
