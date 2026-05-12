import { memo, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useCurrency } from '@/context/CurrencyContext';
import { formatPercent, formatUsdAsCurrency } from '@/lib/formatters';

const ROW_LIMIT = 8;

const sanitizeChange = (coin) => {
  const value = Number(coin?.price_change_percentage_24h);
  return Number.isFinite(value) ? value : null;
};

const sanitizeVolume = (coin) => {
  const value = Number(coin?.total_volume);
  return Number.isFinite(value) ? value : 0;
};

const byChangeDesc = (a, b) => (sanitizeChange(b) ?? -Infinity) - (sanitizeChange(a) ?? -Infinity);
const byChangeAsc = (a, b) => (sanitizeChange(a) ?? Infinity) - (sanitizeChange(b) ?? Infinity);
const byVolumeDesc = (a, b) => sanitizeVolume(b) - sanitizeVolume(a);

const getHotCoins = (markets) =>
  [...markets]
    .filter((coin) => Number.isFinite(Number(coin.current_price)))
    .sort((a, b) => {
      const rankA = Number(a.market_cap_rank) || 9999;
      const rankB = Number(b.market_cap_rank) || 9999;
      if (rankA !== rankB) return rankA - rankB;
      return byVolumeDesc(a, b);
    })
    .slice(0, ROW_LIMIT);

const getTopGainers = (markets) =>
  [...markets]
    .filter((coin) => Number.isFinite(sanitizeChange(coin)) && sanitizeChange(coin) > 0)
    .sort(byChangeDesc)
    .slice(0, ROW_LIMIT);

const getTopLosers = (markets) =>
  [...markets]
    .filter((coin) => Number.isFinite(sanitizeChange(coin)) && sanitizeChange(coin) < 0)
    .sort(byChangeAsc)
    .slice(0, ROW_LIMIT);

const getTopVolume = (markets) =>
  [...markets]
    .filter((coin) => sanitizeVolume(coin) > 0)
    .sort(byVolumeDesc)
    .slice(0, ROW_LIMIT);

const MarketMovers = memo(({ markets = [] }) => {
  const { currency, rate } = useCurrency();

  const groups = useMemo(
    () => [
      { title: 'Hot Coins', rows: getHotCoins(markets) },
      { title: 'Top Gainers', rows: getTopGainers(markets) },
      { title: 'Top Losers', rows: getTopLosers(markets) },
      { title: 'Top Volume', rows: getTopVolume(markets) },
    ],
    [markets]
  );

  if (!markets.length) return null;

  return (
    <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
      {groups.map((group) => (
        <div
          key={group.title}
          className="overflow-hidden rounded-2xl border border-neutral-600/40 bg-neutral-900/75 shadow-glow backdrop-blur"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-100">{group.title}</h2>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-100"
              aria-label={`${group.title} market category`}
            >
              Crypto
              <span className="text-neutral-400" aria-hidden="true">v</span>
            </button>
          </div>

          <div className="px-5 pb-4">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] gap-3 border-b border-neutral-700/50 pb-2 text-[11px] text-neutral-500">
              <span />
              <span>Name</span>
              <span className="text-right">Price</span>
              <span className="text-right">24h Change</span>
            </div>

            <div className="divide-y divide-neutral-800/70">
              {group.rows.map((coin, index) => {
                const change = sanitizeChange(coin);
                return (
                  <NavLink
                    key={`${group.title}-${coin.id}`}
                    to={`/coin/${coin.id}`}
                    className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-3 py-3 text-left transition hover:bg-neutral-800/50"
                  >
                    <span className="text-xs tabular-nums text-neutral-500">{index + 1}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      {coin.image ? (
                        <img
                          src={coin.image}
                          alt=""
                          className="h-6 w-6 rounded-full bg-neutral-800"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                          {coin.symbol?.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold uppercase text-neutral-100">
                        {coin.symbol || coin.name}
                      </span>
                    </span>
                    <span className="text-right text-sm font-semibold text-neutral-100">
                      {formatUsdAsCurrency(coin.current_price, { currency, rate })}
                    </span>
                    <span
                      className={clsx(
                        'text-right text-sm font-semibold tabular-nums',
                        Number(change) >= 0 ? 'text-accent' : 'text-red-400'
                      )}
                    >
                      {formatPercent(change, 2)}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
});

MarketMovers.displayName = 'MarketMovers';

export default MarketMovers;
