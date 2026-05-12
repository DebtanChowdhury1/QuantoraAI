import { useLayoutEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import PriceChart from '@/components/PriceChart';
import AIInsight from '@/components/AIInsight';
import PredictionHistoryList from '@/components/PredictionHistoryList';
import ConfidenceChart from '@/components/ConfidenceChart';
import AlertPreferencesPanel from '@/components/AlertPreferencesPanel';
import ChatPanel from '@/components/ChatPanel';
import usePrediction from '@/hooks/usePrediction';
import useAlertPreferences from '@/hooks/useAlertPreferences';
import { useCurrency } from '@/context/CurrencyContext';
import { formatUsdAsCurrency } from '@/lib/formatters';
import { SignedIn, SignedOut, SignInButton, useUser } from '@/lib/authClient';

const CoinDetail = () => {
  const { id } = useParams();
  const { isSignedIn, user } = useUser();
  const { currency, rate } = useCurrency();

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    const timer = window.setTimeout(resetScroll, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [id]);

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
      acc[pref.coinId] = {
        enabled: pref.enabled,
        minConfidence: pref.minConfidence ?? 0.65,
        cooldownMinutes: pref.cooldownMinutes ?? 60,
      };
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

  const currentPrice = (() => {
    if (typeof snapshot?.current_price === 'number') {
      return snapshot.current_price;
    }
    if (typeof prediction?.marketPrice === 'number') {
      return prediction.marketPrice;
    }
    return null;
  })();
  const coinName = snapshot?.name || prediction?.coinId || id;
  const liveUpdatedAt = snapshot?.last_updated ? new Date(snapshot.last_updated) : null;
  const liveUpdatedAtMs =
    liveUpdatedAt && Number.isFinite(liveUpdatedAt.getTime()) ? liveUpdatedAt.getTime() : Date.now();
  const chartData = (() => {
    const base = !chartError && Array.isArray(chart?.prices) ? [...chart.prices] : [];
    if (typeof currentPrice !== 'number') {
      return base;
    }
    const last = base[base.length - 1];
    if (!last || liveUpdatedAtMs - Number(last[0]) > 30 * 1000) {
      base.push([liveUpdatedAtMs, currentPrice]);
      return base;
    }
    base[base.length - 1] = [liveUpdatedAtMs, currentPrice];
    return base;
  })();
  const stats = prediction?.stats || {
    avgPrice: prediction?.averagePrice,
    volatility: prediction?.volatility,
    change24h: prediction?.change24h,
  };

  return (
    <div className="space-y-8">
      <div
        className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-100">
              {coinName}
              {snapshot?.symbol && <span> ({snapshot.symbol.toUpperCase()})</span>}
            </h1>
            <p className="text-sm text-neutral-400">
              Live Quantora AI trend analysis with provider-aware fallback protection.
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
            {liveUpdatedAt && (
              <p className="mt-2 text-xs text-neutral-500">
                Live snapshot updated{' '}
                {new Intl.DateTimeFormat('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                }).format(liveUpdatedAt)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-neutral-400">
              Current Price
              {snapshotQuery.isFetching && (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-accent shadow-glow" />
              )}
            </p>
            <p className="text-2xl font-semibold text-accent">
              {currentPrice !== null
                ? formatUsdAsCurrency(currentPrice, { currency, rate })
                : 'N/A'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Live market sync</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
            <h2 className="text-lg font-semibold text-neutral-100">7 Day Price Action</h2>
            <p className="text-sm text-neutral-400">
              {chartError
                ? 'Price history unavailable right now.'
                : chartFallback
                ? `Hourly history via ${chartSource}; live ticker appended.`
                : 'Spot history with live ticker overlay.'}
            </p>
            <div className="mt-6">
              {chartError ? (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-neutral-600/40 bg-neutral-950/40 text-sm text-neutral-400">
                  Unable to render chart data.
                </div>
              ) : (
                <PriceChart prices={chartData} />
              )}
            </div>
          </div>
          <ConfidenceChart history={!historyError ? history || [] : []} />
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
            <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 text-sm text-neutral-200 shadow-glow">
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

      <ChatPanel
        scope="coin"
        coinId={id}
        title={`${coinName} Expert Chat`}
        subtitle={`Ask Quantora about ${coinName} using live price, 7-day history, volatility, signals, and accuracy context.`}
      />
    </div>
  );
};

export default CoinDetail;


