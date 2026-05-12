import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/context/NotificationContext';
import ToggleSwitch from '@/components/ToggleSwitch';
import { SignedIn, SignInButton, useUser } from '@/lib/authClient';
import {
  fetchEmailNotificationSettings,
  updateEmailNotificationSettings,
} from '@/lib/api';

const statusText = {
  granted: 'Browser push notifications are enabled.',
  denied: 'Browser notifications are blocked in this browser.',
  default: 'Browser push notifications are not enabled yet.',
  unsupported: 'Browser notifications are not supported here.',
};

const defaultEmailSettings = {
  emailEnabled: true,
  signalEmail: true,
  marketMoveEmail: true,
  portfolioEmail: true,
  portfolioValueEmail: true,
  emailFrequencyMinutes: 60,
  marketMoveThreshold: 5,
  selectedCoins: [],
};

const fallbackCoins = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'solana',
  'ripple',
  'dogecoin',
  'cardano',
  'tron',
  'avalanche-2',
  'chainlink',
  'polkadot',
  'litecoin',
  'bitcoin-cash',
  'stellar',
  'near',
  'uniswap',
  'aptos',
  'arbitrum',
  'optimism',
  'shiba-inu',
  'sui',
  'hedera',
  'the-open-network',
  'pepe',
  'internet-computer',
  'filecoin',
  'render-token',
  'cosmos',
  'injective-protocol',
  'aave',
  'maker',
  'lido-dao',
  'ethereum-classic',
  'vechain',
  'algorand',
  'quant-network',
  'polygon-ecosystem-token',
  'immutable-x',
  'fetch-ai',
  'celestia',
  'sei-network',
  'bonk',
  'floki',
];

const clampThreshold = (value) => {
  const numeric = Number(String(value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric)) return 5;
  return Math.min(Math.max(Number(numeric.toFixed(1)), 0.1), 50);
};

const formatThreshold = (value) => clampThreshold(value).toFixed(1).replace(/\.0$/, '');

const getUserEmail = (user) =>
  user?.primaryEmailAddress?.emailAddress ||
  user?.emailAddresses?.[0]?.emailAddress ||
  user?.externalAccounts?.[0]?.emailAddress ||
  '';

const NotificationControls = () => {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const {
    permission,
    pushError,
    settings,
    requestBrowserNotifications,
    sendTestBrowserPush,
    updateNotificationSetting,
    sendTestNotification,
    markAllRead,
    unreadCount,
  } = useNotifications();

  const identity = useMemo(() => {
    if (!isSignedIn || !user) return null;
    return {
      clerkId: user.id,
      email: getUserEmail(user),
    };
  }, [isSignedIn, user]);

  const emailSettingsQuery = useQuery({
    queryKey: ['email-notification-settings', identity?.clerkId],
    enabled: Boolean(identity?.email),
    queryFn: async () => {
      const response = await fetchEmailNotificationSettings(identity);
      return {
        settings: { ...defaultEmailSettings, ...(response.data || {}) },
        coins: response.meta?.coins || [],
      };
    },
  });

  const emailMutation = useMutation({
    mutationFn: (emailSettings) => updateEmailNotificationSettings({ ...identity, settings: emailSettings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-notification-settings', identity?.clerkId] });
    },
  });

  const emailSettings = emailSettingsQuery.data?.settings || defaultEmailSettings;
  const coins = emailSettingsQuery.data?.coins?.length ? emailSettingsQuery.data.coins : fallbackCoins;
  const selectedCoins = new Set(emailSettings.selectedCoins || []);
  const saveEmailSettings = (patch) => {
    const nextSettings = { ...emailSettings, ...patch };
    queryClient.setQueryData(['email-notification-settings', identity?.clerkId], (current) => ({
      settings: nextSettings,
      coins: current?.coins || coins,
    }));
    if (!identity?.email) return;
    emailMutation.mutate(nextSettings);
  };
  const toggleEmailCoin = (coinId, enabled) => {
    const next = new Set(selectedCoins);
    if (enabled) next.add(coinId);
    else next.delete(coinId);
    saveEmailSettings({ selectedCoins: Array.from(next) });
  };

  if (!isSignedIn) {
    return (
      <section className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 text-sm text-neutral-200 shadow-glow">
        <p>Sign in to view notification history and receive personalized market, portfolio, email, and popup alerts.</p>
        <SignInButton mode="modal">
          <button
            type="button"
            className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-background"
          >
            Sign In
          </button>
        </SignInButton>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <SignedIn>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-accent/25 bg-neutral-900/80 p-5 shadow-glow">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Notification Delivery</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50">Email, browser push, and page popups</h2>
              <p className="mt-1 text-sm text-neutral-400">
                {settings.doNotDisturb
                  ? 'Do Not Disturb is active. Page popups and browser push are paused.'
                  : statusText[permission] || statusText.default}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Notifications are personalized to your signed-in Quantora account.
              </p>
              {pushError && <p className="mt-2 text-xs font-semibold text-red-300">{pushError}</p>}
            </div>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold/10 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">Do Not Disturb</span>
                  <span className="text-[11px] text-neutral-500">
                    Keep email and history active, but hide page popups and browser push.
                  </span>
                </span>
                <ToggleSwitch
                  checked={settings.doNotDisturb}
                  onChange={(next) => updateNotificationSetting('doNotDisturb', next)}
                  label="Do Not Disturb notifications"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">Page popups</span>
                  <span className="text-[11px] text-neutral-500">
                    {settings.doNotDisturb
                      ? 'Saved setting. DND is currently hiding popups.'
                      : 'Show alert popup inside Quantora'}
                  </span>
                </span>
                <ToggleSwitch
                  checked={settings.pagePopups}
                  onChange={(next) => updateNotificationSetting('pagePopups', next)}
                  label="Page popup notifications"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">Browser push</span>
                  <span className="text-[11px] text-neutral-500">
                    {settings.doNotDisturb
                      ? 'Saved setting. DND is currently hiding browser push.'
                      : 'System notification when browser allows it'}
                  </span>
                </span>
                <ToggleSwitch
                  checked={settings.browserPush}
                  disabled={permission === 'unsupported'}
                  onChange={(next) => updateNotificationSetting('browserPush', next)}
                  label="Browser push notifications"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={requestBrowserNotifications}
                disabled={permission === 'unsupported' || settings.doNotDisturb}
                className="rounded-full border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {permission === 'granted' ? 'Push enabled' : 'Enable push'}
              </button>
              <button
                type="button"
                onClick={sendTestBrowserPush}
                disabled={permission === 'unsupported' || settings.doNotDisturb}
                className="rounded-full border border-accent/50 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Test browser push
              </button>
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-semibold text-neutral-300 transition hover:border-accent/40 hover:text-accent"
              >
                Mark read {unreadCount ? `(${unreadCount})` : ''}
              </button>
              <button
                type="button"
                onClick={sendTestNotification}
                className="rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold transition hover:bg-gold/15"
              >
                Test popup
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Alert Sources</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-50">What should notify you</h2>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">AI signal alerts</span>
                  <span className="text-[11px] text-neutral-500">BUY / HOLD / SELL alerts from backend signal history</span>
                </span>
                <ToggleSwitch
                  checked={settings.signalAlerts}
                  onChange={(next) => updateNotificationSetting('signalAlerts', next)}
                  label="AI signal notifications"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">Any coin up/down</span>
                  <span className="text-[11px] text-neutral-500">Notify when a tracked coin moves beyond the threshold</span>
                </span>
                <ToggleSwitch
                  checked={settings.marketMoveAlerts}
                  onChange={(next) => updateNotificationSetting('marketMoveAlerts', next)}
                  label="Market movement notifications"
                />
              </div>
              <label className="rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span className="block text-xs font-semibold text-neutral-100">Move threshold</span>
                <PercentStepper
                  value={settings.marketMoveThreshold}
                  onChange={(value) => updateNotificationSetting('marketMoveThreshold', value)}
                />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">Portfolio sell triggers</span>
                  <span className="text-[11px] text-neutral-500">Notify on stop-loss, take-profit, SELL signal, or defensive risk state</span>
                </span>
                <ToggleSwitch
                  checked={settings.portfolioAlerts}
                  onChange={(next) => updateNotificationSetting('portfolioAlerts', next)}
                  label="Portfolio trigger notifications"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
                <span>
                  <span className="block text-xs font-semibold text-neutral-100">Portfolio value changes</span>
                  <span className="text-[11px] text-neutral-500">Notify when saved case price, P/L, signal, confidence, stop, or target changes</span>
                </span>
                <ToggleSwitch
                  checked={settings.portfolioValueAlerts}
                  onChange={(next) => updateNotificationSetting('portfolioValueAlerts', next)}
                  label="Portfolio value change notifications"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-accent/25 bg-neutral-900/80 p-5 shadow-glow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Email Routing</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50">Email notification settings</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Choose exactly what Quantora emails you, how often, and which coins can trigger messages.
              </p>
            </div>
            {emailMutation.isPending && <p className="text-xs text-neutral-400">Saving...</p>}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <EmailSettingRow
              title="Email notifications"
              description="Master switch for all email delivery."
              checked={emailSettings.emailEnabled}
              onChange={(next) => saveEmailSettings({ emailEnabled: next })}
            />
            <EmailSettingRow
              title="AI signal emails"
              description="BUY / HOLD / SELL messages for selected coins."
              checked={emailSettings.signalEmail}
              onChange={(next) => saveEmailSettings({ signalEmail: next })}
            />
            <EmailSettingRow
              title="Coin up/down emails"
              description="Email when selected coins move beyond your threshold."
              checked={emailSettings.marketMoveEmail}
              onChange={(next) => saveEmailSettings({ marketMoveEmail: next })}
            />
            <EmailSettingRow
              title="Portfolio trigger emails"
              description="Stop, profit, SELL signal, and defensive risk messages."
              checked={emailSettings.portfolioEmail}
              onChange={(next) => saveEmailSettings({ portfolioEmail: next })}
            />
            <EmailSettingRow
              title="Portfolio value-change emails"
              description="Price, P/L, signal, confidence, stop, and profit updates."
              checked={emailSettings.portfolioValueEmail}
              onChange={(next) => saveEmailSettings({ portfolioValueEmail: next })}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-neutral-700 bg-neutral-950/70 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Email frequency</span>
              <select
                value={emailSettings.emailFrequencyMinutes}
                onChange={(event) => saveEmailSettings({ emailFrequencyMinutes: Number(event.target.value) })}
                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent/60"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour</option>
                <option value={240}>Every 4 hours</option>
                <option value={1440}>Once per day</option>
              </select>
            </label>
            <label className="rounded-xl border border-neutral-700 bg-neutral-950/70 p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Coin move email threshold</span>
              <PercentStepper
                value={emailSettings.marketMoveThreshold}
                onChange={(value) => saveEmailSettings({ marketMoveThreshold: value })}
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-neutral-700/70 bg-neutral-950/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-100">Coins allowed to email you</h3>
                <p className="text-xs text-neutral-500">Used by AI signal emails and coin up/down emails.</p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {selectedCoins.size} of {coins.length} coins selected
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!coins.length || emailMutation.isPending}
                  onClick={() => saveEmailSettings({ selectedCoins: coins })}
                  className="rounded-full border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={!coins.length || emailMutation.isPending}
                  onClick={() => saveEmailSettings({ selectedCoins: [] })}
                  className="rounded-full border border-neutral-600 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-red-400/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-4 grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {coins.map((coinId) => (
                <div
                  key={coinId}
                  className="flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-900/80 px-3 py-2"
                >
                  <span className="truncate pr-3 text-sm font-semibold uppercase text-neutral-100">{coinId}</span>
                  <ToggleSwitch
                    checked={selectedCoins.has(coinId)}
                    onChange={(next) => toggleEmailCoin(coinId, next)}
                    label={`${coinId} email notifications`}
                  />
                </div>
              ))}
            </div>
            {emailSettingsQuery.isLoading && <p className="mt-4 text-sm text-neutral-400">Loading email settings...</p>}
            {emailSettingsQuery.isError && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                Unable to load coin email settings. Confirm you are signed in with an email address.
              </p>
            )}
            {!emailSettingsQuery.isLoading && !emailSettingsQuery.isError && !coins.length && (
              <p className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
                No coins loaded for email routing yet. Refresh after sign-in finishes, or check your account email.
              </p>
            )}
          </div>
        </div>
      </SignedIn>
    </section>
  );
};

const EmailSettingRow = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-700 bg-neutral-950/70 px-3 py-2">
    <span>
      <span className="block text-sm font-semibold text-neutral-100">{title}</span>
      <span className="text-xs text-neutral-500">{description}</span>
    </span>
    <ToggleSwitch checked={checked} onChange={onChange} label={title} />
  </div>
);

const PercentStepper = ({ value, onChange }) => {
  const current = clampThreshold(value);
  const [draft, setDraft] = useState(formatThreshold(current));
  const step = (delta) => onChange(clampThreshold(current + delta));

  useEffect(() => {
    setDraft(formatThreshold(current));
  }, [current]);

  const commitDraft = () => {
    const next = clampThreshold(draft);
    setDraft(formatThreshold(next));
    onChange(next);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 focus-within:border-accent/60">
        <button
          type="button"
          onClick={() => step(-0.1)}
          className="grid h-10 w-10 place-items-center border-r border-neutral-800 text-lg font-semibold text-neutral-300 transition hover:bg-neutral-800 hover:text-accent"
          aria-label="Decrease threshold"
        >
          -
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d.]/g, '');
            const parts = next.split('.');
            setDraft(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : next);
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          className="h-10 w-20 bg-neutral-950 px-3 text-center text-sm font-semibold text-neutral-100 outline-none"
          aria-label="Percentage threshold"
        />
        <button
          type="button"
          onClick={() => step(0.1)}
          className="grid h-10 w-10 place-items-center border-l border-neutral-800 text-lg font-semibold text-neutral-300 transition hover:bg-neutral-800 hover:text-accent"
          aria-label="Increase threshold"
        >
          +
        </button>
      </div>
      <span className="text-xs text-neutral-400">% 24h move</span>
    </div>
  );
};

export default NotificationControls;
