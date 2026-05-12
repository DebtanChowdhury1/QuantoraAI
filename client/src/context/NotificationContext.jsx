import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAlertHistory,
  fetchInvestmentPlans,
  fetchMarkets,
  sendCustomNotificationEmail,
} from '@/lib/api';
import { ALERT_REFRESH_MS, MARKET_REFRESH_MS } from '@/lib/refreshIntervals';
import { formatConfidencePercent, formatCurrency, formatPercent } from '@/lib/formatters';
import { useUser } from '@/lib/authClient';

const NotificationContext = createContext(null);
const READ_KEY = 'quantora-read-notifications';
const SEEN_KEY = 'quantora-seen-notifications';
const SETTINGS_KEY = 'quantora-notification-settings';
const LOCAL_EVENTS_KEY = 'quantora-local-notification-events';

const readSettings = () => {
  try {
    return {
      pagePopups: true,
      browserPush: true,
      doNotDisturb: false,
      signalAlerts: true,
      marketMoveAlerts: true,
      portfolioAlerts: true,
      portfolioValueAlerts: true,
      marketMoveThreshold: 0.1,
      ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}'),
    };
  } catch {
    return {
      pagePopups: true,
      browserPush: true,
      doNotDisturb: false,
      signalAlerts: true,
      marketMoveAlerts: true,
      portfolioAlerts: true,
      portfolioValueAlerts: true,
      marketMoveThreshold: 0.1,
    };
  }
};

const readStorageSet = (key) => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
};

const writeStorageSet = (key, set) => {
  window.localStorage.setItem(key, JSON.stringify(Array.from(set).slice(0, 200)));
};

const localEventsKey = (email = '') =>
  `${LOCAL_EVENTS_KEY}:${String(email || 'guest').trim().toLowerCase()}`;

const readLocalEvents = (email) => {
  try {
    const events = JSON.parse(window.localStorage.getItem(localEventsKey(email)) || '[]');
    return Array.isArray(events) ? events.slice(0, 50) : [];
  } catch {
    return [];
  }
};

const writeLocalEvents = (email, events = []) => {
  if (!email) return;
  window.localStorage.setItem(localEventsKey(email), JSON.stringify(events.slice(0, 50)));
};

const alertId = (alert) => alert?._id || `${alert?.coinId}-${alert?.action}-${alert?.createdAt}`;

const baseAlertTitle = (alert) => {
  if (alert.type === 'TEST') {
    return 'Quantora popup test';
  }
  if (alert.type === 'MARKET_MOVE') {
    return `${String(alert.displayName || alert.coinId || '').toUpperCase()} ${alert.direction === 'UP' ? 'is up' : 'is down'} ${formatPercent(alert.change24h, 2)}`;
  }
  if (alert.type === 'PORTFOLIO_TRIGGER') {
    const name = alert.displayName || alert.coinId;
    if (alert.trigger === 'VALUE_CHANGE') return `Portfolio update: ${name}`;
    if (alert.trigger === 'REDUCE_RISK') return `Portfolio risk alert: ${name}`;
    if (alert.trigger === 'SIGNAL_SELL') return `Portfolio SELL signal: ${name}`;
    return `${alert.trigger === 'TAKE_PROFIT' ? 'Take-profit' : 'Stop-loss'} trigger: ${name}`;
  }
  if (alert.type === 'EMAIL_STATUS') {
    return alert.title || 'Email delivery needs attention';
  }
  return `${alert.action} ${String(alert.coinId || '').toUpperCase()} signal`;
};

const alertTitle = (alert, fallbackName = '') => {
  const title = baseAlertTitle(alert);
  const name = alert.recipientName || fallbackName;
  return name ? `Hi ${name}, ${title}` : title;
};

const alertGreeting = (alert, fallbackName = '') => {
  const name = alert.recipientName || fallbackName;
  if (!name) return 'Quantora alert';
  return `Hi ${name}`;
};

const alertBody = (alert) =>
  alert.type === 'TEST'
    ? 'Page popup notifications are working.'
    : alert.type === 'EMAIL_STATUS'
    ? alert.reason || 'Email was skipped by your notification settings.'
    : alert.type === 'MARKET_MOVE'
    ? `${String(alert.displayName || alert.coinId || 'Coin').toUpperCase()} moved beyond your alert threshold. Live price is ${formatCurrency(alert.marketPrice, { currency: 'USD' })}, with a 24h move of ${formatPercent(alert.change24h, 2)}. Review trend strength, volatility, and your portfolio exposure before acting.`
    : alert.type === 'PORTFOLIO_TRIGGER'
      ? alert.triggerPrice
        ? `${formatCurrency(alert.marketPrice, { currency: 'USD' })} touched ${formatCurrency(alert.triggerPrice, { currency: 'USD' })}`
        : alert.reason || `${formatCurrency(alert.marketPrice, { currency: 'USD' })} needs portfolio review`
      : `${formatCurrency(alert.marketPrice, { currency: 'USD' })} - Confidence ${formatConfidencePercent(alert.confidence)}`;

const portfolioFieldLabels = {
  price: 'live price',
  pnlUsd: 'P/L value',
  pnlPct: 'P/L percent',
  signal: 'AI signal',
  confidence: 'confidence',
  stop: 'stop review zone',
  profit: 'profit target',
};

const formatChangedFields = (fields) =>
  fields.map((field) => portfolioFieldLabels[field] || field).join(', ');

const getUserEmail = (user) =>
  user?.primaryEmailAddress?.emailAddress ||
  user?.emailAddresses?.[0]?.emailAddress ||
  user?.externalAccounts?.[0]?.emailAddress ||
  '';

const accountSessionId = (email) => `account:${String(email || '').trim().toLowerCase()}`;

const getEmailType = (alert) => {
  if (alert.type === 'TEST' || alert.type === 'EMAIL_STATUS') return null;
  if (alert.type === 'MARKET_MOVE') return 'MARKET_MOVE';
  if (alert.type === 'PORTFOLIO_TRIGGER') {
    return alert.trigger === 'VALUE_CHANGE' ? 'PORTFOLIO_VALUE' : 'PORTFOLIO_TRIGGER';
  }
  return 'SIGNAL';
};

const emailSkipMessage = (reason, alert) => {
  const coin = String(alert?.displayName || alert?.coinId || 'This coin').toUpperCase();
  const messages = {
    'coin-not-selected': `${coin} is not selected for email alerts. Open Notifications, select this coin, or press Select all.`,
    'below-threshold': `${coin} did not move enough to pass your coin-move email threshold. Lower the threshold if you want smaller moves emailed.`,
    'cooldown-active': `Email cooldown is active for ${coin}. Quantora will email again after your selected frequency window passes.`,
    'email-disabled': 'Email notifications are turned off. Enable the master email switch in Notifications.',
    'signal-email-disabled': 'AI signal emails are turned off. Enable AI signal emails in Notifications.',
    'market-email-disabled': 'Coin up/down emails are turned off. Enable coin move emails in Notifications.',
    'portfolio-email-disabled': 'Portfolio trigger emails are turned off. Enable portfolio trigger emails in Notifications.',
    'portfolio-value-email-disabled': 'Portfolio value-change emails are turned off. Enable portfolio value-change emails in Notifications.',
    'below-signal-confidence': `${coin} signal confidence is below your minimum email confidence setting.`,
  };
  return messages[reason] || `Email was skipped by notification rule: ${reason || 'unknown'}.`;
};

const getPortfolioSessionId = () => {
  const key = 'quantora-investment-session';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next =
    window.crypto?.randomUUID?.() || `quantora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
};

export const NotificationProvider = ({ children }) => {
  const { isSignedIn, user } = useUser();
  const recipientName = useMemo(
    () => user?.firstName || user?.fullName?.split(' ')?.[0] || user?.username || '',
    [user]
  );
  const identity = useMemo(() => {
    if (!isSignedIn || !user) return null;
    return {
      clerkId: user.id,
      email: getUserEmail(user),
    };
  }, [isSignedIn, user]);
  const [readIds, setReadIds] = useState(() => readStorageSet(READ_KEY));
  const [seenIds, setSeenIds] = useState(() => readStorageSet(SEEN_KEY));
  const [settings, setSettings] = useState(readSettings);
  const [toasts, setToasts] = useState([]);
  const [localEvents, setLocalEvents] = useState([]);
  const [permission, setPermission] = useState(() =>
    typeof window === 'undefined' || !('Notification' in window)
      ? 'unsupported'
      : window.Notification.permission
  );
  const [pushError, setPushError] = useState('');
  const initializedRef = useRef(false);
  const eventThrottleRef = useRef(new Map());
  const portfolioSnapshotRef = useRef(new Map());

  useEffect(() => {
    if (!identity?.email) {
      setLocalEvents([]);
      return;
    }
    setLocalEvents(readLocalEvents(identity.email));
  }, [identity?.email]);

  useEffect(() => {
    if (!identity?.email) return;
    writeLocalEvents(identity.email, localEvents);
  }, [identity?.email, localEvents]);

  const historyQuery = useQuery({
    queryKey: ['global-notifications', identity?.clerkId],
    queryFn: async () => {
      const response = await fetchAlertHistory({ limit: 50 });
      return response.data || [];
    },
    enabled: Boolean(isSignedIn),
    refetchInterval: ALERT_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const alerts = useMemo(() => (isSignedIn ? historyQuery.data || [] : []), [historyQuery.data, isSignedIn]);

  const marketsQuery = useQuery({
    queryKey: ['notification-market-moves'],
    queryFn: fetchMarkets,
    enabled: Boolean(isSignedIn && settings.marketMoveAlerts),
    refetchInterval: MARKET_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const portfolioSessionId = useMemo(
    () => (identity?.email ? accountSessionId(identity.email) : getPortfolioSessionId()),
    [identity?.email]
  );
  const portfolioQuery = useQuery({
    queryKey: ['notification-portfolio', portfolioSessionId],
    queryFn: async () => {
      const response = await fetchInvestmentPlans(portfolioSessionId);
      return response.data || [];
    },
    enabled: Boolean(
      isSignedIn && (settings.portfolioAlerts || settings.portfolioValueAlerts) && portfolioSessionId
    ),
    refetchInterval: MARKET_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const showBrowserNotification = useCallback((alert) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setPushError('This browser does not support push notifications.');
      return false;
    }

    if (window.Notification.permission !== 'granted') {
      setPermission(window.Notification.permission);
      setPushError('Browser permission is not granted yet.');
      return false;
    }

    try {
      const notification = new window.Notification(alertTitle(alert), {
        body: alertBody(alert),
        tag: alertId(alert),
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign('/alerts');
      };
      setPushError('');
      return true;
    } catch (error) {
      setPushError(error?.message || 'Browser blocked the notification.');
      return false;
    }
  }, []);

  const publishEvents = useCallback(
    (events) => {
      if (!isSignedIn || !events.length) return;
      const personalizedEvents = events.map((alert) => ({
        ...alert,
        recipientName,
      }));
      setLocalEvents((current) =>
        [...personalizedEvents, ...current]
          .filter((alert, index, list) => list.findIndex((item) => alertId(item) === alertId(alert)) === index)
          .slice(0, 50)
      );
      if (settings.pagePopups && !settings.doNotDisturb) {
        setToasts((current) => [...personalizedEvents.slice(0, 6), ...current].slice(0, 6));
      }
      if (settings.browserPush && !settings.doNotDisturb && permission === 'granted') {
        personalizedEvents.slice(0, 3).forEach((alert) => showBrowserNotification(alert));
      }

      if (identity?.email) {
        personalizedEvents
          .map((alert) => ({ alert, emailType: getEmailType(alert) }))
          .filter(({ emailType }) => Boolean(emailType))
          .forEach(({ alert, emailType }) => {
            sendCustomNotificationEmail({
              ...identity,
              type: emailType,
              coinId: String(alert.coinId || '').toLowerCase(),
              title: alertTitle(alert),
              body: alertBody(alert),
              action: alert.action,
              displayName: alert.displayName,
              marketPrice: alert.marketPrice,
              changePct: alert.change24h,
              confidence: alert.confidence,
              trigger: alert.trigger,
            })
              .then((response) => {
                const result = response?.data;
                if (!result || result.sent !== false) return;
                const key = `email-status:${result.reason}:${String(alert.coinId || 'account').toLowerCase()}`;
                const last = eventThrottleRef.current.get(key) || 0;
                if (Date.now() - last < 60 * 1000) return;
                eventThrottleRef.current.set(key, Date.now());
                const statusEvent = {
                  _id: `${key}:${Date.now()}`,
                  type: 'EMAIL_STATUS',
                  action: 'UPDATE',
                  recipientName,
                  title: 'Email skipped by settings',
                  reason: emailSkipMessage(result.reason, alert),
                  createdAt: new Date().toISOString(),
                };
                setLocalEvents((current) => [statusEvent, ...current].slice(0, 50));
              })
              .catch((error) => {
                const key = 'email-status:delivery-failed';
                const last = eventThrottleRef.current.get(key) || 0;
                if (Date.now() - last < 60 * 1000) return;
                eventThrottleRef.current.set(key, Date.now());
                const statusEvent = {
                  _id: `${key}:${Date.now()}`,
                  type: 'EMAIL_STATUS',
                  action: 'STOP',
                  recipientName,
                  title: 'Email delivery failed',
                  reason: error?.message || 'Quantora could not deliver the email notification.',
                  createdAt: new Date().toISOString(),
                };
                setLocalEvents((current) => [statusEvent, ...current].slice(0, 50));
                if (settings.pagePopups && !settings.doNotDisturb) {
                  setToasts((current) => [statusEvent, ...current].slice(0, 6));
                }
              });
          });
      }
    },
    [identity, isSignedIn, permission, recipientName, settings.browserPush, settings.doNotDisturb, settings.pagePopups, showBrowserNotification]
  );

  useEffect(() => {
    if (!isSignedIn) {
      setToasts([]);
      setLocalEvents([]);
      return;
    }
    if (!alerts.length) return;

    const nextSeen = new Set(seenIds);
    const newAlerts = alerts.filter((alert) => {
      const id = alertId(alert);
      return id && !nextSeen.has(id);
    });

    alerts.forEach((alert) => {
      const id = alertId(alert);
      if (id) nextSeen.add(id);
    });

    if (!initializedRef.current) {
      initializedRef.current = true;
      setSeenIds(nextSeen);
      writeStorageSet(SEEN_KEY, nextSeen);
      return;
    }

    if (newAlerts.length) {
      if (settings.signalAlerts) {
        publishEvents(newAlerts);
      }
      setSeenIds(nextSeen);
      writeStorageSet(SEEN_KEY, nextSeen);
    }
  }, [alerts, isSignedIn, publishEvents, seenIds, settings.signalAlerts]);

  useEffect(() => {
    const markets = marketsQuery.data?.data || [];
    if (!settings.marketMoveAlerts || !markets.length) return;

    const threshold = Math.max(Number(settings.marketMoveThreshold) || 5, 0.1);
    const now = Date.now();
    const events = [];

    markets.forEach((coin) => {
      const change = Number(coin.price_change_percentage_24h);
      const price = Number(coin.current_price);
      if (!Number.isFinite(change) || !Number.isFinite(price) || Math.abs(change) < threshold) return;
      const direction = change >= 0 ? 'UP' : 'DOWN';
      const key = `market:${coin.id}:${direction}:${Math.floor(Math.abs(change) * 10) / 10}`;
      const last = eventThrottleRef.current.get(key) || 0;
      if (now - last < 15 * 60 * 1000) return;
      eventThrottleRef.current.set(key, now);
      events.push({
        _id: key,
        type: 'MARKET_MOVE',
        action: direction === 'UP' ? 'UP' : 'DOWN',
        direction,
        coinId: coin.id,
        displayName: coin.symbol || coin.id,
        marketPrice: price,
        change24h: change,
        createdAt: new Date().toISOString(),
      });
    });

    publishEvents(events);
  }, [marketsQuery.data, publishEvents, settings.marketMoveAlerts, settings.marketMoveThreshold]);

  useEffect(() => {
    const plans = portfolioQuery.data || [];
    if ((!settings.portfolioAlerts && !settings.portfolioValueAlerts) || !plans.length) return;

    const now = Date.now();
    const events = [];

    plans.forEach((item) => {
      if (item.error) return;
      const price = Number(item.market?.currentPrice);
      const stop = Number(item.recommendation?.suggestedStop || item.exitPlan?.stopTarget);
      const profit = Number(item.recommendation?.suggestedProfit || item.exitPlan?.profitTarget);
      if (!Number.isFinite(price)) return;
      const planId = item.plan?._id || item.plan?.coinId;
      const currentSnapshot = {
        price: Number(price.toFixed(price >= 1 ? 2 : 8)),
        pnlPct: Number(item.position?.pnlPct || 0).toFixed(3),
        pnlUsd: Number(item.position?.pnlUsd || 0).toFixed(2),
        signal: item.signal?.action || 'HOLD',
        confidence: Number(item.signal?.confidence || 0).toFixed(4),
        stop: Number.isFinite(stop) ? Number(stop.toFixed(stop >= 1 ? 2 : 8)) : null,
        profit: Number.isFinite(profit) ? Number(profit.toFixed(profit >= 1 ? 2 : 8)) : null,
      };
      const previousSnapshot = portfolioSnapshotRef.current.get(planId);

      if (settings.portfolioValueAlerts && previousSnapshot) {
        const changedFields = Object.entries(currentSnapshot)
          .filter(([key, value]) => previousSnapshot[key] !== value)
          .map(([key]) => key);
        const key = `portfolio:${planId}:VALUE_CHANGE`;
        const last = eventThrottleRef.current.get(key) || 0;

        if (changedFields.length && now - last >= 4 * 1000) {
          eventThrottleRef.current.set(key, now);
          events.push({
            _id: `${key}:${now}`,
            type: 'PORTFOLIO_TRIGGER',
            action: 'UPDATE',
            trigger: 'VALUE_CHANGE',
            coinId: item.plan?.coinId,
            displayName: `${item.market?.name || item.plan?.coinId}`,
            marketPrice: price,
            triggerPrice: null,
            reason:
              item.plan?.status === 'OPEN'
                ? `${item.market?.name || item.plan?.coinId} portfolio changed: ${formatChangedFields(changedFields)}. Current P/L: ${formatCurrency(Number(currentSnapshot.pnlUsd), { currency: 'USD' })} / ${currentSnapshot.pnlPct}%.`
                : `${item.market?.name || item.plan?.coinId} planned case changed: ${formatChangedFields(changedFields)}. Live price: ${formatCurrency(price, { currency: 'USD' })}.`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      portfolioSnapshotRef.current.set(planId, currentSnapshot);

      if (!settings.portfolioAlerts || item.plan?.status !== 'OPEN') return;

      [
        { trigger: 'STOP_LOSS', triggerPrice: stop, hit: Number.isFinite(stop) && price <= stop },
        { trigger: 'TAKE_PROFIT', triggerPrice: profit, hit: Number.isFinite(profit) && price >= profit },
        {
          trigger: 'REDUCE_RISK',
          triggerPrice: null,
          hit: item.recommendation?.stance === 'REDUCE_RISK',
          reason: item.recommendation?.guidance || 'Quantora changed this position into a defensive risk state.',
        },
        {
          trigger: 'SIGNAL_SELL',
          triggerPrice: null,
          hit: item.signal?.action === 'SELL',
          reason: 'The latest AI signal for this saved position is SELL.',
        },
      ].forEach((entry) => {
        if (!entry.hit) return;
        const key = `portfolio:${item.plan?._id}:${entry.trigger}`;
        const last = eventThrottleRef.current.get(key) || 0;
        if (now - last < 15 * 60 * 1000) return;
        eventThrottleRef.current.set(key, now);
        events.push({
          _id: key,
          type: 'PORTFOLIO_TRIGGER',
          action: entry.trigger === 'TAKE_PROFIT' ? 'PROFIT' : 'STOP',
          trigger: entry.trigger,
          coinId: item.plan?.coinId,
          displayName: `${item.market?.name || item.plan?.coinId}`,
          marketPrice: price,
          triggerPrice: entry.triggerPrice,
          reason: entry.reason,
          createdAt: new Date().toISOString(),
        });
      });
    });

    publishEvents(events);
  }, [portfolioQuery.data, publishEvents, settings.portfolioAlerts, settings.portfolioValueAlerts]);

  const updateNotificationSetting = useCallback((key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      if (key === 'pagePopups' && !value) {
        setToasts([]);
      }
      if (key === 'doNotDisturb' && value) {
        setToasts([]);
      }
      return next;
    });
  }, []);

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setPushError('This browser does not support push notifications.');
      return 'unsupported';
    }
    if (!window.isSecureContext) {
      setPermission('unsupported');
      setPushError('Browser push requires localhost or HTTPS.');
      return 'unsupported';
    }

    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setPushError('');
        showBrowserNotification({
          _id: `push-enabled:${Date.now()}`,
          type: 'TEST',
          action: 'HOLD',
          coinId: 'quantora',
          marketPrice: 0,
          confidence: 1,
          createdAt: new Date().toISOString(),
        });
      } else if (result === 'denied') {
        setPushError('Browser notifications are blocked. Enable them in site settings.');
      } else {
        setPushError('Browser permission was not granted.');
      }
      return result;
    } catch (error) {
      setPushError(error?.message || 'Unable to request browser notification permission.');
      return 'denied';
    }
  }, [showBrowserNotification]);

  const sendTestBrowserPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setPushError('This browser does not support push notifications.');
      return;
    }

    if (window.Notification.permission !== 'granted') {
      await requestBrowserNotifications();
      return;
    }

    showBrowserNotification({
      _id: `browser-test:${Date.now()}`,
      type: 'TEST',
      action: 'HOLD',
      coinId: 'quantora',
      marketPrice: 0,
      confidence: 1,
      createdAt: new Date().toISOString(),
    });
  }, [requestBrowserNotifications, showBrowserNotification]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((alert) => alertId(alert) !== id));
  }, []);

  useEffect(() => {
    if (!toasts.length) return undefined;

    const timers = toasts.map((alert) =>
      window.setTimeout(() => dismissToast(alertId(alert)), 4000)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  const markAllRead = useCallback(() => {
    const next = new Set(readIds);
    alerts.forEach((alert) => {
      const id = alertId(alert);
      if (id) next.add(id);
    });
    setReadIds(next);
    writeStorageSet(READ_KEY, next);
  }, [alerts, readIds]);

  const unreadCount = useMemo(
    () => (isSignedIn ? alerts.filter((alert) => !readIds.has(alertId(alert))).length : 0),
    [alerts, isSignedIn, readIds]
  );
  const notificationHistory = useMemo(
    () =>
      isSignedIn
        ? [...localEvents, ...alerts]
        .filter((alert, index, list) => list.findIndex((item) => alertId(item) === alertId(alert)) === index)
        .sort((a, b) => new Date(b.createdAt || b.dispatchedAt || 0) - new Date(a.createdAt || a.dispatchedAt || 0))
        .slice(0, 20)
        : [],
    [alerts, isSignedIn, localEvents]
  );

  const sendTestNotification = useCallback(() => {
    publishEvents([
      {
        _id: `test:${Date.now()}`,
        type: 'TEST',
        action: 'HOLD',
        coinId: 'quantora',
        marketPrice: 0,
        confidence: 1,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [publishEvents]);

  const value = useMemo(
    () => ({
      alerts,
      notificationHistory,
      unreadCount,
      toasts,
      recipientName,
      permission,
      pushError,
      settings,
      notificationQuery: historyQuery,
      requestBrowserNotifications,
      sendTestBrowserPush,
      updateNotificationSetting,
      sendTestNotification,
      markAllRead,
      dismissToast,
    }),
    [alerts, notificationHistory, unreadCount, toasts, recipientName, permission, pushError, settings, historyQuery, requestBrowserNotifications, sendTestBrowserPush, updateNotificationSetting, sendTestNotification, markAllRead, dismissToast]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used inside NotificationProvider');
  }
  return context;
};

export { alertGreeting, alertId, alertTitle, alertBody };
