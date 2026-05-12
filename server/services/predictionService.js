import logger from '../utils/logger.js';
import { config } from '../utils/limits.js';
import { getCryptoData } from './cryptoDataService.js';
import { generatePrediction } from './geminiService.js';
import {
  buildQuantoraFallbackSignal,
  normalizeProviderSignal,
} from './quantoraSignalEngine.js';
import { sendAlertEmail } from './mailService.js';
import Prediction from '../models/Prediction.js';
import User from '../models/User.js';

const secondsToMs = (seconds) => seconds * 1000;

const computeStatsFromHistory = (prices) => {
  if (!Array.isArray(prices) || prices.length === 0) {
    return { avgPrice: 0, volatility: 0 };
  }
  const onlyPrices = prices.map((item) => (Array.isArray(item) ? item[1] : item));
  const sum = onlyPrices.reduce((acc, value) => acc + value, 0);
  const avgPrice = sum / onlyPrices.length;
  const variance =
    onlyPrices.reduce((acc, value) => acc + Math.pow(value - avgPrice, 2), 0) / onlyPrices.length;
  const volatility = avgPrice === 0 ? 0 : (Math.sqrt(variance) / avgPrice) * 100;
  return { avgPrice, volatility };
};

const fetchPreviousPrediction = (coinId) =>
  Prediction.findOne({ coinId, sourceType: 'raw' }).sort({ createdAt: -1 });

const notifyUsers = async ({ coinId, coinName, action, confidence, reason, price }) => {
  const users = await User.find({
    alertPreferences: { $elemMatch: { coinId, enabled: true } },
  });

  if (!users.length) {
    return;
  }

  const upsertOps = [];
  let notifications = 0;

  for (const user of users) {
    const settings = user.notificationSettings || {};
    const selectedCoins = new Set(settings.selectedCoins || []);
    if (settings.emailEnabled === false || settings.signalEmail === false) {
      continue;
    }
    if (selectedCoins.size && !selectedCoins.has(coinId)) {
      continue;
    }
    const pref = user.alertPreferences.find((item) => item.coinId === coinId);
    const minConfidence = Number(pref?.minConfidence ?? 0.65);
    const cooldownMinutes = Number(pref?.cooldownMinutes ?? config.emailMinGapMin);
    const cooldownMs = Math.max(cooldownMinutes, 5) * 60 * 1000;

    if (confidence < minConfidence || !user.canNotifyForCoin(coinId, cooldownMs)) {
      continue;
    }
    try {
      await sendAlertEmail({
        to: user.email,
        coinId,
        coinName,
        action,
        confidence,
        price,
        reason,
      });
      user.markThrottle(coinId);
      notifications += 1;
      upsertOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              alertPreferences: user.alertPreferences,
              notificationThrottle: user.getThrottleSnapshot(),
            },
          },
        },
      });
    } catch (error) {
      logger.error({ err: error, user: user.email }, 'Failed to notify user');
    }
  }

  if (upsertOps.length) {
    await User.bulkWrite(upsertOps, { ordered: false });
  }

  logger.info({ coinId, notifications }, 'Completed user notifications for coin');
};

export const generateAndStorePrediction = async (coinId, { notify = true, force = false } = {}) => {
  const snapshot = await getCryptoData(coinId);
  const { avgPrice, volatility } = computeStatsFromHistory(snapshot.history || []);
  const change24h = Number(snapshot.change_24h) || 0;
  const periodDays = 7;
  const previous = await fetchPreviousPrediction(coinId);

  if (previous) {
    const ageMs = Date.now() - previous.createdAt.getTime();
    if (!force && ageMs < secondsToMs(config.aiSignalCacheSeconds) && !notify) {
      return {
        predictionDoc: previous,
        previous,
        snapshot,
        stats: { avgPrice, volatility, change24h },
        reused: true,
      };
    }
  }

  const currentPrice = snapshot.price;
  const marketContext = {
    change24h,
    volatility,
    avgPrice,
    marketPrice: currentPrice,
    coinName: snapshot.name,
  };

  let aiPrediction;
  let fallbackUsed = false;
  let predictionError;

  try {
    aiPrediction = await generatePrediction({
      coinId,
      coinName: snapshot.name,
      periodDays,
      avgPrice,
      volatility,
      change24h,
      marketPrice: currentPrice,
    });
    aiPrediction = normalizeProviderSignal(aiPrediction, marketContext);
  } catch (error) {
    fallbackUsed = true;
    predictionError = error;
    logger.warn({ err: error, coinId }, 'Quantora AI provider unavailable; using deterministic fallback signal');
    aiPrediction = buildQuantoraFallbackSignal({
      ...marketContext,
      providerFailure: true,
    });
  }

  const predictionDoc = await Prediction.create({
    coinId,
    coinSymbol: snapshot.symbol,
    marketPrice: currentPrice,
    action: aiPrediction.action,
    confidence: aiPrediction.confidence,
    reason: aiPrediction.reason,
    riskLevel: aiPrediction.riskLevel,
    trendDirection: aiPrediction.trendDirection,
    predictionHorizon: aiPrediction.predictionHorizon,
    momentum: aiPrediction.momentum,
    marketStrength: aiPrediction.marketStrength,
    providerStatus: aiPrediction.providerStatus,
    change24h,
    averagePrice: avgPrice,
    volatility,
    periodDays,
    sourceType: 'raw',
    providerResponse: fallbackUsed
      ? { fallback: true, error: predictionError?.message, payload: aiPrediction.raw }
      : aiPrediction.raw,
    geminiResponse: fallbackUsed
      ? { fallback: true, error: predictionError?.message, payload: aiPrediction.raw }
      : aiPrediction.raw,
  });

  const actionChanged = previous ? previous.action !== aiPrediction.action : true;
  if (!fallbackUsed && notify && (!config.sendEmailOnChangeOnly || actionChanged)) {
    await notifyUsers({
      coinId,
      coinName: snapshot.name,
      action: aiPrediction.action,
      confidence: aiPrediction.confidence,
      reason: aiPrediction.reason,
      price: currentPrice,
    });
    await Prediction.findByIdAndUpdate(predictionDoc._id, {
      alertDispatched: true,
      dispatchedAt: new Date(),
    });
  }

  return {
    predictionDoc,
    previous,
    snapshot,
    stats: { avgPrice, volatility, change24h },
    fallbackUsed,
  };
};

export const getLatestPredictions = async (limit = 20) =>
  Prediction.find({ sourceType: 'raw' }).sort({ createdAt: -1 }).limit(limit);

export const getLatestPredictionForCoin = (coinId) =>
  Prediction.findOne({ coinId, sourceType: 'raw' }).sort({ createdAt: -1 });

export const getPredictionHistory = (coinId, { limit = 100 } = {}) =>
  Prediction.find({ coinId }).sort({ createdAt: -1 }).limit(limit);



