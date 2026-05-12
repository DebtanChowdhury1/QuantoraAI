import { createContext, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFxRates } from '@/lib/api';
import { MARKET_REFRESH_MS } from '@/lib/refreshIntervals';

const CurrencyContext = createContext(null);

const storageKey = 'quantora-display-currency';

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState(() => {
    const saved = window.localStorage.getItem(storageKey);
    return saved || 'USD';
  });

  const fxQuery = useQuery({
    queryKey: ['fx-rates'],
    queryFn: fetchFxRates,
    refetchInterval: MARKET_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const fx = fxQuery.data?.data;
  const rates = useMemo(() => fx?.rates || { USD: 1 }, [fx?.rates]);
  const supported = useMemo(() => fx?.supported || Object.keys(rates), [fx?.supported, rates]);
  const selectedCurrency = supported.includes(currency) ? currency : 'USD';
  const rate = Number(rates[selectedCurrency]) || 1;

  const setCurrency = (nextCurrency) => {
    setCurrencyState(nextCurrency);
    window.localStorage.setItem(storageKey, nextCurrency);
  };

  const value = useMemo(
    () => ({
      currency: selectedCurrency,
      setCurrency,
      rate,
      rates,
      supported,
      fx,
      fxQuery,
      convert: (usdValue) => {
        const numeric = Number(usdValue);
        return Number.isFinite(numeric) ? numeric * rate : null;
      },
    }),
    [selectedCurrency, rate, rates, supported, fx, fxQuery]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used inside CurrencyProvider');
  }
  return context;
};
