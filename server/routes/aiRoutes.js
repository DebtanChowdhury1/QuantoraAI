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
  asyncHandler(async (req, res) => {
    const limit = Number(config.coins.length) * 5 || 20;
    const refresh = req.query.refresh !== 'false';
    const notify = req.query.notify !== 'false';
    if (refresh) {
      await Promise.allSettled(
        config.coins.map((coinId) =>
          generateAndStorePrediction(coinId, { notify })
        )
      );
    }
    const predictions = await getLatestPredictions(limit);
    res.json({
      data: predictions,
      meta: {
        refreshed: refresh,
        signalCacheSeconds: config.aiSignalCacheSeconds,
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const coinId = req.params.id;
    const force = req.query.force === 'true';
    const maxAgeMs = config.aiSignalCacheSeconds * 1000;

    let latest = await getLatestPredictionForCoin(coinId);
    const isStale = !latest || Date.now() - latest.createdAt.getTime() > maxAgeMs;

    let stats;
    let reused = false;

    let fallbackUsed = false;

    if (force || isStale || !latest) {
      const result = await generateAndStorePrediction(coinId, { notify: false, force });
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
      fallbackUsed = Boolean((latest.providerResponse || latest.geminiResponse)?.fallback);
    }

    const providerPayload = latest.providerResponse || latest.geminiResponse || {};
    const sourceType = reused
      ? providerPayload?.fallback
        ? 'heuristic'
        : 'cache'
      : fallbackUsed
      ? 'heuristic'
      : providerPayload?.provider || 'quantora-ai';

    res.json({
      data: {
        coinId,
        action: latest.action,
        confidence: latest.confidence,
        reason: latest.reason,
        reasoning: latest.reason,
        riskLevel: latest.riskLevel,
        trendDirection: latest.trendDirection,
        predictionHorizon: latest.predictionHorizon,
        momentum: latest.momentum,
        marketStrength: latest.marketStrength,
        providerStatus: latest.providerStatus,
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
    const result = await generateAndStorePrediction(coinId, { notify: false, force: true });
    const { predictionDoc, stats, fallbackUsed } = result;
    res.status(201).json({
      data: {
        coinId,
        action: predictionDoc.action,
        confidence: predictionDoc.confidence,
        reason: predictionDoc.reason,
        reasoning: predictionDoc.reason,
        riskLevel: predictionDoc.riskLevel,
        trendDirection: predictionDoc.trendDirection,
        predictionHorizon: predictionDoc.predictionHorizon,
        momentum: predictionDoc.momentum,
        marketStrength: predictionDoc.marketStrength,
        providerStatus: predictionDoc.providerStatus,
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
        sourceType: fallbackUsed
          ? 'heuristic'
          : predictionDoc.providerResponse?.provider || 'quantora-ai',
      },
    });
  })
);

export default router;
