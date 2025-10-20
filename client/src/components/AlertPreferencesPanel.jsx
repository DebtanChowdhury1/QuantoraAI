import clsx from 'clsx';

const AlertPreferencesPanel = ({ preferences = {}, onToggle, disabled }) => (
  <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
    <h3 className="text-lg font-semibold text-neutral-100">Alert Preferences</h3>
    <p className="text-sm text-neutral-400">Manage per-coin notifications (cooldown 60 min)</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {Object.entries(preferences).map(([coinId, enabled]) => (
        <button
          key={coinId}
          type="button"
          disabled={disabled}
          onClick={() => onToggle?.(coinId, !enabled)}
          className={clsx(
            'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition',
            enabled
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-neutral-600/50 bg-neutral-700/20 text-neutral-300 hover:border-accent/40 hover:text-accent',
            disabled && 'cursor-not-allowed opacity-70'
          )}
        >
          <span className="font-semibold uppercase tracking-wide">{coinId}</span>
          <span className="text-xs">{enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      ))}
      {!Object.keys(preferences).length && (
        <p className="col-span-full text-sm text-neutral-400">No coins configured</p>
      )}
    </div>
  </div>
);

export default AlertPreferencesPanel;
