import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { config } from '../utils/limits.js';
import { badRequest, unauthorized } from '../utils/httpError.js';
import Prediction from '../models/Prediction.js';
import User from '../models/User.js';

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

const findOrCreateUser = async ({ email }) => {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, alertPreferences: config.coins.map((coinId) => ({ coinId, enabled: true })) });
    return user;
  }
  const mutated = ensureCoinPreferences(user);
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
      const enabled = preferences[coinId];
      if (pref) {
        pref.enabled = Boolean(enabled);
      } else {
        user.alertPreferences.push({ coinId, enabled: Boolean(enabled) });
      }
    }
    await user.save();
    res.json({ data: user.alertPreferences });
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
