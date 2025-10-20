import { motion } from 'framer-motion';
import clsx from 'clsx';

const actionStyles = {
  BUY: {
    bg: 'bg-accent/10 border-accent/40 text-accent',
    emoji: '🟢',
    subtitle: 'Positive momentum detected',
  },
  HOLD: {
    bg: 'bg-gold/10 border-gold/40 text-gold',
    emoji: '🟡',
    subtitle: 'Stable outlook',
  },
  SELL: {
    bg: 'bg-red-500/10 border-red-500/40 text-red-400',
    emoji: '🔴',
    subtitle: 'Downside risk ahead',
  },
};

const Metric = ({ label, value, accent }) => (
  <div className="rounded-xl border border-neutral-600/40 bg-neutral-600/10 px-4 py-3 text-sm">
    <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
    <p className={clsx('mt-1 text-lg font-semibold', accent)}>{value}</p>
  </div>
);

const AIInsight = ({ prediction, stats, meta }) => {
  if (!prediction) {
    return null;
  }

  const style = actionStyles[prediction.action] || actionStyles.HOLD;
  const isFallback = meta?.sourceType === 'heuristic' || meta?.fallbackUsed;
  const sourceLabel = isFallback
    ? 'Heuristic Fallback'
    : meta?.sourceType === 'cache'
    ? 'Cached Signal'
    : 'Gemini 2.0 Flash';
  const reusedLabel = meta?.reused ? ' (cached)' : '';

  return (
    <motion.div
      className={clsx(
        'rounded-3xl border p-6 shadow-glow backdrop-blur',
        style.bg,
        'border-neutral-600/40'
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-300">Quantora Signal</p>
          <div className="mt-3 flex items-center gap-3 text-3xl font-bold">
            <span>{style.emoji}</span>
            <span>{prediction.action}</span>
          </div>
          <p className="mt-2 text-sm text-neutral-200">{style.subtitle}</p>
          <p
            className={clsx(
              'mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
              isFallback
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40'
            )}
          >
            {sourceLabel}
            {reusedLabel}
          </p>
        </div>
        <div className="text-right text-sm text-neutral-400">
          <p>Confidence</p>
          <p className="text-2xl font-bold text-neutral-50">
            {(prediction.confidence * 100).toFixed(1)}%
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
      <p
        className={clsx(
          'mt-6 text-sm leading-relaxed',
          isFallback ? 'text-amber-100' : 'text-neutral-200'
        )}
      >
        {prediction.reason}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric
          label="Average Price"
          value={`$${(stats?.avgPrice ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}`}
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
          accent={
            (stats?.change24h ?? 0) >= 0
              ? 'text-accent'
              : 'text-red-400'
          }
        />
      </div>
    </motion.div>
  );
};

export default AIInsight;
