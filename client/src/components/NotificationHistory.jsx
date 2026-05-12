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

const NotificationHistory = () => {
  const { notificationHistory, recipientName } = useNotifications();

  return (
    <section className="rounded-2xl border border-neutral-600/30 bg-neutral-900/80 p-5 shadow-glow">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Notification History</p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-50">Recent notification events</h2>
          <p className="text-sm text-neutral-400">Market moves, portfolio triggers, and AI signal notifications.</p>
        </div>
        <p className="text-xs text-neutral-500">Latest 20</p>
      </div>

      <div className="mt-5 space-y-3">
        {notificationHistory.map((alert) => (
          <div
            key={alertId(alert)}
            className="flex flex-col gap-3 rounded-2xl border border-neutral-700/60 bg-neutral-950/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                {alertGreeting(alert, recipientName)}
              </p>
              <span
                className={clsx(
                  'mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold',
                  badgeStyles[alert.action] || 'border-neutral-600 text-neutral-300'
                )}
              >
                {alert.type || 'SIGNAL'}
              </span>
              <p className="mt-2 text-sm font-semibold text-neutral-100">{alertTitle(alert, recipientName)}</p>
              <p className="mt-1 text-xs text-neutral-400">{alertBody(alert)}</p>
            </div>
            <p className="text-xs text-neutral-500">
              {new Date(alert.createdAt || alert.dispatchedAt || Date.now()).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        ))}
        {!notificationHistory.length && (
          <div className="rounded-2xl border border-neutral-700/60 bg-neutral-950/70 p-5 text-sm text-neutral-400">
            No notification events yet. Turn on page popups or browser push, then keep Quantora open while market or portfolio alerts occur.
          </div>
        )}
      </div>
    </section>
  );
};

export default NotificationHistory;
