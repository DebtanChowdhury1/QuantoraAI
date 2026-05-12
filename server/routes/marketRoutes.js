import express from 'express';
import {
  pingAPI,
  getMarketData,
  getTrendingCoins,
  getGlobalStats,
  getCoinDetails,
  getMarketChart,
  getSimplePrice,
  getSupportedCurrencies,
  getCategories,
  getStatusUpdates,
  getDefiStats,
  getExchanges,
  getExchangeById,
  getExchangeVolume,
  getDerivatives,
  getDerivativeExchanges,
  searchCoins,
} from '../services/coingeckoService.js';
import { fetchBinanceTickerSnapshots, getCryptoData } from '../services/cryptoDataService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { config } from '../utils/limits.js';
import { HttpError } from '../utils/httpError.js';
import Price from '../models/Price.js';

const router = express.Router();

const withTimeout = (promise, ms, fallback = null) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);

const buildGlobalStats = (globalStats) => {
  const globalData = globalStats?.data || {};
  return {
    totalMarketCap: globalData.total_market_cap?.usd ?? null,
    totalVolume: globalData.total_volume?.usd ?? null,
    btcDominance: globalData.market_cap_percentage?.btc ?? null,
    activeCryptocurrencies: globalData.active_cryptocurrencies ?? null,
    markets: globalData.markets ?? null,
    marketCapChange24h: globalData.market_cap_change_percentage_24h_usd ?? null,
    volumeChange24h: globalData.volume_change_percentage_24h_usd ?? null,
    source: 'coingecko-global',
  };
};

const resolveGlobalStats = async () => {
  try {
    const stats = await withTimeout(getGlobalStats(), 700, null);
    return stats ? buildGlobalStats(stats) : null;
  } catch (globalError) {
    console.warn(`[Markets] global stats unavailable: ${globalError?.message || 'Unknown error'}`);
    return null;
  }
};

const buildCachedMarketRows = async () => {
  const docs = await Price.find({ coinId: { $in: config.coins } }).lean();
  const byCoin = new Map(docs.map((doc) => [doc.coinId, doc]));
  return config.coins
    .map((coinId) => {
      const doc = byCoin.get(coinId);
      if (!doc) return null;
      return {
        id: doc.coinId,
        symbol: doc.symbol,
        name: doc.name,
        image: doc.image ?? null,
        current_price: doc.price,
        price_change_percentage_24h: doc.change24h,
        volatility_7d: doc.volatility7d,
        market_cap: doc.marketCap ?? null,
        total_volume: doc.totalVolume ?? null,
        last_updated: (doc.lastUpdated || doc.updatedAt || new Date()).toISOString(),
        source: `${doc.source || 'cache'} stale-cache`,
        cached: true,
        stale: true,
      };
    })
    .filter(Boolean);
};

router.get(
  '/ping',
  asyncHandler(async (_req, res) => {
    const data = await pingAPI();
    res.json({ data });
  })
);

router.get(
  '/markets',
  asyncHandler(async (_req, res) => {
    const refreshedAt = new Date().toISOString();
    let fallbackUsed = false;
    let data = null;
    let global = null;
    let primaryError;

    try {
      const liveRows = await withTimeout(fetchBinanceTickerSnapshots(config.coins), 6000, []);
      if (liveRows.length >= Math.min(config.coins.length, 5)) {
        const liveIds = new Set(liveRows.map((item) => item.id));
        const cachedRows = (await buildCachedMarketRows()).filter((item) => !liveIds.has(item.id));
        data = [...liveRows, ...cachedRows];
      } else {
        const cachedRows = await buildCachedMarketRows();
        if (cachedRows.length >= Math.min(config.coins.length, 5)) {
          data = cachedRows;
          fallbackUsed = true;
        } else {
          if (!config.useCoinGeckoPrimary) {
            throw new Error('CoinGecko primary disabled');
          }
          const primary = await withTimeout(getMarketData(), 8000, null);
          if (!Array.isArray(primary) || primary.length === 0) {
            throw new Error('Primary market feed timed out or returned no market entries');
          }
          data = primary;
        }
      }
    } catch (error) {
      primaryError = error;
      fallbackUsed = true;
      console.error(
        `[Markets] primary market fetch failed: ${error?.message || 'Unknown error'}`
      );

      const cachedRows = await buildCachedMarketRows();
      if (cachedRows.length >= Math.min(config.coins.length, 5)) {
        data = cachedRows;
      } else {
      const results = await Promise.allSettled(
        config.coins.map(async (coinId) => {
          const snapshot = await getCryptoData(coinId);
          console.log(
            `[Markets] fallback success via ${snapshot.source} for ${coinId} (cached=${snapshot.cached})`
          );
          return {
            id: snapshot.coinId,
            symbol: snapshot.symbol,
            name: snapshot.name,
            image: snapshot.image ?? null,
            current_price: snapshot.price,
            price_change_percentage_24h: snapshot.change_24h,
            volatility_7d: snapshot.volatility_7d,
            market_cap: snapshot.market_cap ?? null,
            total_volume: snapshot.total_volume ?? null,
            last_updated: snapshot.lastUpdated,
            source: snapshot.source,
            cached: snapshot.cached,
          };
        })
      );

      const fallbackRows = [];
      const fallbackErrors = [];
      results.forEach((result, index) => {
        const coinId = config.coins[index];
        if (result.status === 'fulfilled') {
          fallbackRows.push(result.value);
          return;
        }
        const message = result.reason?.message || 'Unknown error';
        console.error(`[Markets] fallback failed for ${coinId}: ${message}`);
        fallbackErrors.push({ coinId, message });
      });

      if (!fallbackRows.length && !cachedRows.length) {
        throw new HttpError(503, 'Unable to load market data', {
          cause: primaryError?.message || 'Unknown primary failure',
          fallbackErrors,
        });
      }

      data = fallbackRows.length ? fallbackRows : cachedRows;
      }
    }

    if (!global || !Number(global.totalMarketCap)) {
      global = await resolveGlobalStats();
    }

    if (!global || !Number(global.totalMarketCap)) {
      const totalMarketCap = data.reduce((acc, item) => acc + (Number(item.market_cap) || 0), 0);
      const totalVolume = data.reduce((acc, item) => acc + (Number(item.total_volume) || 0), 0);
      const btcMarketCap = data.find((item) => item.id === 'bitcoin')?.market_cap ?? 0;
      global = {
        totalMarketCap: totalMarketCap || null,
        totalVolume: totalVolume || null,
        btcDominance: totalMarketCap ? (Number(btcMarketCap) / totalMarketCap) * 100 : null,
        estimated: true,
        source: totalMarketCap ? 'tracked-market-sum' : 'unavailable',
      };
    }

    res.json({
      data,
      coins: config.coins,
      fallback: fallbackUsed,
      refreshedAt,
      meta: {
        global,
        source: fallbackUsed ? 'multi-provider-fallback' : data?.[0]?.source || 'coingecko',
      },
    });
  })
);

router.get(
  '/crypto/:id',
  asyncHandler(async (req, res) => {
    const data = await getCryptoData(req.params.id);
    res.json({ data });
  })
);

router.get(
  '/markets/:id',
  asyncHandler(async (req, res) => {
    const data = await getCryptoData(req.params.id);
    res.json({ data });
  })
);

router.get(
  '/snapshot/:id',
  asyncHandler(async (req, res) => {
    const coinId = req.params.id;
    const isTrackedCoin = config.coins.includes(coinId);
    let raw;
    let fallbackUsed = false;

    try {
      if (isTrackedCoin) {
        const snapshot = await getCryptoData(coinId);
        const data = {
          id: snapshot.coinId,
          symbol: snapshot.symbol?.toLowerCase() || snapshot.coinId,
          name: snapshot.name,
          image: snapshot.image ?? null,
          current_price: snapshot.price ?? null,
          market_cap: snapshot.market_cap ?? null,
          price_change_percentage_24h: snapshot.change_24h ?? null,
          last_updated: snapshot.lastUpdated,
          source: snapshot.source,
          cached: snapshot.cached,
        };
        res.json({ data, raw: snapshot, fallback: false });
        return;
      }
      if (!config.useCoinGeckoPrimary && isTrackedCoin) {
        throw new Error('CoinGecko primary disabled');
      }
      raw = await getCoinDetails(coinId);
    } catch (error) {
      fallbackUsed = true;
      console.error(
        `[Snapshot] primary fetch failed for ${coinId}: ${error?.message || 'Unknown error'}`
      );
      const snapshot = await getCryptoData(coinId);
      if (!snapshot) {
        throw new HttpError(503, 'Unable to load coin snapshot', {
          cause: error?.message || 'Unknown primary failure',
        });
      }
      const data = {
        id: snapshot.coinId,
        symbol: snapshot.symbol?.toLowerCase() || snapshot.coinId,
        name: snapshot.name,
        image: snapshot.image ?? null,
        current_price: snapshot.price ?? null,
        market_cap: snapshot.market_cap ?? null,
        price_change_percentage_24h: snapshot.change_24h ?? null,
        last_updated: snapshot.lastUpdated,
        source: snapshot.source,
        cached: snapshot.cached,
      };
      res.json({ data, raw: snapshot, fallback: fallbackUsed });
      return;
    }

    const data = {
      id: raw.id,
      symbol: raw.symbol,
      name: raw.name,
      image: raw.image?.large || raw.image?.small || raw.image?.thumb || null,
      current_price: raw.market_data?.current_price?.usd ?? null,
      market_cap: raw.market_data?.market_cap?.usd ?? null,
      price_change_percentage_24h: raw.market_data?.price_change_percentage_24h ?? null,
      last_updated: raw.last_updated ?? raw.market_data?.last_updated ?? new Date().toISOString(),
    };
    res.json({ data, raw, fallback: fallbackUsed });
  })
);

router.get(
  '/history/:id',
  asyncHandler(async (req, res) => {
    const period = req.query.period || '7';
    const coinId = req.params.id;
    const isTrackedCoin = config.coins.includes(coinId);
    const refreshedAt = new Date().toISOString();
    let fallbackUsed = false;
    let data;

    try {
      if (!config.useCoinGeckoPrimary && isTrackedCoin) {
        throw new Error('CoinGecko primary disabled');
      }
      data = await getMarketChart(coinId, period);
    } catch (error) {
      fallbackUsed = true;
      console.error(
        `[History] primary chart fetch failed for ${coinId}: ${error?.message || 'Unknown error'}`
      );
      const snapshot = await getCryptoData(coinId);
      if (!Array.isArray(snapshot.history) || !snapshot.history.length) {
        throw new HttpError(503, 'Unable to load price history', {
          cause: error?.message || 'Unknown primary failure',
        });
      }
      data = {
        prices: snapshot.history,
        market_caps: [],
        total_volumes: [],
        source: snapshot.source,
        cached: snapshot.cached,
      };
    }

    res.json({
      data,
      period,
      refreshedAt,
      fallback: fallbackUsed,
    });
  })
);

router.get(
  '/simple-price',
  asyncHandler(async (req, res) => {
    const ids = req.query.ids ? req.query.ids.split(',') : config.coins;
    const currencies = req.query.vs_currencies ? req.query.vs_currencies.split(',') : ['usd'];
    const data = await getSimplePrice(ids, currencies);
    res.json({ data });
  })
);

router.get(
  '/currencies',
  asyncHandler(async (_req, res) => {
    const data = await getSupportedCurrencies();
    res.json({ data });
  })
);

router.get(
  '/trending',
  asyncHandler(async (_req, res) => {
    const data = await getTrendingCoins();
    res.json({ data });
  })
);

router.get(
  '/global',
  asyncHandler(async (_req, res) => {
    const data = await getGlobalStats();
    res.json({ data });
  })
);

router.get(
  '/defi',
  asyncHandler(async (_req, res) => {
    const data = await getDefiStats();
    res.json({ data });
  })
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const data = await getCategories();
    res.json({ data });
  })
);

router.get(
  '/status-updates',
  asyncHandler(async (_req, res) => {
    const data = await getStatusUpdates();
    res.json({ data });
  })
);

router.get(
  '/exchanges',
  asyncHandler(async (_req, res) => {
    const data = await getExchanges();
    res.json({ data });
  })
);

router.get(
  '/exchanges/:id',
  asyncHandler(async (req, res) => {
    const data = await getExchangeById(req.params.id);
    res.json({ data });
  })
);

router.get(
  '/exchanges/:id/volume',
  asyncHandler(async (req, res) => {
    const days = req.query.days || 7;
    const data = await getExchangeVolume(req.params.id, days);
    res.json({ data });
  })
);

router.get(
  '/derivatives',
  asyncHandler(async (_req, res) => {
    const data = await getDerivatives();
    res.json({ data });
  })
);

router.get(
  '/derivatives/exchanges',
  asyncHandler(async (_req, res) => {
    const data = await getDerivativeExchanges();
    res.json({ data });
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const query = req.query.query || req.query.q || '';
    const data = await searchCoins(query);
    res.json({ data });
  })
);

export default router;
