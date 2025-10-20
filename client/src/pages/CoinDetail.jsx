import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import PriceChart from '@/components/PriceChart';
import AIInsight from '@/components/AIInsight';
import PredictionHistoryList from '@/components/PredictionHistoryList';
import AlertPreferencesPanel from '@/components/AlertPreferencesPanel';
import usePrediction from '@/hooks/usePrediction';
import useAlertPreferences from '@/hooks/useAlertPreferences';
import { SignedIn, SignedOut, SignInButton, useUser } from '@/lib/authClient';

const CoinDetail = () => {
  const { id } = useParams();
  const { isSignedIn, user } = useUser();
  const identity = useMemo(() => {
    if (!isSignedIn || !user) return null;
    return {
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    };
  }, [isSignedIn, user]);

  const {
    prediction,
    predictionMeta,
    history,
    chart,
    snapshot,
    chartFallback,
    chartSource,
    snapshotFallback,
    snapshotSource,
    predictionQuery,
    historyQuery,
    chartQuery,
    snapshotQuery,
  } = usePrediction(id);

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

  const handleToggle = async (coinId, enabled) => {
    if (!identity) return;
    const next = { ...preferences, [coinId]: enabled };
    await updatePreferences(next);
  };

  const predictionError = predictionQuery.isError;
  const historyError = historyQuery.isError;
  const chartError = chartQuery.isError;
  const snapshotError = snapshotQuery.isError;

  const loading = predictionQuery.isLoading && !prediction;

  if (loading) {
    return <Loader label="Building AI insight" />;
  }
  if (!prediction && predictionError) {
    return (
      <ErrorState
        message={predictionQuery.error?.message || 'Unable to load coin details'}
        onRetry={() => {
          predictionQuery.refetch();
          chartQuery.refetch();
          historyQuery.refetch();
          snapshotQuery.refetch();
        }}
      />
    );
  }

  const coinName = snapshot?.name || prediction?.coinId || id;
  const chartData = !chartError && chart?.prices ? chart.prices : [];
  const currentPrice = (() => {
    if (typeof snapshot?.current_price === 'number') {
      return snapshot.current_price;
    }
    if (typeof prediction?.marketPrice === 'number') {
      return prediction.marketPrice;
    }
    return null;
  })();
  const stats = prediction?.stats || {
    avgPrice: prediction?.averagePrice,
    volatility: prediction?.volatility,
    change24h: prediction?.change24h,
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-100">
              {coinName}
              {snapshot?.symbol && <span> ({snapshot.symbol.toUpperCase()})</span>}
            </h1>
            <p className="text-sm text-neutral-400">
              Live trend analysis powered by Google Gemini 2.0 Flash.
              {snapshotFallback && (
                <span className="ml-2 text-xs uppercase tracking-wide text-gold">
                  Fallback snapshot via {snapshotSource}
                </span>
              )}
              {snapshotError && !snapshot && (
                <span className="ml-2 text-xs uppercase tracking-wide text-red-300">
                  Snapshot unavailable right now
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-neutral-400">Current Price</p>
            <p className="text-2xl font-semibold text-accent">
              {currentPrice !== null
                ? `$${currentPrice.toLocaleString(undefined, {
                    minimumFractionDigits: currentPrice >= 1 ? 2 : 4,
                    maximumFractionDigits: currentPrice >= 1 ? 2 : 6,
                  })}`
                : 'N/A'}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
            <h2 className="text-lg font-semibold text-neutral-100">7 Day Price Action</h2>
            <p className="text-sm text-neutral-400">
              {chartError
                ? 'Price history unavailable right now.'
                : chartFallback
                ? `Fallback history via ${chartSource} (cached).`
                : 'CoinGecko spot pricing with 60s cached updates.'}
            </p>
            <div className="mt-6">
              {chartError ? (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-neutral-600/40 text-sm text-neutral-400">
                  Unable to render chart data.
                </div>
              ) : (
                <PriceChart prices={chartData} />
              )}
            </div>
          </div>
        </div>
        <AIInsight prediction={prediction} stats={stats} meta={predictionMeta} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PredictionHistoryList
          history={!historyError ? history || [] : []}
          errorMessage={
            historyError ? historyQuery.error?.message || 'Signal history unavailable.' : undefined
          }
        />
        <div className="space-y-4">
          <SignedIn>
            <AlertPreferencesPanel
              preferences={preferences}
              onToggle={handleToggle}
              disabled={updating}
            />
            {updating && <p className="text-xs text-neutral-400">Saving alert preferences...</p>}
          </SignedIn>
          <SignedOut>
            <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 text-sm text-neutral-200">
              <p>Sign in with Clerk to customize alert thresholds for {coinName}.</p>
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
        </div>
      </div>
    </div>
  );
};

export default CoinDetail;


