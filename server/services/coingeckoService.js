import axios from 'axios';
import dotenv from 'dotenv';
import InMemoryCache from '../utils/cache.js';
import { config, minutesToMs } from '../utils/limits.js';

dotenv.config({ path: '.env.local' });

const cache = new InMemoryCache();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestTime = 0;
const minDelayMs = config.coingeckoRequestDelayMs || 0;

const buildUrl = (path) => {
  const base = process.env.COINGECKO_API || 'https://api.coingecko.com';
  return `${base}/api/v3/${path}`;
};

const buildUrlWithParams = (path, params = {}) => {
  const url = new URL(buildUrl(path));
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    const normalizedValue = Array.isArray(value) ? value.join(',') : value;
    url.searchParams.append(key, normalizedValue);
  });
  return url.toString();
};

const resolveCacheKey = (path, params, cacheKey) => {
  if (cacheKey) {
    return cacheKey;
  }
  if (!params) {
    return path;
  }
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
};

const fetchFromCoinGecko = async (path, { params, errorMessage, cacheKey, ttlMs, retries } = {}) => {
  const url = params ? buildUrlWithParams(path, params) : buildUrl(path);
  const resolvedCacheKey = resolveCacheKey(path, params, cacheKey) || url;
  const freshCached = cache.get(resolvedCacheKey);
  if (freshCached) {
    return freshCached;
  }

  const attempts = Math.max(0, retries ?? config.coingeckoRetryAttempts);
  let lastError;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    if (minDelayMs > 0) {
      const elapsed = Date.now() - lastRequestTime;
      if (elapsed < minDelayMs) {
        await sleep(minDelayMs - elapsed);
      }
    }
    console.log(`[CoinGecko] GET ${url} (attempt ${attempt + 1}/${attempts + 1})`);
    try {
      const { data } = await axios.get(url);
      cache.set(resolvedCacheKey, data, ttlMs);
      lastRequestTime = Date.now();
      return data;
    } catch (error) {
      lastRequestTime = Date.now();
      lastError = error;
      const status = error?.response?.status;
      const message = error?.response?.data?.error || error.message;
      console.error(`[CoinGecko] Error (${status || 'NO_STATUS'}): ${message}`);

      const cachedFallback = cache.get(resolvedCacheKey, { allowStale: true });
      if ((status === 429 || status === 503) && attempt < attempts) {
        const retryAfterHeader = error?.response?.headers?.['retry-after'];
        const retryAfter = retryAfterHeader ? Number.parseFloat(retryAfterHeader) * 1000 : null;
        const baseDelay = config.coingeckoRetryDelayMs || 10000;
        const waitMs = retryAfter && Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : baseDelay * (attempt + 1);
        console.warn(`[CoinGecko] Hit rate limit. Retrying in ${waitMs} ms.`);
        await sleep(waitMs);
        continue;
      }

      if (cachedFallback) {
        console.warn(`[CoinGecko] Using cached fallback for ${resolvedCacheKey}`);
        return cachedFallback;
      }
      break;
    }
  }

  throw new Error(errorMessage ?? lastError?.message ?? 'CoinGecko request failed');
};

export const pingAPI = async () =>
  fetchFromCoinGecko('ping', { errorMessage: 'Failed to reach CoinGecko API' });

export const getSupportedCurrencies = async () =>
  fetchFromCoinGecko('simple/supported_vs_currencies', {
    errorMessage: 'Failed to fetch supported currencies',
  });

export const getMarketData = async () =>
  fetchFromCoinGecko('coins/markets', {
    params: {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 100,
      page: 1,
      sparkline: false,
    },
    errorMessage: 'Failed to fetch market data',
    cacheKey: 'coins/markets:usd',
    ttlMs: minutesToMs(config.marketsRefreshMin),
  });

export const getSimplePrice = async (ids = [], currencies = []) =>
  fetchFromCoinGecko('simple/price', {
    params: {
      ids: Array.isArray(ids) ? ids.join(',') : ids,
      vs_currencies: Array.isArray(currencies) ? currencies.join(',') : currencies,
    },
    errorMessage: 'Failed to fetch simple price data',
    cacheKey: `simple/price:${Array.isArray(ids) ? ids.join(',') : ids}:${Array.isArray(currencies) ? currencies.join(',') : currencies}`,
    ttlMs: minutesToMs(1),
  });

export const getCoinDetails = async (id) =>
  fetchFromCoinGecko(`coins/${encodeURIComponent(id)}`, {
    errorMessage: `Failed to fetch coin details for ${id}`,
    cacheKey: `coin:${id}:details`,
    ttlMs: minutesToMs(5),
  });

export const getMarketChart = async (id, days = 30) =>
  fetchFromCoinGecko(`coins/${encodeURIComponent(id)}/market_chart`, {
    params: {
      vs_currency: 'usd',
      days,
    },
    errorMessage: `Failed to fetch market chart for ${id}`,
    cacheKey: `coin:${id}:chart:${days}`,
    ttlMs: minutesToMs(15),
  });

export const getHistoricalData = async (id, date) =>
  fetchFromCoinGecko(`coins/${encodeURIComponent(id)}/history`, {
    params: {
      date,
    },
    errorMessage: `Failed to fetch historical data for ${id}`,
    cacheKey: `coin:${id}:history:${date}`,
    ttlMs: minutesToMs(60),
  });

export const getOHLC = async (id, days = 7) =>
  fetchFromCoinGecko(`coins/${encodeURIComponent(id)}/ohlc`, {
    params: {
      vs_currency: 'usd',
      days,
    },
    errorMessage: `Failed to fetch OHLC data for ${id}`,
    cacheKey: `coin:${id}:ohlc:${days}`,
    ttlMs: minutesToMs(15),
  });

export const getGlobalStats = async () =>
  fetchFromCoinGecko('global', {
    errorMessage: 'Failed to fetch global stats',
    cacheKey: 'global:stats',
    ttlMs: minutesToMs(5),
  });

export const getDefiStats = async () =>
  fetchFromCoinGecko('global/decentralized_finance_defi', {
    errorMessage: 'Failed to fetch DeFi stats',
    cacheKey: 'global:defi',
    ttlMs: minutesToMs(5),
  });

export const getCategories = async () =>
  fetchFromCoinGecko('coins/categories', {
    errorMessage: 'Failed to fetch coin categories',
    cacheKey: 'coins:categories',
    ttlMs: minutesToMs(10),
  });

export const searchCoins = async (query) =>
  fetchFromCoinGecko('search', {
    params: { query },
    errorMessage: `Failed to search coins with query "${query}"`,
    cacheKey: `search:${query}`,
    ttlMs: minutesToMs(1),
  });

export const getTrendingCoins = async () =>
  fetchFromCoinGecko('search/trending', {
    errorMessage: 'Failed to fetch trending coins',
    cacheKey: 'search:trending',
    ttlMs: minutesToMs(5),
  });

export const getExchanges = async () =>
  fetchFromCoinGecko('exchanges', {
    errorMessage: 'Failed to fetch exchanges',
    cacheKey: 'exchanges:list',
    ttlMs: minutesToMs(10),
  });

export const getExchangeById = async (id) =>
  fetchFromCoinGecko(`exchanges/${encodeURIComponent(id)}`, {
    errorMessage: `Failed to fetch exchange ${id}`,
    cacheKey: `exchange:${id}`,
    ttlMs: minutesToMs(10),
  });

export const getExchangeVolume = async (id, days = 7) =>
  fetchFromCoinGecko(`exchanges/${encodeURIComponent(id)}/volume_chart`, {
    params: { days },
    errorMessage: `Failed to fetch exchange volume chart for ${id}`,
    cacheKey: `exchange:${id}:volume:${days}`,
    ttlMs: minutesToMs(10),
  });

export const getDerivatives = async () =>
  fetchFromCoinGecko('derivatives', {
    errorMessage: 'Failed to fetch derivatives',
    cacheKey: 'derivatives:list',
    ttlMs: minutesToMs(5),
  });

export const getDerivativeExchanges = async () =>
  fetchFromCoinGecko('derivatives/exchanges', {
    errorMessage: 'Failed to fetch derivative exchanges',
    cacheKey: 'derivatives:exchanges',
    ttlMs: minutesToMs(10),
  });

export const getStatusUpdates = async () =>
  fetchFromCoinGecko('status_updates', {
    errorMessage: 'Failed to fetch status updates',
    cacheKey: 'status_updates',
    ttlMs: minutesToMs(5),
  });

export { buildUrl };



