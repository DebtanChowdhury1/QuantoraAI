import clsx from 'clsx';

const actionFilters = ['ALL', 'BUY', 'HOLD', 'SELL'];
const riskFilters = ['ALL', 'LOW', 'MEDIUM', 'HIGH'];

const MarketControls = ({
  query,
  onQueryChange,
  actionFilter,
  onActionFilterChange,
  riskFilter,
  onRiskFilterChange,
  searchResults = [],
  searching,
  onSelectCoin,
}) => (
  <section className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-5 shadow-glow backdrop-blur">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
      <div className="relative">
        <label className="text-xs uppercase tracking-[0.24em] text-neutral-400" htmlFor="coin-search">
          Search any coin
        </label>
        <input
          id="coin-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && searchResults[0]) {
              onSelectCoin(searchResults[0].id);
            }
          }}
          placeholder="Search Bitcoin, ETH, Solana, XRP..."
          className="mt-2 w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
        />
        {(searching || searchResults.length > 0) && (
          <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-2 shadow-2xl">
            {searching && (
              <p className="px-3 py-2 text-sm text-neutral-400">Searching market directory...</p>
            )}
            {!searching &&
              searchResults.slice(0, 8).map((coin) => (
                <button
                  key={coin.id}
                  type="button"
                  onClick={() => onSelectCoin(coin.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-neutral-800"
                >
                  {coin.thumb ? (
                    <img src={coin.thumb} alt="" className="h-7 w-7 rounded-full" loading="lazy" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                      {coin.symbol?.slice(0, 2)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-neutral-100">{coin.name}</span>
                    <span className="block text-xs uppercase tracking-wide text-neutral-500">
                      {coin.symbol} · {coin.id}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Signal</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actionFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onActionFilterChange(item)}
              className={clsx(
                'rounded-full border px-3 py-2 text-xs font-semibold transition',
                actionFilter === item
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-accent/40'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Risk</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {riskFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRiskFilterChange(item)}
              className={clsx(
                'rounded-full border px-3 py-2 text-xs font-semibold transition',
                riskFilter === item
                  ? 'border-gold/60 bg-gold/15 text-gold'
                  : 'border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-gold/40'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default MarketControls;
