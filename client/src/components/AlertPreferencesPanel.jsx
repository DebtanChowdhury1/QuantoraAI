import clsx from 'clsx';
import ToggleSwitch from '@/components/ToggleSwitch';

const normalizePreference = (value) =>
  typeof value === 'object'
    ? {
        enabled: Boolean(value.enabled),
        minConfidence: Number(value.minConfidence ?? 0.65),
        cooldownMinutes: Number(value.cooldownMinutes ?? 60),
      }
    : { enabled: Boolean(value), minConfidence: 0.65, cooldownMinutes: 60 };

const AlertPreferencesPanel = ({ preferences = {}, onToggle, onToggleAll, disabled }) => {
  const entries = Object.entries(preferences);

  return (
    <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Coin Signal Alerts</p>
          <h3 className="mt-2 text-lg font-semibold text-neutral-100">Choose coins for email signal alerts</h3>
          <p className="text-sm text-neutral-400">Turn individual BUY / HOLD / SELL email alerts on or off.</p>
        </div>
        {entries.length > 0 && onToggleAll && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggleAll(true)}
              className="rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-60"
            >
              All on
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggleAll(false)}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-60"
            >
              All off
            </button>
          </div>
        )}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {entries.map(([coinId, raw]) => {
          const pref = normalizePreference(raw);
          return (
            <div
              key={coinId}
              className={clsx(
                'flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition',
                pref.enabled
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-neutral-600/50 bg-neutral-800/70 text-neutral-300 hover:border-accent/40 hover:text-accent',
                disabled && 'cursor-not-allowed opacity-70'
              )}
            >
              <span>
                <span className="block font-semibold uppercase tracking-wide">{coinId}</span>
                <span className="mt-1 block text-xs text-neutral-400">
                  Min {(pref.minConfidence * 100).toFixed(0)}% confidence, {pref.cooldownMinutes}m cooldown
                </span>
              </span>
              <ToggleSwitch
                checked={pref.enabled}
                disabled={disabled}
                onChange={(next) => onToggle?.(coinId, next)}
                label={`${coinId} alert status`}
              />
            </div>
          );
        })}
        {!entries.length && (
          <div className="col-span-full rounded-2xl border border-neutral-600/30 bg-neutral-800/60 px-4 py-5 text-sm text-neutral-400">
            No alert preferences are configured yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertPreferencesPanel;
