import axios from 'axios';
import Price from '../models/Price.js';
import { config } from '../utils/limits.js';

const fallbackNameFor = (coinId) => {
  if (!coinId) {
    return 'Unknown';
  }
  return coinId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const fallbackSymbolFor = (coinId) => {
  if (!coinId) {
    return 'UNK';
  }
  const cleaned = coinId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (cleaned.length >= 3) {
    return cleaned.slice(0, Math.min(5, cleaned.length));
  }
  const base = (cleaned || coinId.slice(0, 3).toUpperCase() || 'UNK').padEnd(3, 'X');
  return base.slice(0, 3);
};

const CACHE_TTL_MS = Math.max(1, config.marketDataCacheSeconds) * 1000;
const VOLATILITY_WINDOW_DAYS = 7;
const HISTORY_POINTS = VOLATILITY_WINDOW_DAYS + 1;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const COINGECKO_MIN_DELAY_MS = 7000;
const MAX_HISTORY_POINTS = VOLATILITY_WINDOW_DAYS * 24;
export const BINANCE_SYMBOLS = {
  bitcoin: { pair: 'BTCUSDT', symbol: 'BTC', name: 'Bitcoin' },
  ethereum: { pair: 'ETHUSDT', symbol: 'ETH', name: 'Ethereum' },
  binancecoin: { pair: 'BNBUSDT', symbol: 'BNB', name: 'BNB' },
  solana: { pair: 'SOLUSDT', symbol: 'SOL', name: 'Solana' },
  dogecoin: { pair: 'DOGEUSDT', symbol: 'DOGE', name: 'Dogecoin' },
  cardano: { pair: 'ADAUSDT', symbol: 'ADA', name: 'Cardano' },
  ripple: { pair: 'XRPUSDT', symbol: 'XRP', name: 'XRP' },
  xrp: { pair: 'XRPUSDT', symbol: 'XRP', name: 'XRP' },
  polkadot: { pair: 'DOTUSDT', symbol: 'DOT', name: 'Polkadot' },
  chainlink: { pair: 'LINKUSDT', symbol: 'LINK', name: 'Chainlink' },
  litecoin: { pair: 'LTCUSDT', symbol: 'LTC', name: 'Litecoin' },
  tron: { pair: 'TRXUSDT', symbol: 'TRX', name: 'TRON' },
  avalanche: { pair: 'AVAXUSDT', symbol: 'AVAX', name: 'Avalanche' },
  'avalanche-2': { pair: 'AVAXUSDT', symbol: 'AVAX', name: 'Avalanche' },
  'bitcoin-cash': { pair: 'BCHUSDT', symbol: 'BCH', name: 'Bitcoin Cash' },
  stellar: { pair: 'XLMUSDT', symbol: 'XLM', name: 'Stellar' },
  near: { pair: 'NEARUSDT', symbol: 'NEAR', name: 'NEAR Protocol' },
  uniswap: { pair: 'UNIUSDT', symbol: 'UNI', name: 'Uniswap' },
  aptos: { pair: 'APTUSDT', symbol: 'APT', name: 'Aptos' },
  arbitrum: { pair: 'ARBUSDT', symbol: 'ARB', name: 'Arbitrum' },
  optimism: { pair: 'OPUSDT', symbol: 'OP', name: 'Optimism' },
  'shiba-inu': { pair: 'SHIBUSDT', symbol: 'SHIB', name: 'Shiba Inu' },
  sui: { pair: 'SUIUSDT', symbol: 'SUI', name: 'Sui' },
  hedera: { pair: 'HBARUSDT', symbol: 'HBAR', name: 'Hedera' },
  'the-open-network': { pair: 'TONUSDT', symbol: 'TON', name: 'Toncoin' },
  pepe: { pair: 'PEPEUSDT', symbol: 'PEPE', name: 'Pepe' },
  'internet-computer': { pair: 'ICPUSDT', symbol: 'ICP', name: 'Internet Computer' },
  filecoin: { pair: 'FILUSDT', symbol: 'FIL', name: 'Filecoin' },
  'render-token': { pair: 'RENDERUSDT', symbol: 'RENDER', name: 'Render' },
  cosmos: { pair: 'ATOMUSDT', symbol: 'ATOM', name: 'Cosmos' },
  'injective-protocol': { pair: 'INJUSDT', symbol: 'INJ', name: 'Injective' },
  aave: { pair: 'AAVEUSDT', symbol: 'AAVE', name: 'Aave' },
  maker: { pair: 'MKRUSDT', symbol: 'MKR', name: 'Maker' },
  'lido-dao': { pair: 'LDOUSDT', symbol: 'LDO', name: 'Lido DAO' },
  'ethereum-classic': { pair: 'ETCUSDT', symbol: 'ETC', name: 'Ethereum Classic' },
  vechain: { pair: 'VETUSDT', symbol: 'VET', name: 'VeChain' },
  algorand: { pair: 'ALGOUSDT', symbol: 'ALGO', name: 'Algorand' },
  'quant-network': { pair: 'QNTUSDT', symbol: 'QNT', name: 'Quant' },
  'polygon-ecosystem-token': { pair: 'POLUSDT', symbol: 'POL', name: 'Polygon Ecosystem Token' },
  'immutable-x': { pair: 'IMXUSDT', symbol: 'IMX', name: 'Immutable' },
  'fetch-ai': { pair: 'FETUSDT', symbol: 'FET', name: 'Artificial Superintelligence Alliance' },
  celestia: { pair: 'TIAUSDT', symbol: 'TIA', name: 'Celestia' },
  'sei-network': { pair: 'SEIUSDT', symbol: 'SEI', name: 'Sei' },
  bonk: { pair: 'BONKUSDT', symbol: 'BONK', name: 'Bonk' },
  floki: { pair: 'FLOKIUSDT', symbol: 'FLOKI', name: 'FLOKI' },
};

export const fetchBinanceTickerSnapshots = async (coinIds = []) => {
  const requested = coinIds
    .map((coinId) => String(coinId || '').trim().toLowerCase())
    .filter((coinId) => BINANCE_SYMBOLS[coinId]);
  if (!requested.length) {
    return [];
  }

  const symbols = requested.map((coinId) => BINANCE_SYMBOLS[coinId].pair);
  const { data } = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
    params: {
      symbols: JSON.stringify(symbols),
    },
    timeout: 8000,
  });
  const tickers = Array.isArray(data) ? data : [];
  const byPair = new Map(tickers.map((item) => [String(item.symbol || '').toUpperCase(), item]));

  return requested
    .map((coinId) => {
      const mapping = BINANCE_SYMBOLS[coinId];
      const ticker = byPair.get(mapping.pair);
      const price = parseNumber(ticker?.lastPrice);
      if (!Number.isFinite(price)) {
        return null;
      }
      return {
        id: coinId,
        symbol: mapping.symbol,
        name: mapping.name,
        image: null,
        current_price: formatPrice(price),
        price_change_percentage_24h: roundTo(ticker?.priceChangePercent, 3),
        volatility_7d: null,
        market_cap: null,
        total_volume: parseNumber(ticker?.quoteVolume),
        last_updated: new Date().toISOString(),
        source: 'Binance live ticker',
        cached: false,
      };
    })
    .filter(Boolean);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const roundTo = (value, decimals = 2) => {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Number(numeric.toFixed(decimals));
};

const formatPrice = (value) => {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric >= 1) {
    return Number(numeric.toFixed(2));
  }
  if (numeric >= 0.01) {
    return Number(numeric.toFixed(4));
  }
  return Number(numeric.toPrecision(8));
};

const computeVolatility = (prices = []) => {
  const cleaned = prices
    .map((price) => parseNumber(price))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (cleaned.length < 2) {
    return null;
  }

  const logReturns = [];
  for (let i = 1; i < cleaned.length; i += 1) {
    const current = cleaned[i];
    const previous = cleaned[i - 1];
    if (!Number.isFinite(current) || !Number.isFinite(previous) || current <= 0 || previous <= 0) {
      continue;
    }
    logReturns.push(Math.log(current / previous));
  }

  if (!logReturns.length) {
    return null;
  }

  const mean =
    logReturns.reduce((accumulator, value) => accumulator + value, 0) / logReturns.length;
  const variance =
    logReturns.reduce((accumulator, value) => accumulator + (value - mean) ** 2, 0) /
    logReturns.length;
  const stdDev = Math.sqrt(variance);
  if (!Number.isFinite(stdDev)) {
    return null;
  }

  const volatility = stdDev * Math.sqrt(Math.min(logReturns.length, VOLATILITY_WINDOW_DAYS));
  return Number.isFinite(volatility) ? Number((volatility * 100).toFixed(2)) : null;
};

const fetchBinanceHistory = async (coinId, pair) => {
  try {
    const url = new URL('https://api.binance.com/api/v3/klines');
    url.searchParams.set('symbol', pair);
    url.searchParams.set('interval', '1h');
    url.searchParams.set('limit', MAX_HISTORY_POINTS.toString());

    const { data } = await axios.get(url.toString(), { timeout: 10000 });
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((entry) => {
        const timestamp = parseNumber(entry?.[0]);
        const close = parseNumber(entry?.[4]);
        if (!Number.isFinite(timestamp) || !Number.isFinite(close)) {
          return null;
        }
        return [timestamp, close];
      })
      .filter(Boolean);
  } catch (error) {
    console.warn(
      `[Binance] history fetch failed for ${coinId}: ${error?.message || 'Unknown error'}`
    );
    return [];
  }
};

const fetchFromBinance = async (coinId) => {
  const mapping = BINANCE_SYMBOLS[coinId];
  if (!mapping) {
    throw new Error(`No Binance USDT pair configured for ${coinId}`);
  }

  const url = new URL('https://api.binance.com/api/v3/ticker/24hr');
  url.searchParams.set('symbol', mapping.pair);
  const { data } = await axios.get(url.toString(), { timeout: 10000 });

  const price = parseNumber(data?.lastPrice);
  if (!Number.isFinite(price)) {
    throw new Error('Binance price data unavailable');
  }

  const change24h = parseNumber(data?.priceChangePercent);
  const volume24h = parseNumber(data?.quoteVolume);
  const history = await fetchBinanceHistory(coinId, mapping.pair);
  const volatility = computeVolatility(history.map(([, historyPrice]) => historyPrice));

  console.log(`[Binance] success ${coinId}`);

  return {
    price,
    change24h,
    marketCap: null,
    volume24h,
    name: mapping.name,
    symbol: mapping.symbol,
    image: null,
    volatility,
    history,
    lastUpdated: new Date().toISOString(),
    source: 'Binance',
  };
};

let coinGeckoQueue = Promise.resolve();
let nextCoinGeckoSlot = 0;

const withCoinGeckoRateLimit = (task) => {
  const runner = async () => {
    const now = Date.now();
    if (now < nextCoinGeckoSlot) {
      const waitMs = nextCoinGeckoSlot - now;
      console.log(`[CoinGecko] delayed retry: waiting ${waitMs}ms`);
      await sleep(waitMs);
    }

    try {
      const result = await task();
      return result;
    } finally {
      nextCoinGeckoSlot = Date.now() + COINGECKO_MIN_DELAY_MS;
    }
  };

  const nextTask = coinGeckoQueue.then(runner, runner);
  coinGeckoQueue = nextTask.then(
    () => undefined,
    () => undefined
  );
  return nextTask;
};

const fetchCoinPaprikaHistory = async (coinId) => {
  try {
    const now = Date.now();
    const start = new Date(now - ONE_DAY_MS * HISTORY_POINTS);
    const url = new URL(
      `https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(coinId)}/historical`
    );
    url.searchParams.set('start', start.toISOString());
    url.searchParams.set('interval', '24h');
    url.searchParams.set('limit', HISTORY_POINTS.toString());

    const { data } = await axios.get(url.toString(), { timeout: 10000 });
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((entry) => {
        const price = parseNumber(entry?.price);
        const timestamp = entry?.timestamp ? new Date(entry.timestamp).getTime() : null;
        if (!Number.isFinite(price) || !Number.isFinite(timestamp)) {
          return null;
        }
        return [timestamp, price];
      })
      .filter(Boolean);
  } catch (error) {
    console.warn(
      `[CoinPaprika] history fetch failed for ${coinId}: ${error?.message || 'Unknown error'}`
    );
    return [];
  }
};

const fetchFromCoinPaprika = async (coinId) => {
  const url = `https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(coinId)}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  const price = parseNumber(data?.quotes?.USD?.price);
  if (!Number.isFinite(price)) {
    throw new Error('CoinPaprika price data unavailable');
  }

  const change24h = parseNumber(data?.quotes?.USD?.percent_change_24h);
  const marketCap = parseNumber(data?.quotes?.USD?.market_cap);
  const volume24h = parseNumber(data?.quotes?.USD?.volume_24h);
  const name = data?.name || fallbackNameFor(coinId);
  const symbol = data?.symbol ? String(data.symbol).toUpperCase() : fallbackSymbolFor(coinId);
  const image =
    data?.logo ??
    data?.logo_32 ??
    data?.logo_64 ??
    data?.logo_128 ??
    data?.logo_256 ??
    data?.logo_512 ??
    null;
  const history = await fetchCoinPaprikaHistory(coinId);
  const volatility = computeVolatility(history.map(([, price]) => price));
  const lastUpdated = data?.last_updated ?? new Date().toISOString();

  console.log(`[CoinPaprika] success ${coinId}`);

  return {
    price,
    change24h,
    marketCap,
    volume24h,
    name,
    symbol,
    image,
    volatility,
    history,
    lastUpdated,
    source: 'CoinPaprika',
  };
};

const fetchCoinCapHistory = async (coinId) => {
  try {
    const end = Date.now();
    const start = end - ONE_DAY_MS * HISTORY_POINTS;
    const url = new URL(`https://api.coincap.io/v2/assets/${encodeURIComponent(coinId)}/history`);
    url.searchParams.set('interval', 'd1');
    url.searchParams.set('start', start.toString());
    url.searchParams.set('end', end.toString());

    const { data } = await axios.get(url.toString(), { timeout: 10000 });
    const history = Array.isArray(data?.data) ? data.data : [];
    return history
      .map((entry) => {
        const price = parseNumber(entry?.priceUsd);
        const timestamp = parseNumber(entry?.time);
        if (!Number.isFinite(price) || !Number.isFinite(timestamp)) {
          return null;
        }
        return [timestamp, price];
      })
      .filter(Boolean);
  } catch (error) {
    console.warn(
      `[CoinCap] history fetch failed for ${coinId}: ${error?.message || 'Unknown error'}`
    );
    return [];
  }
};

const fetchFromCoinCap = async (coinId) => {
  const url = `https://api.coincap.io/v2/assets/${encodeURIComponent(coinId)}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  const asset = data?.data;
  const price = parseNumber(asset?.priceUsd);
  if (!Number.isFinite(price)) {
    throw new Error('CoinCap price data unavailable');
  }

  const change24h = parseNumber(asset?.changePercent24Hr);
  const marketCap = parseNumber(asset?.marketCapUsd);
  const volume24h = parseNumber(asset?.volumeUsd24Hr);
  const name = asset?.name || fallbackNameFor(coinId);
  const symbol = asset?.symbol ? String(asset.symbol).toUpperCase() : fallbackSymbolFor(coinId);
  const history = await fetchCoinCapHistory(coinId);
  const volatility = computeVolatility(history.map(([, price]) => price));
  const timestamp = parseNumber(asset?.timestamp) ?? parseNumber(data?.timestamp);
  const lastUpdated = Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();

  console.log(`[CoinCap] success ${coinId}`);

  return {
    price,
    change24h,
    marketCap,
    volume24h,
    name,
    symbol,
    image: null,
    volatility,
    history,
    lastUpdated,
    source: 'CoinCap',
  };
};

const fetchFromCoinGecko = async (coinId) =>
  withCoinGeckoRateLimit(async () => {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}`;
    const params = {
      localization: 'false',
      tickers: 'false',
      community_data: 'false',
      developer_data: 'false',
      sparkline: 'true',
      market_data: 'true',
    };

    const { data } = await axios.get(url, { params, timeout: 12000 });
    const marketData = data?.market_data;

    const price = parseNumber(marketData?.current_price?.usd);
    if (!Number.isFinite(price)) {
      throw new Error('CoinGecko price data unavailable');
    }

    const change24h = parseNumber(marketData?.price_change_percentage_24h);
    const marketCap = parseNumber(marketData?.market_cap?.usd);
    const volume24h = parseNumber(marketData?.total_volume?.usd);
    const name = data?.name || fallbackNameFor(coinId);
    const symbol = data?.symbol ? String(data.symbol).toUpperCase() : fallbackSymbolFor(coinId);
    const image =
      data?.image?.large ||
      data?.image?.small ||
      data?.image?.thumb ||
      null;
    const sparkline = Array.isArray(marketData?.sparkline_7d?.price)
      ? marketData.sparkline_7d.price
      : [];

    const lastUpdated =
      data?.last_updated ?? marketData?.last_updated ?? new Date().toISOString();

    const lastTimestamp = (() => {
      const parsed = Date.parse(lastUpdated);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      return Date.now();
    })();
    const intervalMs =
      sparkline.length > 1
        ? (VOLATILITY_WINDOW_DAYS * ONE_DAY_MS) / (sparkline.length - 1)
        : ONE_DAY_MS;
    const history = sparkline
      .map((value, index) => {
        const pricePoint = parseNumber(value);
        if (!Number.isFinite(pricePoint)) {
          return null;
        }
        const timestamp = lastTimestamp - (sparkline.length - 1 - index) * intervalMs;
        return [timestamp, pricePoint];
      })
      .filter(Boolean);
    const volatility = computeVolatility(history.map(([, price]) => price));

    console.log(`[CoinGecko] success ${coinId}`);

    return {
      price,
      change24h,
      marketCap,
      volume24h,
      name,
      symbol,
      image,
      volatility,
      history,
      lastUpdated,
      source: 'CoinGecko',
    };
  });

const toHistoryTuples = (history = []) => {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .slice(Math.max(0, history.length - MAX_HISTORY_POINTS))
    .map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        const [timestamp, price] = entry;
        const ts = parseNumber(timestamp);
        const val = parseNumber(price);
        if (!Number.isFinite(ts) || !Number.isFinite(val)) {
          return null;
        }
        return [ts, val];
      }
      if (entry && typeof entry === 'object' && 'timestamp' in entry && 'price' in entry) {
        const ts = parseNumber(entry.timestamp);
        const val = parseNumber(entry.price);
        if (!Number.isFinite(ts) || !Number.isFinite(val)) {
          return null;
        }
        return [ts, val];
      }
      return null;
    })
    .filter(Boolean);
};

const getCachedEntry = async (coinId) => {
  try {
    const doc = await Price.findOne({ coinId });
    if (!doc) {
      return null;
    }
    const age = Date.now() - doc.updatedAt.getTime();
    if (age > CACHE_TTL_MS) {
      return null;
    }
    console.log(`[Cache] hit ${coinId}`);
    const history = Array.isArray(doc.history)
      ? doc.history.map((point) => [point.timestamp, point.price])
      : [];
    return {
      coinId: doc.coinId,
      symbol: doc.symbol,
      name: doc.name,
      image: doc.image,
      price: doc.price,
      change_24h: doc.change24h,
      volatility_7d: doc.volatility7d,
      market_cap: doc.marketCap,
      total_volume: doc.totalVolume,
      history,
      source: doc.source,
      cached: true,
      lastUpdated: (doc.lastUpdated || doc.updatedAt).toISOString(),
    };
  } catch (error) {
    console.warn(`[Cache] read failed for ${coinId}: ${error?.message || 'Unknown cache error'}`);
    return null;
  }
};

const saveToCache = async (coinId, payload) => {
  const history = toHistoryTuples(payload.history);
  const lastUpdatedDate = (() => {
    try {
      return payload.lastUpdated ? new Date(payload.lastUpdated) : new Date();
    } catch (_error) {
      return new Date();
    }
  })();

  try {
    await Price.findOneAndUpdate(
      { coinId },
      {
        coinId: payload.coinId,
        symbol: payload.symbol,
        name: payload.name,
        image: payload.image ?? null,
        price: payload.price ?? null,
        change24h: payload.change_24h ?? 0,
        volatility7d: payload.volatility_7d ?? null,
        marketCap: payload.market_cap ?? null,
        totalVolume: payload.total_volume ?? null,
        source: payload.source ?? 'Unknown',
        cached: true,
        history: history.map(([timestamp, price]) => ({ timestamp, price })),
        lastUpdated: lastUpdatedDate,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.warn(`[Cache] write failed for ${coinId}: ${error?.message || 'Unknown cache error'}`);
  }
};

export const getCryptoData = async (coinId) => {
  if (!coinId || typeof coinId !== 'string') {
    throw new Error('coinId must be a non-empty string');
  }

  const normalizedCoinId = coinId.trim().toLowerCase();
  if (!normalizedCoinId) {
    throw new Error('coinId must be a non-empty string');
  }

  const cached = await getCachedEntry(normalizedCoinId);
  if (cached) {
    return cached;
  }

  const providers = [
    { name: 'Binance', handler: fetchFromBinance },
    { name: 'CoinPaprika', handler: fetchFromCoinPaprika },
    { name: 'CoinCap', handler: fetchFromCoinCap },
    { name: 'CoinGecko', handler: fetchFromCoinGecko },
  ];

  let result = null;
  const errors = [];

  for (let index = 0; index < providers.length; index += 1) {
    const { name, handler } = providers[index];
    try {
      const response = await handler(normalizedCoinId);
      result = response;
      break;
    } catch (error) {
      const message = error?.message || 'Unknown error';
      console.error(`[${name}] failed for ${normalizedCoinId}: ${message}`);
      errors.push(`${name}: ${message}`);
      const nextProvider = providers[index + 1];
      if (nextProvider) {
        console.log(`[Fallback: ${nextProvider.name}]`);
      }
    }
  }

  if (!result) {
    throw new Error(
      `Unable to retrieve data for ${normalizedCoinId}. Attempts: ${errors.join(' | ')}`
    );
  }

  const price = formatPrice(result.price);
  const change24h = roundTo(result.change24h, 2);
  const marketCap = parseNumber(result.marketCap);
  const totalVolume = parseNumber(result.volume24h);
  const symbol = result.symbol || fallbackSymbolFor(normalizedCoinId);
  const name = result.name || fallbackNameFor(normalizedCoinId);
  const image = result.image ?? null;
  const volatility =
    result.volatility === null || result.volatility === undefined
      ? null
      : roundTo(result.volatility, 2);
  const lastUpdated = (() => {
    if (!result.lastUpdated) {
      return new Date().toISOString();
    }
    try {
      return new Date(result.lastUpdated).toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  })();

  const historySeries = Array.isArray(result.history)
    ? result.history
        .map((entry) => {
          if (!Array.isArray(entry) || entry.length < 2) {
            return null;
          }
          const [timestamp, value] = entry;
          const parsedTimestamp = parseNumber(timestamp);
          const parsedValue = parseNumber(value);
          if (!Number.isFinite(parsedTimestamp) || !Number.isFinite(parsedValue)) {
            return null;
          }
          return [parsedTimestamp, parsedValue];
        })
        .filter(Boolean)
        .sort((a, b) => a[0] - b[0])
    : [];
  const trimmedHistory =
    historySeries.length > MAX_HISTORY_POINTS
      ? historySeries.slice(historySeries.length - MAX_HISTORY_POINTS)
      : historySeries;

  const payload = {
    coinId: normalizedCoinId,
    symbol,
    name,
    image,
    price,
    change_24h: change24h,
    volatility_7d: volatility,
    market_cap: marketCap,
    total_volume: totalVolume,
    history: trimmedHistory,
    source: result.source,
    cached: false,
    lastUpdated,
  };

  await saveToCache(normalizedCoinId, payload);

  return payload;
};

/* Sample usage:
const data = await getCryptoData('bitcoin');
console.log(data);
*/
