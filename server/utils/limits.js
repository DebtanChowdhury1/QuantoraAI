import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const dayInMs = 24 * 60 * 60 * 1000;

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value, fallback) => {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

const defaultCoins = ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'cardano'];

export const config = {
  coins: process.env.COINS ? process.env.COINS.split(',').map((c) => c.trim()).filter(Boolean) : defaultCoins,
  marketsRefreshMin: parseNumber(process.env.MARKETS_REFRESH_MIN, 5),
  predictRefreshMin: parseNumber(process.env.PREDICT_REFRESH_MIN, 10),
  predictCoinsPerCycle: parseNumber(process.env.PREDICT_COINS_PER_CYCLE, 5),
  maxGeminiPerDay: parseNumber(process.env.MAX_GEMINI_REQ_PER_DAY, 800),
  maxCoinGeckoPerDay: parseNumber(process.env.MAX_COINGECKO_REQ_PER_DAY, 250),
  emailMaxPerDay: parseNumber(process.env.EMAIL_MAX_PER_DAY, 100),
  emailMinGapMin: parseNumber(process.env.EMAIL_MIN_GAP_MIN, 60),
  sendEmailOnChangeOnly: parseBoolean(process.env.SEND_EMAIL_ON_CHANGE_ONLY, true),
  rawRetentionDays: parseNumber(process.env.RAW_PREDICTION_RETENTION_DAYS, 90),
  rollupIntervalHours: parseNumber(process.env.ROLLUP_INTERVAL_HOURS, 1),
  enableCloudinary: parseBoolean(process.env.ENABLE_CLOUDINARY, false),
  coingeckoRequestDelayMs: parseNumber(process.env.COINGECKO_REQUEST_DELAY_MS, 1500),
  coingeckoRetryAttempts: parseNumber(process.env.COINGECKO_RETRY_ATTEMPTS, 2),
  coingeckoRetryDelayMs: parseNumber(process.env.COINGECKO_RETRY_DELAY_MS, 10000),
};

const counters = {
  coingecko: { count: 0, resetAt: Date.now() + dayInMs },
  gemini: { count: 0, resetAt: Date.now() + dayInMs },
  email: { count: 0, resetAt: Date.now() + dayInMs },
};

const ensureCounterFresh = (counter) => {
  if (Date.now() >= counter.resetAt) {
    counter.count = 0;
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);
    counter.resetAt = nextReset.getTime();
  }
};

export const touchCounter = (key, amount = 1) => {
  const counter = counters[key];
  if (!counter) {
    return;
  }
  ensureCounterFresh(counter);
  const cap =
    key === 'coingecko'
      ? config.maxCoinGeckoPerDay
      : key === 'gemini'
      ? config.maxGeminiPerDay
      : config.emailMaxPerDay;
  if (cap <= 0) {
    return;
  }
  if (counter.count + amount > cap) {
    const error = new Error(`${key} daily limit reached`);
    error.code = 'DAILY_LIMIT_REACHED';
    error.meta = { key, max: cap };
    throw error;
  }
  counter.count += amount;
};

export const remainingFor = (key) => {
  const counter = counters[key];
  if (!counter) {
    return Infinity;
  }
  ensureCounterFresh(counter);
  const cap =
    key === 'coingecko'
      ? config.maxCoinGeckoPerDay
      : key === 'gemini'
      ? config.maxGeminiPerDay
      : config.emailMaxPerDay;
  return cap - counter.count;
};

export const minutesToMs = (minutes) => minutes * 60 * 1000;


