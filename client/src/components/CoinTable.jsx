import { memo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useCurrency } from '@/context/CurrencyContext';
import { formatConfidencePercent, formatUsdAsCurrency } from '@/lib/formatters';

const actionBadgeStyles = {
  BUY: 'border-accent/40 bg-accent/10 text-accent',
  HOLD: 'border-gold/40 bg-gold/10 text-gold',
  SELL: 'border-red-500/40 bg-red-500/10 text-red-400',
};

const riskStyles = {
  LOW: 'text-accent',
  MEDIUM: 'text-gold',
  HIGH: 'text-red-400',
};

const formatPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

const CoinIdentity = ({ coin }) => (
  <NavLink to={`/coin/${coin.id}`} className="flex min-w-0 items-center gap-3 font-medium">
    {coin.image ? (
      <img src={coin.image} alt="" className="h-9 w-9 flex-none rounded-full bg-neutral-800" loading="lazy" />
    ) : (
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
        {coin.symbol?.slice(0, 2).toUpperCase()}
      </span>
    )}
    <span className="min-w-0">
      <span className="block truncate text-sm text-neutral-100 hover:text-accent">{coin.name}</span>
      <span className="block text-xs uppercase tracking-wide text-neutral-400">{coin.symbol}</span>
    </span>
  </NavLink>
);

const CoinTable = memo(
  ({
    markets = [],
    totalMarkets = 0,
    onResetFilters,
  }) => {
    const { currency, rate } = useCurrency();
    const navigate = useNavigate();

    if (!markets.length) {
      const hasLoadedData = totalMarkets > 0;
      return (
        <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-8 text-center text-neutral-300 shadow-glow">
          <p className="text-lg font-semibold text-neutral-100">
            {hasLoadedData ? 'No coins match this filter.' : 'No market data loaded yet.'}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            {hasLoadedData
              ? 'Try a different risk/action filter or clear the current filters.'
              : 'Quantora is waiting for market data from the backend.'}
          </p>
          {hasLoadedData && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-4 rounded-full border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15"
            >
              Reset filters
            </button>
          )}
        </div>
      );
    }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-600/30 bg-neutral-900/70 shadow-glow backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] divide-y divide-neutral-600/30">
          <thead className="bg-neutral-800/70 text-xs uppercase tracking-wide text-neutral-300">
            <tr>
              <th className="px-5 py-4 text-left">Coin</th>
              <th className="px-5 py-4 text-right">Price</th>
              <th className="px-5 py-4 text-right">24h</th>
              <th className="px-5 py-4 text-center">AI Action</th>
              <th className="px-5 py-4 text-center">Confidence</th>
              <th className="px-5 py-4 text-center">Trend</th>
              <th className="px-5 py-4 text-center">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-600/20">
            {markets.map((coin) => {
              const displayAction = coin.aiAction || 'HOLD';
              const confidence = Number(coin.aiConfidence ?? 0);
              return (
                <tr
                  key={coin.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/coin/${coin.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/coin/${coin.id}`);
                    }
                  }}
                  className="cursor-pointer hover:bg-neutral-800/60"
                >
                  <td className="px-5 py-4"><CoinIdentity coin={coin} /></td>
                  <td className="px-5 py-4 text-right text-sm font-semibold text-neutral-100">
                    {formatUsdAsCurrency(coin.current_price, { currency, rate })}
                  </td>
                  <td
                    className={clsx(
                      'px-5 py-4 text-right text-sm font-semibold',
                      Number(coin.price_change_percentage_24h) >= 0 ? 'text-accent' : 'text-red-400'
                    )}
                  >
                    {formatPercent(coin.price_change_percentage_24h)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={clsx(
                        'inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-xs font-semibold',
                        actionBadgeStyles[displayAction] || 'border-neutral-500 bg-neutral-600/20 text-neutral-200'
                      )}
                    >
                      {displayAction}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm text-neutral-200">
                    {formatConfidencePercent(confidence)}
                  </td>
                  <td className="px-5 py-4 text-center text-xs font-semibold text-neutral-300">
                    {coin.aiTrendDirection || 'SIDEWAYS'}
                  </td>
                  <td className={clsx('px-5 py-4 text-center text-xs font-semibold', riskStyles[coin.aiRiskLevel] || 'text-neutral-300')}>
                    {coin.aiRiskLevel || 'MEDIUM'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
  }
);

CoinTable.displayName = 'CoinTable';

export default CoinTable;
