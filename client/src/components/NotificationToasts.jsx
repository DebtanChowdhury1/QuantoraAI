import clsx from 'clsx';
import {
  alertBody,
  alertGreeting,
  alertId,
  alertTitle,
  useNotifications,
} from '@/context/NotificationContext';

const badgeStyles = {
  BUY: 'border-accent/50 bg-accent/15 text-accent',
  HOLD: 'border-gold/50 bg-gold/15 text-gold',
  SELL: 'border-red-400/50 bg-red-500/15 text-red-300',
  UP: 'border-accent/50 bg-accent/15 text-accent',
  DOWN: 'border-red-400/50 bg-red-500/15 text-red-300',
  PROFIT: 'border-accent/50 bg-accent/15 text-accent',
  STOP: 'border-red-400/50 bg-red-500/15 text-red-300',
  UPDATE: 'border-gold/50 bg-gold/15 text-gold',
};

const railStyles = {
  BUY: 'from-accent to-accent/20',
  HOLD: 'from-gold to-gold/20',
  SELL: 'from-red-400 to-red-400/20',
  UP: 'from-accent to-accent/20',
  DOWN: 'from-red-400 to-red-400/20',
  PROFIT: 'from-accent to-accent/20',
  STOP: 'from-red-400 to-red-400/20',
  UPDATE: 'from-gold to-gold/20',
};

const iconStyles = {
  BUY: 'bg-accent/20 text-accent shadow-[0_0_18px_rgba(0,255,136,0.28)]',
  HOLD: 'bg-gold/20 text-gold shadow-[0_0_18px_rgba(255,184,0,0.2)]',
  SELL: 'bg-red-500/20 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.22)]',
  UP: 'bg-accent/20 text-accent shadow-[0_0_18px_rgba(0,255,136,0.28)]',
  DOWN: 'bg-red-500/20 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.22)]',
  PROFIT: 'bg-accent/20 text-accent shadow-[0_0_18px_rgba(0,255,136,0.28)]',
  STOP: 'bg-red-500/20 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.22)]',
  UPDATE: 'bg-gold/20 text-gold shadow-[0_0_18px_rgba(255,184,0,0.2)]',
};

const labels = {
  MARKET_MOVE: 'Market move',
  PORTFOLIO_TRIGGER: 'Portfolio',
  EMAIL_STATUS: 'Email',
  TEST: 'Test',
};

const actionSymbols = {
  BUY: 'B',
  HOLD: 'H',
  SELL: 'S',
  UP: 'UP',
  DOWN: 'DN',
  PROFIT: 'P',
  STOP: 'SL',
  UPDATE: 'AI',
};

const compactTitle = (alert, recipientName) =>
  alertTitle(alert, recipientName).replace(/^Hi [^,]+,\s*/, '');

const NotificationToasts = () => {
  const { recipientName, toasts, dismissToast } = useNotifications();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[70] w-[min(440px,calc(100vw-2rem))]">
      <section className="relative overflow-hidden rounded-3xl border border-accent/25 bg-neutral-950/95 shadow-[0_22px_70px_rgba(0,0,0,0.55),0_0_34px_rgba(0,255,136,0.2)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-36 bg-accent/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3 border-b border-neutral-800/80 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              {alertGreeting(toasts[0], recipientName)}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-neutral-50">Live Quantora alerts</h3>
            <p className="text-[11px] text-neutral-500">
              {toasts.length} active notification{toasts.length === 1 ? '' : 's'} shown by priority.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toasts.forEach((alert) => dismissToast(alertId(alert)))}
            className="rounded-full border border-neutral-700 px-3 py-1.5 text-[10px] font-semibold text-neutral-400 transition hover:border-red-400/50 hover:text-red-300"
          >
            Clear all
          </button>
        </div>

        <div className="relative max-h-[min(58vh,430px)] space-y-2 overflow-y-auto p-3">
          {toasts.map((alert, index) => (
            <article
              key={alertId(alert)}
              className={clsx(
                'relative overflow-hidden rounded-2xl border bg-neutral-900/80 px-3 py-3 transition',
                index === 0 ? 'border-accent/35 shadow-glow' : 'border-neutral-800/90'
              )}
            >
              <div
                className={clsx(
                  'absolute inset-y-0 left-0 w-1 bg-gradient-to-b',
                  railStyles[alert.action] || 'from-neutral-500 to-neutral-800'
                )}
              />
              <div className="flex items-start gap-3 pl-1">
                <span
                  className={clsx(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-[10px] font-black',
                    iconStyles[alert.action] || 'bg-neutral-800 text-neutral-300'
                  )}
                >
                  {actionSymbols[alert.action] || 'Q'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        badgeStyles[alert.action] || 'border-neutral-600 text-neutral-300'
                      )}
                    >
                      {alert.action}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {labels[alert.type] || alert.type || 'Signal'}
                    </span>
                    {index === 0 && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        latest
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-neutral-50">
                    {compactTitle(alert, recipientName)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                    {alertBody(alert)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(alertId(alert))}
                  className="shrink-0 rounded-full border border-neutral-800 px-2 py-1 text-[10px] text-neutral-500 transition hover:border-red-400/50 hover:text-red-300"
                >
                  Close
                </button>
              </div>
              {index === 0 && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-800">
                  <div className="notification-life h-full rounded-full bg-accent/80" />
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="relative border-t border-neutral-800/80 px-4 py-2 text-[11px] text-neutral-500">
          All active alerts also appear in Notification History.
        </div>
      </section>
    </div>
  );
};

export default NotificationToasts;
