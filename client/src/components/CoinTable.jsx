import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const actionBadgeStyles = {
  BUY: 'border-accent/40 bg-accent/10 text-accent',
  HOLD: 'border-gold/40 bg-gold/10 text-gold',
  SELL: 'border-red-500/40 bg-red-500/10 text-red-400',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

const formatPercent = (value) =>
  `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const CoinTable = memo(({ markets = [], alertPreferences = {}, onToggleAlert }) => {
  if (!markets.length) {
    return (
      <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-8 text-center text-neutral-300 shadow-glow">
        <p>No market data loaded yet. Confirm the backend is running and refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-600/30 bg-neutral-600/10 shadow-glow">
      <table className="min-w-full divide-y divide-neutral-600/30">
        <thead className="bg-neutral-600/20 text-xs uppercase tracking-wide text-neutral-300">
          <tr>
            <th className="px-6 py-4 text-left">Coin</th>
            <th className="px-6 py-4 text-right">Price</th>
            <th className="px-6 py-4 text-right">24h</th>
            <th className="px-6 py-4 text-center">AI Action</th>
            <th className="px-6 py-4 text-center">Confidence</th>
            <th className="px-6 py-4 text-center">Alerts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-600/20">
          {markets.map((coin, index) => {
            const displayAction = coin.aiAction || 'HOLD';
            const confidence = coin.aiConfidence ?? 0;
            const pref = alertPreferences[coin.id] ?? true;
            return (
              <motion.tr
                key={coin.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="hover:bg-neutral-600/10"
              >
                <td className="px-6 py-4 text-sm">
                  <NavLink
                    to={`/coin/${coin.id}`}
                    className="flex items-center gap-3 font-medium text-neutral-100 hover:text-accent"
                  >
                    <span className="text-lg">{coin.symbol.toUpperCase()}</span>
                    <span className="text-xs uppercase tracking-wide text-neutral-400">{coin.name}</span>
                  </NavLink>
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-neutral-100">
                  {formatCurrency(coin.current_price)}
                </td>
                <td
                  className={clsx(
                    'px-6 py-4 text-right text-sm font-semibold',
                    coin.price_change_percentage_24h >= 0 ? 'text-accent' : 'text-red-400'
                  )}
                >
                  {formatPercent(coin.price_change_percentage_24h)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                      actionBadgeStyles[displayAction] || 'border-neutral-500 bg-neutral-600/20 text-neutral-200'
                    )}
                  >
                    {displayAction}
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-sm text-neutral-200">
                  {(confidence * 100).toFixed(1)}%
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleAlert?.(coin.id, !pref)}
                    className={clsx(
                      'rounded-full px-4 py-2 text-xs font-semibold transition',
                      pref
                        ? 'border border-accent/50 bg-accent/20 text-accent'
                        : 'border border-neutral-600/60 bg-neutral-600/20 text-neutral-300 hover:text-accent'
                    )}
                  >
                    {pref ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

CoinTable.displayName = 'CoinTable';

export default CoinTable;
