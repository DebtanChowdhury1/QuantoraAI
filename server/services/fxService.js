import axios from 'axios';
import InMemoryCache from '../utils/cache.js';

const cache = new InMemoryCache();
const FX_TTL_MS = 2 * 1000;
const STALE_TTL_MS = 30 * 60 * 1000;

const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'PKR',
  'BDT',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
];

const fallbackRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  AED: 3.6725,
  PKR: 278,
  BDT: 117,
  JPY: 155,
  CAD: 1.37,
  AUD: 1.52,
  SGD: 1.35,
};

const normalizeRates = (rates = {}) =>
  SUPPORTED_CURRENCIES.reduce((acc, currency) => {
    const value = Number(rates[currency]);
    acc[currency] = Number.isFinite(value) && value > 0 ? value : fallbackRates[currency];
    return acc;
  }, {});

const fetchOpenExchangeRates = async () => {
  const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 });
  if (data?.result !== 'success' || !data?.rates) {
    throw new Error('FX provider returned invalid payload');
  }
  return {
    base: 'USD',
    rates: normalizeRates(data.rates),
    source: 'open.er-api.com',
    fetchedAt: new Date().toISOString(),
    fallback: false,
  };
};

const fetchFrankfurterRates = async () => {
  const symbols = SUPPORTED_CURRENCIES.filter((currency) => currency !== 'USD').join(',');
  const { data } = await axios.get('https://api.frankfurter.app/latest', {
    params: { from: 'USD', to: symbols },
    timeout: 8000,
  });
  if (!data?.rates) {
    throw new Error('Secondary FX provider returned invalid payload');
  }
  return {
    base: 'USD',
    rates: normalizeRates({ USD: 1, ...data.rates }),
    source: 'frankfurter.app',
    fetchedAt: new Date().toISOString(),
    fallback: false,
  };
};

export const getFxRates = async () => {
  const cached = cache.get('fx-rates');
  if (cached) return cached;

  const providers = [fetchOpenExchangeRates, fetchFrankfurterRates];
  const errors = [];

  for (const provider of providers) {
    try {
      const payload = await provider();
      cache.set('fx-rates', payload, FX_TTL_MS);
      cache.set('fx-rates-stale', payload, STALE_TTL_MS);
      return payload;
    } catch (error) {
      errors.push(error?.message || 'Unknown FX error');
    }
  }

  const stale = cache.get('fx-rates-stale', { allowStale: true });
  if (stale) {
    const payload = { ...stale, fallback: true, stale: true, errors };
    cache.set('fx-rates', payload, FX_TTL_MS);
    return payload;
  }

  const payload = {
    base: 'USD',
    rates: fallbackRates,
    source: 'static-emergency-fallback',
    fetchedAt: new Date().toISOString(),
    fallback: true,
    stale: true,
    errors,
  };
  cache.set('fx-rates', payload, FX_TTL_MS);
  return payload;
};

export const getSupportedFxCurrencies = () => SUPPORTED_CURRENCIES;
