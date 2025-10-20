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
import { getCryptoData } from '../services/cryptoDataService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { config } from '../utils/limits.js';
import { HttpError } from '../utils/httpError.js';

const router = express.Router();

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
    let primaryError;

    try {
      const primary = await getMarketData();
      if (!Array.isArray(primary) || primary.length === 0) {
        throw new Error('CoinGecko returned no market entries');
      }
      data = primary;
    } catch (error) {
      primaryError = error;
      fallbackUsed = true;
      console.error(
        `[Markets] primary market fetch failed: ${error?.message || 'Unknown error'}`
      );
      const fallbackRows = [];
      const fallbackErrors = [];
      for (const coinId of config.coins) {
        try {
          const snapshot = await getCryptoData(coinId);
          fallbackRows.push({
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
          });
          console.log(
            `[Markets] fallback success via ${snapshot.source} for ${coinId} (cached=${snapshot.cached})`
          );
        } catch (fallbackError) {
          const message = fallbackError?.message || 'Unknown error';
          console.error(`[Markets] fallback failed for ${coinId}: ${message}`);
          fallbackErrors.push({ coinId, message });
        }
      }

      if (!fallbackRows.length) {
        throw new HttpError(503, 'Unable to load market data', {
          cause: primaryError?.message || 'Unknown primary failure',
          fallbackErrors,
        });
      }

      data = fallbackRows;
    }

    res.json({
      data,
      coins: config.coins,
      fallback: fallbackUsed,
      refreshedAt,
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
    let raw;
    let fallbackUsed = false;

    try {
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
    };
    res.json({ data, raw, fallback: fallbackUsed });
  })
);

router.get(
  '/history/:id',
  asyncHandler(async (req, res) => {
    const period = req.query.period || '7';
    const coinId = req.params.id;
    const refreshedAt = new Date().toISOString();
    let fallbackUsed = false;
    let data;

    try {
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
