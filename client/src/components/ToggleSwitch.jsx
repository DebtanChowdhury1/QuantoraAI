import clsx from 'clsx';

const ToggleSwitch = ({ checked, disabled, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange?.(!checked)}
    className={clsx(
      'relative inline-flex h-8 w-20 items-center rounded-full border px-1 text-[10px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60',
      checked
        ? 'border-accent/50 bg-accent/20 text-accent'
        : 'border-neutral-600 bg-neutral-800 text-neutral-400'
    )}
  >
    <span
      className={clsx(
        'absolute left-1 h-6 w-6 rounded-full bg-current transition',
        checked ? 'translate-x-12 text-accent' : 'translate-x-0 text-neutral-500'
      )}
    />
    <span className={clsx('w-full text-center', checked ? 'pl-1 text-accent' : 'pr-1 text-neutral-400')}>
      {checked ? 'On' : 'Off'}
    </span>
  </button>
);

export default ToggleSwitch;
