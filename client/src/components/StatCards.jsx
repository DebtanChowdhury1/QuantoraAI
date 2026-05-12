import clsx from 'clsx';
import { useCurrency } from '@/context/CurrencyContext';

const formatCompactCurrency = (value, currency, rate) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(numeric * rate);
};

const cards = [
  {
    key: 'marketCap',
    label: 'Total Market Cap',
    accent: 'text-accent',
    formatter: (markets, meta, currency, rate) =>
      formatCompactCurrency(
        meta?.global?.totalMarketCap ??
          markets.reduce((acc, item) => acc + (Number(item.market_cap) || 0), 0),
        currency,
        rate
      ),
  },
  {
    key: 'volume',
    label: '24h Volume',
    accent: 'text-gold',
    formatter: (markets, meta, currency, rate) =>
      formatCompactCurrency(
        meta?.global?.totalVolume ??
          markets.reduce((acc, item) => acc + (Number(item.total_volume) || 0), 0),
        currency,
        rate
      ),
  },
  {
    key: 'dominance',
    label: 'BTC Dominance',
    accent: 'text-neutral-100',
    formatter: (markets, meta) => {
      const exactDominance = meta?.global?.btcDominance;
      if (Number.isFinite(Number(exactDominance))) return `${Number(exactDominance).toFixed(2)}%`;
      const totalCap = markets.reduce((acc, item) => acc + (Number(item.market_cap) || 0), 0);
      const btc = Number(markets.find((item) => item.id === 'bitcoin')?.market_cap ?? 0);
      if (!totalCap) return 'N/A';
      return `${((btc / totalCap) * 100).toFixed(2)}%`;
    },
  },
];

const StatCards = ({ markets = [], meta = {} }) => {
  const { currency, rate } = useCurrency();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">{card.label}</p>
          <p className={clsx('mt-4 text-2xl font-semibold', card.accent)}>
            {card.formatter(markets || [], meta, currency, rate)}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StatCards;
