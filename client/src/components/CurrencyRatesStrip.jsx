import { useCurrency } from '@/context/CurrencyContext';
import { formatCurrency } from '@/lib/formatters';

const visibleCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'JPY', 'CAD', 'AUD'];

const CurrencyRatesStrip = () => {
  const { rates, supported, fx, fxQuery } = useCurrency();
  const currencies = visibleCurrencies.filter((currency) => supported.includes(currency));

  return (
    <section className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-5 shadow-glow backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Live FX Conversion</p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-100">1 USD across currencies</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {fxQuery.isFetching && <span className="h-2 w-2 rounded-full bg-accent shadow-glow" />}
          <span>{fx?.fallback ? 'Protected FX rates' : 'Live FX rates'}</span>
          {fx?.fallback && <span className="font-semibold uppercase text-gold">fallback</span>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {currencies.map((currency) => (
          <div key={currency} className="rounded-xl border border-neutral-700/50 bg-neutral-950/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">{currency}</p>
            <p className="mt-1 text-sm font-semibold text-neutral-100">
              {formatCurrency(rates[currency] || 1, {
                currency,
                minimumFractionDigits: currency === 'JPY' ? 0 : 2,
                maximumFractionDigits: currency === 'JPY' ? 0 : 4,
              })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CurrencyRatesStrip;
