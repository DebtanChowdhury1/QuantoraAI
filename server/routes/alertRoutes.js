import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { config } from '../utils/limits.js';
import { badRequest, unauthorized } from '../utils/httpError.js';
import Prediction from '../models/Prediction.js';
import User from '../models/User.js';
import { sendCustomNotificationEmail } from '../services/mailService.js';

const router = express.Router();

const ensureAuth = (req) => {
  const email = (req.header('x-user-email') || req.query.email || req.body?.email || '').trim();
  if (!email) {
    throw unauthorized();
  }
  return { email: email.toLowerCase() };
};

const ensureCoinPreferences = (user) => {
  return user.ensureDefaultPreferences(config.coins);
};

const ensureNotificationSettings = (user) => {
  const current = user.notificationSettings || {};
  user.notificationSettings = {
    emailEnabled: current.emailEnabled ?? true,
    signalEmail: current.signalEmail ?? true,
    marketMoveEmail: current.marketMoveEmail ?? true,
    portfolioEmail: current.portfolioEmail ?? true,
    portfolioValueEmail: current.portfolioValueEmail ?? true,
    emailFrequencyMinutes: current.emailFrequencyMinutes ?? config.emailMinGapMin,
    marketMoveThreshold: current.marketMoveThreshold ?? 5,
    selectedCoins: Array.isArray(current.selectedCoins) && current.selectedCoins.length
      ? current.selectedCoins
      : config.coins.slice(0, 10),
  };
};

const findOrCreateUser = async ({ email }) => {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      alertPreferences: config.coins.map((coinId) => ({
        coinId,
        enabled: true,
        minConfidence: 0.65,
        cooldownMinutes: config.emailMinGapMin,
      })),
    });
    return user;
  }
  const mutated = ensureCoinPreferences(user);
  ensureNotificationSettings(user);
  if (mutated) {
    await user.save();
  }
  return user;
};

router.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const auth = ensureAuth(req);
    const user = await findOrCreateUser(auth);
    res.json({
      data: user.alertPreferences,
      meta: {
        emailMinGapMin: config.emailMinGapMin,
      },
    });
  })
);

router.put(
  '/preferences',
  asyncHandler(async (req, res) => {
    const auth = ensureAuth(req);
    const user = await findOrCreateUser(auth);
    const preferences = req.body?.preferences;
    if (!preferences || typeof preferences !== 'object') {
      throw badRequest('Invalid preferences payload');
    }
    for (const coinId of config.coins) {
      const pref = user.alertPreferences.find((item) => item.coinId === coinId);
      const incoming = preferences[coinId];
      const enabled = typeof incoming === 'object' ? incoming.enabled : incoming;
      const minConfidence =
        typeof incoming === 'object' && Number.isFinite(Number(incoming.minConfidence))
          ? Math.min(Math.max(Number(incoming.minConfidence), 0.1), 0.99)
          : undefined;
      const cooldownMinutes =
        typeof incoming === 'object' && Number.isFinite(Number(incoming.cooldownMinutes))
          ? Math.min(Math.max(Number(incoming.cooldownMinutes), 5), 1440)
          : undefined;
      if (pref) {
        pref.enabled = Boolean(enabled);
        if (minConfidence !== undefined) pref.minConfidence = minConfidence;
        if (cooldownMinutes !== undefined) pref.cooldownMinutes = cooldownMinutes;
      } else {
        user.alertPreferences.push({
          coinId,
          enabled: Boolean(enabled),
          minConfidence: minConfidence ?? 0.65,
          cooldownMinutes: cooldownMinutes ?? config.emailMinGapMin,
        });
      }
    }
    await user.save();
    res.json({ data: user.alertPreferences });
  })
);

router.get(
  '/email-settings',
  asyncHandler(async (req, res) => {
    const auth = ensureAuth(req);
    const user = await findOrCreateUser(auth);
    res.json({
      data: user.notificationSettings,
      meta: { coins: config.coins },
    });
  })
);

router.put(
  '/email-settings',
  asyncHandler(async (req, res) => {
    const auth = ensureAuth(req);
    const user = await findOrCreateUser(auth);
    const payload = req.body?.settings;
    if (!payload || typeof payload !== 'object') {
      throw badRequest('Invalid email notification settings payload');
    }

    const selectedCoins = Array.isArray(payload.selectedCoins)
      ? payload.selectedCoins
          .map((coinId) => String(coinId).trim().toLowerCase())
          .filter((coinId) => config.coins.includes(coinId))
      : user.notificationSettings?.selectedCoins || config.coins.slice(0, 10);

    user.notificationSettings = {
      ...user.notificationSettings,
      emailEnabled: Boolean(payload.emailEnabled),
      signalEmail: Boolean(payload.signalEmail),
      marketMoveEmail: Boolean(payload.marketMoveEmail),
      portfolioEmail: Boolean(payload.portfolioEmail),
      portfolioValueEmail: Boolean(payload.portfolioValueEmail),
      emailFrequencyMinutes: Number.isFinite(Number(payload.emailFrequencyMinutes))
        ? Math.min(Math.max(Number(payload.emailFrequencyMinutes), 5), 1440)
        : config.emailMinGapMin,
      marketMoveThreshold: Number.isFinite(Number(payload.marketMoveThreshold))
        ? Math.min(Math.max(Number(payload.marketMoveThreshold), 0.1), 50)
        : 5,
      selectedCoins,
    };

    await user.save();
    res.json({ data: user.notificationSettings });
  })
);

router.post(
  '/custom-email',
  asyncHandler(async (req, res) => {
    const auth = ensureAuth(req);
    const user = await findOrCreateUser(auth);
    const settings = user.notificationSettings || {};
    if (!settings.emailEnabled) {
      res.json({ data: { sent: false, reason: 'email-disabled' } });
      return;
    }

    const type = String(req.body?.type || '').toUpperCase();
    const coinId = String(req.body?.coinId || '').toLowerCase();
    const title = String(req.body?.title || 'Quantora AI notification').slice(0, 140);
    const body = String(req.body?.body || '').slice(0, 1000);
    const changePct = Number(req.body?.changePct);
    const confidence = Number(req.body?.confidence);
    const action = String(req.body?.action || 'UPDATE').slice(0, 32).toUpperCase();
    const displayName = String(req.body?.displayName || '').slice(0, 80);
    const price = Number(req.body?.marketPrice ?? req.body?.price);
    const trigger = String(req.body?.trigger || '').slice(0, 80);

    const selectedCoins = new Set(settings.selectedCoins || []);
    const usesSelectedCoins = ['MARKET_MOVE', 'SIGNAL', 'AI_SIGNAL'].includes(type);
    if (usesSelectedCoins && coinId && selectedCoins.size && !selectedCoins.has(coinId)) {
      res.json({ data: { sent: false, reason: 'coin-not-selected' } });
      return;
    }

    if (['SIGNAL', 'AI_SIGNAL'].includes(type)) {
      if (!settings.signalEmail) {
        res.json({ data: { sent: false, reason: 'signal-email-disabled' } });
        return;
      }
      const pref = user.alertPreferences.find((item) => item.coinId === coinId);
      const minConfidence = Number(pref?.minConfidence ?? 0.65);
      if (Number.isFinite(confidence) && confidence < minConfidence) {
        res.json({ data: { sent: false, reason: 'below-signal-confidence' } });
        return;
      }
    }

    if (type === 'MARKET_MOVE') {
      if (!settings.marketMoveEmail) {
        res.json({ data: { sent: false, reason: 'market-email-disabled' } });
        return;
      }
      if (Number.isFinite(changePct) && Math.abs(changePct) < Number(settings.marketMoveThreshold || 5)) {
        res.json({ data: { sent: false, reason: 'below-threshold' } });
        return;
      }
    }

    if (type === 'PORTFOLIO_TRIGGER' && !settings.portfolioEmail) {
      res.json({ data: { sent: false, reason: 'portfolio-email-disabled' } });
      return;
    }

    if (type === 'PORTFOLIO_VALUE' && !settings.portfolioValueEmail) {
      res.json({ data: { sent: false, reason: 'portfolio-value-email-disabled' } });
      return;
    }

    const throttleKey = `email:${type}:${coinId || 'account'}`;
    const cooldownMs = Math.max(Number(settings.emailFrequencyMinutes || config.emailMinGapMin), 5) * 60 * 1000;
    if (!user.canNotifyForKey(throttleKey, cooldownMs)) {
      res.json({ data: { sent: false, reason: 'cooldown-active' } });
      return;
    }

    await sendCustomNotificationEmail({
      to: user.email,
      subject: title,
      title,
      body,
      type,
      coinId,
      displayName,
      action,
      confidence,
      price,
      changePct,
      trigger,
    });
    user.markThrottle(throttleKey);
    await user.save();
    res.json({ data: { sent: true } });
  })
);

router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const coinId = req.query.coinId;
    const query = { alertDispatched: true, sourceType: 'raw' };
    if (coinId) {
      query.coinId = coinId;
    }
    const data = await Prediction.find(query).sort({ dispatchedAt: -1 }).limit(limit);
    res.json({ data });
  })
);

export default router;
