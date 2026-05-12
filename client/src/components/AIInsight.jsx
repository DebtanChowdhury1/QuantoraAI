import clsx from 'clsx';
import { useCurrency } from '@/context/CurrencyContext';
import { formatConfidencePercent, formatUsdAsCurrency } from '@/lib/formatters';

const actionStyles = {
  BUY: {
    bg: 'bg-accent/10 border-accent/40 text-accent',
    subtitle: 'Positive momentum detected',
  },
  HOLD: {
    bg: 'bg-gold/10 border-gold/40 text-gold',
    subtitle: 'Neutral market edge',
  },
  SELL: {
    bg: 'bg-red-500/10 border-red-500/40 text-red-400',
    subtitle: 'Downside risk elevated',
  },
};

const riskText = {
  LOW: 'text-accent',
  MEDIUM: 'text-gold',
  HIGH: 'text-red-400',
};

const trendDescriptions = {
  UPTREND: 'Price momentum is leaning upward.',
  SIDEWAYS: 'Price is range-bound without a clear breakout.',
  DOWNTREND: 'Price momentum is leaning downward.',
};

const horizonDescriptions = {
  '12-24H': 'Short-term signal window.',
  '24-72H': 'Expected signal window for the next 1-3 days.',
};

const Metric = ({ label, value, accent, description }) => (
  <div className="min-h-[132px] rounded-xl border border-neutral-600/40 bg-neutral-950/40 px-4 py-3 text-sm">
    <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">Value</p>
      <p className={clsx('mt-1 text-xl font-semibold leading-tight', accent)}>{value}</p>
    </div>
    {description && (
      <div className="mt-3 border-t border-neutral-700/60 pt-2">
        <p className="text-[10px] uppercase tracking-wide text-neutral-500">Meaning</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-300">{description}</p>
      </div>
    )}
  </div>
);

const AIInsight = ({ prediction, stats, meta }) => {
  const { currency, rate } = useCurrency();
  if (!prediction) return null;

  const style = actionStyles[prediction.action] || actionStyles.HOLD;
  const isFallback = meta?.sourceType === 'heuristic' || meta?.fallbackUsed;
  const sourceLabel = isFallback
    ? 'Protected Signal'
    : meta?.sourceType === 'cache'
    ? 'Cached Signal'
    : 'Quantora AI Signal';
  const reusedLabel = meta?.reused ? ' (cached)' : '';

  return (
    <div
      className={clsx('rounded-2xl border p-6 shadow-glow backdrop-blur', style.bg, 'border-neutral-600/40')}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-300">Quantora Signal</p>
          <div className="mt-3 flex items-center gap-3 text-3xl font-bold">
            <span className="h-3 w-3 rounded-full bg-current shadow-glow" />
            <span>{prediction.action}</span>
          </div>
          <p className="mt-2 text-sm text-neutral-200">{style.subtitle}</p>
          <p
            className={clsx(
              'mt-3 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
              isFallback
                ? 'border-amber-400/40 bg-amber-500/20 text-amber-200'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
            )}
          >
            {sourceLabel}
            {reusedLabel}
          </p>
        </div>
        <div className="text-left text-sm text-neutral-400 sm:text-right">
          <p>Confidence</p>
          <p className="text-2xl font-bold text-neutral-50">
            {formatConfidencePercent(prediction.confidence)}
          </p>
          <p className={clsx('mt-1 text-xs font-semibold', riskText[prediction.riskLevel] || 'text-neutral-300')}>
            {prediction.riskLevel || 'MEDIUM'} RISK
          </p>
          <p className="mt-1 text-xs">
            Updated{' '}
            {new Intl.DateTimeFormat('en-US', {
              hour: 'numeric',
              minute: 'numeric',
              month: 'short',
              day: 'numeric',
            }).format(new Date(prediction.createdAt))}
          </p>
        </div>
      </div>
      <p className={clsx('mt-6 text-sm leading-relaxed', isFallback ? 'text-amber-100' : 'text-neutral-200')}>
        {prediction.reasoning || prediction.reason}
      </p>
      {isFallback && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">
          Live market-data logic is being used for this signal, so the platform remains available even when an AI provider is delayed.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Metric
          label="Trend"
          value={prediction.trendDirection || 'SIDEWAYS'}
          accent="text-neutral-100"
          description={trendDescriptions[prediction.trendDirection] || trendDescriptions.SIDEWAYS}
        />
        <Metric
          label="Horizon"
          value={prediction.predictionHorizon || '24-72H'}
          accent="text-neutral-100"
          description={horizonDescriptions[prediction.predictionHorizon] || 'Approximate time window for this signal.'}
        />
        <Metric
          label="Market Strength"
          value={`${Number(prediction.marketStrength ?? 50).toFixed(1)}/100`}
          accent="text-accent"
        />
        <Metric
          label="Average Price"
          value={formatUsdAsCurrency(stats?.avgPrice ?? 0, { currency, rate })}
          accent="text-neutral-100"
        />
        <Metric
          label="Volatility"
          value={`${(stats?.volatility ?? 0).toFixed(2)}%`}
          accent="text-neutral-100"
        />
        <Metric
          label="24h Change"
          value={`${(stats?.change24h ?? 0).toFixed(2)}%`}
          accent={(stats?.change24h ?? 0) >= 0 ? 'text-accent' : 'text-red-400'}
        />
      </div>
    </div>
  );
};

export default AIInsight;
