import { useCurrency } from '@/context/CurrencyContext';
import { formatCurrency } from '@/lib/formatters';

const CurrencySelector = () => {
  const { currency, setCurrency, supported, rates, fx, fxQuery } = useCurrency();

  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950/70 px-3 py-2">
      <span className="hidden text-[10px] uppercase tracking-wide text-neutral-500 sm:inline">
        Quote
      </span>
      <select
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        className="bg-transparent text-xs font-semibold text-neutral-100 outline-none"
        aria-label="Display currency"
      >
        {supported.map((item) => (
          <option key={item} value={item} className="bg-neutral-950 text-neutral-100">
            {item}
          </option>
        ))}
      </select>
      <span className="hidden text-[10px] text-neutral-500 lg:inline">
        1 USD = {formatCurrency(rates[currency] || 1, { currency, maximumFractionDigits: 4 })}
      </span>
      {fxQuery.isFetching && <span className="h-2 w-2 rounded-full bg-accent shadow-glow" />}
      {fx?.fallback && <span className="text-[10px] uppercase text-gold">FX fallback</span>}
    </div>
  );
};

export default CurrencySelector;
