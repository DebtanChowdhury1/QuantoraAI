import logger from '../utils/logger.js';
import { config } from '../utils/limits.js';
import { getCoinDetails, getMarketChart } from './coingeckoService.js';
import { generatePrediction } from './geminiService.js';
import { sendAlertEmail } from './mailService.js';
import Prediction from '../models/Prediction.js';
import User from '../models/User.js';

const hoursToMs = (hours) => hours * 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const emailMinGapMs = config.emailMinGapMin * 60 * 1000;

  const upsertOps = [];
  let notifications = 0;

  for (const user of users) {
    if (!user.canNotifyForCoin(coinId, emailMinGapMs)) {
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

const buildFallbackPrediction = ({
  change24h,
  volatility,
  avgPrice,
  marketPrice,
  coinName,
}) => {
  const magnitude = Math.abs(change24h);
  let action = 'HOLD';
  if (change24h >= 1.5) {
    action = 'BUY';
  } else if (change24h <= -1.5) {
    action = 'SELL';
  }

  const confidenceBase = Math.min(magnitude / 10, 0.5);
  const volatilityPenalty = Math.min(volatility / 100, 0.3);
  const confidence = Math.max(0.2, confidenceBase + 0.2 - volatilityPenalty);

  const reasonParts = [
    'Gemini temporarily unavailable; heuristic fallback engaged.',
    `24h change ${change24h.toFixed(2)}%.`,
  ];
  if (Number.isFinite(volatility)) {
    reasonParts.push(`7d volatility ${volatility.toFixed(2)}%.`);
  }
  reasonParts.push(
    action === 'HOLD'
      ? 'Price movement within neutral band; maintaining position.'
      : action === 'BUY'
      ? 'Positive momentum suggests upside continuation.'
      : 'Negative momentum suggests near-term downside risk.'
  );

  return {
    action,
    confidence: Number(confidence.toFixed(2)),
    reason: reasonParts.join(' '),
    raw: {
      fallback: true,
      source: 'heuristic',
      change24h,
      volatility,
      avgPrice,
      marketPrice,
      coinName,
    },
  };
};

export const generateAndStorePrediction = async (coinId, { notify = true } = {}) => {
  const snapshot = await getCoinDetails(coinId);
  if (config.coingeckoRequestDelayMs > 0) {
    await sleep(Math.floor(config.coingeckoRequestDelayMs / 2));
  }
  const history = await getMarketChart(coinId, 7);
  const { avgPrice, volatility } = computeStatsFromHistory(history?.prices || []);
  const change24h = Number(snapshot?.market_data?.price_change_percentage_24h) ??
    Number(snapshot.price_change_percentage_24h) ??
    0;
  const periodDays = 7;
  const previous = await fetchPreviousPrediction(coinId);

  if (previous) {
    const ageMs = Date.now() - previous.createdAt.getTime();
    if (ageMs < hoursToMs(config.predictRefreshMin / 60) && !notify) {
      return {
        predictionDoc: previous,
        previous,
        snapshot,
        stats: { avgPrice, volatility, change24h },
        reused: true,
      };
    }
  }

  const currentPrice =
    snapshot?.market_data?.current_price?.usd ?? snapshot?.current_price ?? snapshot?.marketPrice;

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
  } catch (error) {
    fallbackUsed = true;
    predictionError = error;
    logger.warn({ err: error, coinId }, 'Gemini unavailable; using heuristic fallback prediction');
    aiPrediction = buildFallbackPrediction({
      change24h,
      volatility,
      avgPrice,
      marketPrice: currentPrice,
      coinName: snapshot.name,
    });
  }

  const predictionDoc = await Prediction.create({
    coinId,
    coinSymbol: snapshot.symbol,
    marketPrice: currentPrice,
    action: aiPrediction.action,
    confidence: aiPrediction.confidence,
    reason: aiPrediction.reason,
    change24h,
    averagePrice: avgPrice,
    volatility,
    periodDays,
    sourceType: 'raw',
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



