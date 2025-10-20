import mongoose from 'mongoose';
import { config } from '../utils/limits.js';

const AlertPreferenceSchema = new mongoose.Schema(
  {
    coinId: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    alertPreferences: {
      type: [AlertPreferenceSchema],
      default: () => config.coins.map((coinId) => ({ coinId, enabled: true })),
    },
    notificationThrottle: {
      type: Map,
      of: Date,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
  }
);

const ensureThrottleMap = (doc) => {
  if (!(doc.notificationThrottle instanceof Map)) {
    const entries = Object.entries(doc.notificationThrottle || {}).map(([key, value]) => [
      key,
      value instanceof Date ? value : new Date(value),
    ]);
    doc.notificationThrottle = new Map(entries);
  }
};

UserSchema.methods.ensureDefaultPreferences = function ensureDefaultPreferences(coins) {
  const set = new Set(this.alertPreferences.map((pref) => pref.coinId));
  let mutated = false;
  for (const coinId of coins) {
    if (!set.has(coinId)) {
      this.alertPreferences.push({ coinId, enabled: true });
      mutated = true;
    }
  }
  return mutated;
};

UserSchema.methods.canNotifyForCoin = function canNotifyForCoin(coinId, cooldownMs) {
  ensureThrottleMap(this);
  const pref = this.alertPreferences.find((item) => item.coinId === coinId);
  if (!pref || !pref.enabled) {
    return false;
  }
  const lastSent = this.notificationThrottle.get(coinId);
  if (!lastSent) {
    return true;
  }
  return Date.now() - lastSent.getTime() >= cooldownMs;
};

UserSchema.methods.markThrottle = function markThrottle(coinId) {
  ensureThrottleMap(this);
  this.notificationThrottle.set(coinId, new Date());
};

UserSchema.methods.getThrottleSnapshot = function getThrottleSnapshot() {
  ensureThrottleMap(this);
  return Object.fromEntries(
    Array.from(this.notificationThrottle.entries()).map(([key, value]) => [
      key,
      value instanceof Date ? value : new Date(value),
    ])
  );
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
