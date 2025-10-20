import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { config } from '../utils/limits.js';
import {
  generateAndStorePrediction,
  getLatestPredictionForCoin,
  getPredictionHistory,
  getLatestPredictions,
} from '../services/predictionService.js';

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const limit = Number(config.coins.length) * 5 || 20;
    const predictions = await getLatestPredictions(limit);
    res.json({
      data: predictions,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const coinId = req.params.id;
    const force = req.query.force === 'true';
    const maxAgeMs = config.predictRefreshMin * 60 * 1000;

    let latest = await getLatestPredictionForCoin(coinId);
    const isStale = !latest || Date.now() - latest.createdAt.getTime() > maxAgeMs;

    let stats;
    let reused = false;

    let fallbackUsed = false;

    if (force || isStale || !latest) {
      const result = await generateAndStorePrediction(coinId, { notify: false });
      latest = result.predictionDoc;
      stats = result.stats;
      reused = !!result.reused;
      fallbackUsed = result.fallbackUsed;
    } else {
      stats = {
        avgPrice: latest.averagePrice,
        volatility: latest.volatility,
        change24h: latest.change24h,
      };
      reused = true;
      fallbackUsed = Boolean(latest.geminiResponse?.fallback);
    }

    const sourceType = reused
      ? latest.geminiResponse?.fallback
        ? 'heuristic'
        : 'cache'
      : fallbackUsed
      ? 'heuristic'
      : 'gemini';

    res.json({
      data: {
        coinId,
        action: latest.action,
        confidence: latest.confidence,
        reason: latest.reason,
        createdAt: latest.createdAt,
        marketPrice: latest.marketPrice,
        change24h: latest.change24h,
        stats: {
          ...stats,
          periodDays: latest.periodDays,
        },
      },
      meta: {
        reused,
        sourceType,
        fallbackUsed,
      },
    });
  })
);

router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const coinId = req.params.id;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const history = await getPredictionHistory(coinId, { limit });
    res.json({
      data: history,
    });
  })
);

router.post(
  '/:id/refresh',
  asyncHandler(async (req, res) => {
    const coinId = req.params.id;
    const result = await generateAndStorePrediction(coinId, { notify: false });
    const { predictionDoc, stats, fallbackUsed } = result;
    res.status(201).json({
      data: {
        coinId,
        action: predictionDoc.action,
        confidence: predictionDoc.confidence,
        reason: predictionDoc.reason,
        createdAt: predictionDoc.createdAt,
        marketPrice: predictionDoc.marketPrice,
        change24h: predictionDoc.change24h,
        stats: {
          avgPrice: stats?.avgPrice ?? predictionDoc.averagePrice,
          volatility: stats?.volatility ?? predictionDoc.volatility,
          change24h: stats?.change24h ?? predictionDoc.change24h,
          periodDays: predictionDoc.periodDays,
        },
      },
      meta: {
        refreshed: true,
        fallbackUsed,
        sourceType: fallbackUsed ? 'heuristic' : 'gemini',
      },
    });
  })
);

export default router;
