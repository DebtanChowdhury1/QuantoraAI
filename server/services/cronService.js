import cron from 'node-cron';
import logger from '../utils/logger.js';
import { config } from '../utils/limits.js';
import Prediction from '../models/Prediction.js';
import { generateAndStorePrediction } from './predictionService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dayInMs = 24 * 60 * 60 * 1000;

let rotationIndex = 0;

const schedulePredictionCron = () => {
  const expression = `*/${config.predictRefreshMin} * * * *`;
  logger.info({ expression }, 'Starting prediction cron');
  return cron.schedule(
    expression,
    () => {
      runPredictionCycle().catch((err) => logger.error({ err }, 'Prediction cycle failed'));
    },
    { timezone: 'UTC' }
  );
};

const scheduleNightlyMaintenance = () => {
  const expression = '15 2 * * *';
  logger.info({ expression }, 'Starting nightly maintenance cron');
  return cron.schedule(
    expression,
    () => {
      runNightlyMaintenance().catch((err) => logger.error({ err }, 'Nightly maintenance failed'));
    },
    { timezone: 'UTC' }
  );
};

export const runPredictionCycle = async () => {
  const coins = config.coins;
  if (!coins.length) {
    logger.warn('No coins configured for prediction cycle');
    return;
  }

  const slice = [];
  for (let i = 0; i < config.predictCoinsPerCycle; i += 1) {
    const index = (rotationIndex + i) % coins.length;
    slice.push(coins[index]);
  }
  rotationIndex = (rotationIndex + config.predictCoinsPerCycle) % coins.length;

  for (let i = 0; i < slice.length; i += 1) {
    const coinId = slice[i];
    await processCoin(coinId);
    if (config.coingeckoRequestDelayMs > 0 && i < slice.length - 1) {
      await sleep(config.coingeckoRequestDelayMs);
    }
  }
};

const processCoin = async (coinId) => {
  try {
    await generateAndStorePrediction(coinId, { notify: true });
  } catch (error) {
    logger.error({ err: error, coinId }, 'Failed to process coin');
  }
};

export const runNightlyMaintenance = async () => {
  logger.info('Running nightly maintenance');
  const now = new Date();
  const midnightUtc = new Date(now);
  midnightUtc.setUTCHours(0, 0, 0, 0);
  const previousMidnight = new Date(midnightUtc.getTime() - dayInMs);

  const aggregation = await Prediction.aggregate([
    {
      $match: {
        sourceType: 'raw',
        createdAt: { $gte: previousMidnight, $lt: midnightUtc },
      },
    },
    {
      $addFields: {
        bucketStart: {
          $dateTrunc: {
            date: '$createdAt',
            unit: 'hour',
          },
        },
      },
    },
    {
      $group: {
        _id: {
          coinId: '$coinId',
          bucketStart: '$bucketStart',
        },
        coinSymbol: { $first: '$coinSymbol' },
        averagePrice: { $avg: '$marketPrice' },
        averageConfidence: { $avg: '$confidence' },
        buySignals: {
          $sum: {
            $cond: [{ $eq: ['$action', 'BUY'] }, 1, 0],
          },
        },
        holdSignals: {
          $sum: {
            $cond: [{ $eq: ['$action', 'HOLD'] }, 1, 0],
          },
        },
        sellSignals: {
          $sum: {
            $cond: [{ $eq: ['$action', 'SELL'] }, 1, 0],
          },
        },
        lastAction: { $last: '$action' },
        volatility: { $avg: '$volatility' },
        change24h: { $avg: '$change24h' },
      },
    },
  ]);

  for (const entry of aggregation) {
    try {
      await Prediction.findOneAndUpdate(
        {
          coinId: entry._id.coinId,
          sourceType: 'rollup',
          bucketStart: entry._id.bucketStart,
        },
        {
          coinId: entry._id.coinId,
          coinSymbol: entry.coinSymbol,
          marketPrice: entry.averagePrice,
          action: entry.lastAction,
          confidence: entry.averageConfidence,
          reason: 'Hourly rollup',
          change24h: entry.change24h,
          averagePrice: entry.averagePrice,
          volatility: entry.volatility,
          periodDays: config.rollupIntervalHours / 24,
          sourceType: 'rollup',
          bucketStart: entry._id.bucketStart,
          geminiResponse: null,
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      logger.error({ err: error, entry }, 'Failed to upsert rollup prediction');
    }
  }

  const retentionCutoff = new Date(Date.now() - config.rawRetentionDays * dayInMs);
  const { deletedCount } = await Prediction.deleteMany({
    sourceType: 'raw',
    createdAt: { $lt: retentionCutoff },
  });
  logger.info({ deletedCount }, 'Nightly maintenance complete');
};

export const startBackgroundJobs = () => {
  const predictionCron = schedulePredictionCron();
  const maintenanceCron = scheduleNightlyMaintenance();
  return { predictionCron, maintenanceCron };
};
