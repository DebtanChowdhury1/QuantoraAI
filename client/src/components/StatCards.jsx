import clsx from 'clsx';

const cards = [
  {
    key: 'marketCap',
    label: 'Total Market Cap',
    accent: 'text-accent',
    formatter: (markets) =>
      `$${markets
        .slice(0, 50)
        .reduce((acc, item) => acc + item.market_cap, 0)
        .toLocaleString()}`,
  },
  {
    key: 'volume',
    label: '24h Volume',
    accent: 'text-gold',
    formatter: (markets) =>
      `$${markets
        .slice(0, 50)
        .reduce((acc, item) => acc + item.total_volume, 0)
        .toLocaleString()}`,
  },
  {
    key: 'dominance',
    label: 'BTC Dominance',
    accent: 'text-neutral-100',
    formatter: (markets) => {
      const totalCap = markets.slice(0, 50).reduce((acc, item) => acc + item.market_cap, 0);
      const btc = markets.find((item) => item.id === 'bitcoin')?.market_cap ?? 0;
      if (!totalCap) return '—';
      return `${((btc / totalCap) * 100).toFixed(2)}%`;
    },
  },
];

const StatCards = ({ markets = [] }) => (
  <div className="grid gap-4 md:grid-cols-3">
    {cards.map((card) => (
      <div
        key={card.key}
        className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{card.label}</p>
        <p className={clsx('mt-4 text-2xl font-semibold', card.accent)}>
          {card.formatter(markets || [])}
        </p>
      </div>
    ))}
  </div>
);

export default StatCards;
