import clsx from 'clsx';
import { useCurrency } from '@/context/CurrencyContext';
import { formatConfidencePercent, formatUsdAsCurrency } from '@/lib/formatters';

const actionText = {
  BUY: 'text-accent',
  HOLD: 'text-gold',
  SELL: 'text-red-400',
};

const computeSignalAlignment = (history = []) => {
  const windowSize = Math.min(history.length, 20);
  const window = history.slice(0, windowSize);
  let correct = 0;
  let evaluated = 0;

  window.forEach((item) => {
    if (typeof item.change24h !== 'number') {
      return;
    }
    evaluated += 1;
    const trend = item.change24h;
    if (item.action === 'BUY' && trend > 0) {
      correct += 1;
    } else if (item.action === 'SELL' && trend < 0) {
      correct += 1;
    } else if (item.action === 'HOLD' && Math.abs(trend) < 1) {
      correct += 1;
    }
  });

  if (!evaluated) {
    return { score: 0, samples: 0, windowSize };
  }
  return {
    score: Math.round((correct / evaluated) * 100),
    samples: evaluated,
    windowSize,
  };
};

const PredictionHistoryList = ({ history = [], errorMessage }) => {
  const { currency, rate } = useCurrency();
  const { score, samples, windowSize } = computeSignalAlignment(history);

  return (
    <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
      <h3 className="text-lg font-semibold text-neutral-100">Signal History</h3>
      <p className="text-sm text-neutral-400">
        Historical Quantora AI signals generated for this coin
      </p>

      {errorMessage && (
        <p className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-200">
          {errorMessage}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-neutral-600/30 bg-neutral-950/40 px-4 py-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-400">
            Signal alignment (last {windowSize} signals)
          </p>
          <p className="mt-1 text-2xl font-semibold text-accent">
            {samples ? `${score}%` : 'N/A'}
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          Measures whether each signal matched the market state at generation time.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {history.slice(0, 12).map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-600/30 bg-neutral-950/40 px-4 py-3 text-sm"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className={clsx('font-semibold', actionText[item.action] || 'text-neutral-100')}>
                  {item.action}
                </p>
                <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                  {item.trendDirection || 'SIDEWAYS'}
                </span>
                <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                  {item.riskLevel || 'MEDIUM'} risk
                </span>
              </div>
              <p className="text-xs text-neutral-400">{item.reason}</p>
              <p className="mt-2 text-xs text-neutral-500">
                Price {formatUsdAsCurrency(item.marketPrice || 0, { currency, rate })}{' '}
                | 24h {Number(item.change24h || 0).toFixed(2)}% | Volatility{' '}
                {Number(item.volatility || 0).toFixed(2)}%
              </p>
            </div>
            <div className="text-right text-xs text-neutral-400">
              <p>
                {new Date(item.createdAt).toLocaleString('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <p className="text-neutral-500">
                Confidence {formatConfidencePercent(item.confidence)}
              </p>
            </div>
          </div>
        ))}
        {!history.length && (
          <p className="text-sm text-neutral-400">
            No signals yet. Background engine warming up.
          </p>
        )}
      </div>
    </div>
  );
};

export default PredictionHistoryList;
