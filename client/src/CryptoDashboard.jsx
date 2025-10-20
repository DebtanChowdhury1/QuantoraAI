import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const COINS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', emoji: '\u{1F4B0}' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', emoji: '\u{26A1}' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', emoji: '\u{1F305}' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', emoji: '\u{1F415}' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', emoji: '\u{1F537}' },
];

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://quantora-ai.onrender.com/api'
).replace(/\/$/, '');

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const SPARKLINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  elements: {
    point: {
      radius: 0,
    },
  },
  plugins: {
    tooltip: {
      enabled: true,
      displayColors: false,
      callbacks: {
        title: () => null,
        label: (context) =>
          `$${context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 6 })}`,
      },
    },
    legend: { display: false },
  },
  scales: {
    x: {
      display: false,
    },
    y: {
      display: false,
    },
  },
};

const buildUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '\u2014';
  }
  const numeric = Number(value);
  return `$${numeric.toLocaleString(undefined, {
    minimumFractionDigits: numeric >= 1 ? 2 : 4,
    maximumFractionDigits: numeric >= 1 ? 2 : 6,
  })}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '\u2014';
  }
  const numeric = Number(value);
  const prefix = numeric > 0 ? '+' : '';
  return `${prefix}${numeric.toFixed(2)}%`;
};

const formatConfidence = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '\u2014';
  }
  return Number(value).toFixed(2);
};

const formatTimeAgo = (input) => {
  if (!input) {
    return '\u2014';
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '\u2014';
  }
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 30 * 1000) {
    return 'just now';
  }
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const actionBadgeClasses = (action) => {
  switch (action) {
    case 'BUY':
      return 'bg-emerald-500/20 text-emerald-500 ring-1 ring-inset ring-emerald-500/40';
    case 'SELL':
      return 'bg-rose-500/20 text-rose-500 ring-1 ring-inset ring-rose-500/40';
    default:
      return 'bg-sky-500/20 text-sky-500 ring-1 ring-inset ring-sky-500/40';
  }
};

const sparklineDataset = (history, accent) => ({
  labels: history.map((point) => new Date(point[0]).toISOString()),
  datasets: [
    {
      data: history.map((point) => point[1]),
      borderColor: accent.line,
      backgroundColor: accent.area,
      borderWidth: 2,
      tension: 0.4,
      fill: true,
    },
  ],
});

const accentForChange = (change) => {
  if (change === null || change === undefined) {
    return {
      line: '#38bdf8',
      area: 'rgba(56, 189, 248, 0.25)',
    };
  }
  if (Number(change) >= 0) {
    return {
      line: '#34d399',
      area: 'rgba(52, 211, 153, 0.25)',
    };
  }
  return {
    line: '#f87171',
    area: 'rgba(248, 113, 113, 0.25)',
  };
};

const fetchCoinSnapshot = async (coin) => {
  const [marketRes, predictionRes] = await Promise.all([
    fetch(buildUrl(`/crypto/${coin.id}`)),
    fetch(buildUrl(`/predict/${coin.id}`)),
  ]);

  if (!marketRes.ok) {
    throw new Error(`Market data failed (${marketRes.status})`);
  }
  if (!predictionRes.ok) {
    throw new Error(`Prediction data failed (${predictionRes.status})`);
  }

  const marketJson = await marketRes.json();
  const predictionJson = await predictionRes.json();

  const marketData = marketJson?.data ?? {};
  const predictionData = predictionJson?.data ?? {};

  const history = Array.isArray(marketData.history) ? marketData.history : [];
  const price = marketData.price ?? null;
  const change24h = marketData.change_24h ?? null;
  const volatility7d = marketData.volatility_7d ?? null;
  const action = predictionData.action ?? 'HOLD';
  const confidence = predictionData.confidence ?? null;
  const reason = predictionData.reason ?? 'AI signal currently stable.';
  const source = marketData.cached ? 'Cache' : marketData.source || 'Unknown';
  const name = marketData.name || coin.name;
  const symbol = (marketData.symbol || coin.symbol || '').toUpperCase();
  const priceUpdatedAt = marketData.lastUpdated || null;
  const aiUpdatedAt = predictionData.createdAt || null;

  const parsedPriceDate = priceUpdatedAt ? Date.parse(priceUpdatedAt) : Number.NaN;
  const parsedPredictionDate = aiUpdatedAt ? Date.parse(aiUpdatedAt) : Number.NaN;
  const freshestTimestamp = [parsedPriceDate, parsedPredictionDate]
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  return {
    id: coin.id,
    emoji: coin.emoji,
    name,
    symbol,
    price,
    change24h,
    volatility7d,
    prediction: {
      action,
      confidence,
      reason,
    },
    dataSource: source,
    history,
    lastUpdated: freshestTimestamp ? new Date(freshestTimestamp).toISOString() : priceUpdatedAt || aiUpdatedAt,
    meta: {
      priceUpdatedAt,
      aiUpdatedAt,
    },
  };
};

const CryptoDashboard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [animationSeed, setAnimationSeed] = useState(0);
  const lastGoodRef = useRef(new Map());
  const navigate = useNavigate();

  const loadData = useCallback(
    async ({ background = false } = {}) => {
      if (!background) {
        setLoading(true);
      }
      setIsRefreshing(true);
      setError(null);

      try {
        const snapshots = await Promise.all(
          COINS.map(async (coin) => {
            try {
              const snapshot = await fetchCoinSnapshot(coin);
              return { ...snapshot, stale: false, error: null };
            } catch (coinError) {
              const previous = lastGoodRef.current.get(coin.id);
              if (previous) {
                return {
                  ...previous,
                  stale: true,
                  error: coinError.message || 'Latest update failed. Showing cached data.',
                };
              }
              return {
                id: coin.id,
                emoji: coin.emoji,
                name: coin.name,
                symbol: coin.symbol,
                price: null,
                change24h: null,
                volatility7d: null,
                prediction: {
                  action: 'HOLD',
                  confidence: null,
                  reason: 'No signal available yet.',
                },
                dataSource: 'Unavailable',
                history: [],
                lastUpdated: null,
                stale: true,
                error: coinError.message || 'Unable to load data.',
                meta: {
                  priceUpdatedAt: null,
                  aiUpdatedAt: null,
                },
              };
            }
          })
        );

        const successful = snapshots.filter((entry) => !entry.error);

        if (successful.length > 0) {
          setRows(snapshots);
          setLastUpdated(new Date());
          setAnimationSeed((seed) => seed + 1);
          if (successful.length !== snapshots.length) {
            setError('Some coins failed to refresh. Displaying the most recent cached data.');
          }
        } else {
          setRows(snapshots);
          throw new Error('All coin requests failed. Please try again shortly.');
        }
      } catch (err) {
        console.error(err);
        setError(err.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData({ background: true });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    rows.forEach((row) => {
      if (!row.error) {
        lastGoodRef.current.set(row.id, row);
      }
    });
  }, [rows]);

  const handleManualRefresh = useCallback(() => {
    loadData({ background: true });
  }, [loadData]);

  const headerTimestamp = useMemo(
    () => (lastUpdated ? formatTimeAgo(lastUpdated) : '\u2014'),
    [lastUpdated]
  );

  const handleOpenCoin = useCallback(
    (coinId) => {
      navigate(`/coin/${coinId}`);
    },
    [navigate]
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-transparent border-l-emerald-400 border-t-emerald-400" />
        <p className="text-base font-medium text-slate-300">
          Loading Quantora AI insights...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900/80 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-500">Quantora AI</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            Quantora AI \u2014 Real-Time Crypto Predictions
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Last updated: {headerTimestamp}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent border-l-emerald-400 border-t-emerald-400" />
              Updating...
            </div>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400 px-5 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/80 dark:text-emerald-300"
          >
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            Refresh Now
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-auto mb-6 max-w-6xl rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <main className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((coin) => {
          const accent = accentForChange(coin.change24h);
          const history = Array.isArray(coin.history) ? coin.history : [];
          const hasHistory = history.length > 1;
          const chartData = hasHistory ? sparklineDataset(history, accent) : null;

          return (
            <article
              key={`${coin.id}-${animationSeed}`}
              className={clsx(
                'fade-in flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition hover:-translate-y-1 hover:border-emerald-400/60 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-emerald-500/60',
                coin.stale && 'ring-1 ring-amber-400/50'
              )}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenCoin(coin.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleOpenCoin(coin.id);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {coin.emoji} {coin.name} ({coin.symbol})
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(coin.price)}
                  </h2>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                    actionBadgeClasses(coin.prediction.action)
                  )}
                >
                  {coin.prediction.action}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-300">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    24h
                  </dt>
                  <dd
                    className={clsx(
                      'text-base font-medium',
                      coin.change24h === null || coin.change24h === undefined
                        ? 'text-slate-500 dark:text-slate-400'
                        : Number(coin.change24h) >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}
                  >
                    {formatPercent(coin.change24h)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Volatility (7d)
                  </dt>
                  <dd className="text-base font-medium">{formatPercent(coin.volatility7d)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Confidence
                  </dt>
                  <dd className="text-base font-medium">
                    {formatConfidence(coin.prediction.confidence)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Source
                  </dt>
                  <dd className="text-base font-medium">{coin.dataSource}</dd>
                </div>
              </dl>

              <div className="mt-6 min-h-[80px]">
                {coin.error && coin.stale ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-300">
                    {coin.error}
                  </div>
                ) : hasHistory ? (
                  <div className="h-24">
                    <Line options={SPARKLINE_OPTIONS} data={chartData} />
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    Sparkline unavailable
                  </div>
                )}
              </div>

              <p className="mt-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-800 dark:text-slate-100">Reason:</span>{' '}
                {coin.prediction.reason}
              </p>

              <div className="mt-6 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>
                  Last Updated: {formatTimeAgo(coin.lastUpdated)}
                  {coin.stale ? ' (cached)' : ''}
                </span>
                <span>
                  AI: {coin.meta.aiUpdatedAt ? formatTimeAgo(coin.meta.aiUpdatedAt) : '\u2014'}
                </span>
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
};

export default CryptoDashboard;
