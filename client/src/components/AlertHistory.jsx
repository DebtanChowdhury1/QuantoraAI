import { motion } from 'framer-motion';
import clsx from 'clsx';

const actionDot = {
  BUY: 'bg-accent shadow-[0_0_10px_rgba(0,255,136,0.7)]',
  HOLD: 'bg-gold shadow-[0_0_10px_rgba(255,184,0,0.7)]',
  SELL: 'bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.7)]',
};

const AlertHistory = ({ alerts = [] }) => (
  <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
    <h2 className="text-lg font-semibold text-neutral-100">Recent Alerts</h2>
    <p className="text-sm text-neutral-400">Quantora AI notifications across all portfolios</p>
    <div className="mt-6 space-y-4">
      {alerts.slice(0, 20).map((alert, index) => (
        <motion.div
          key={alert._id || `${alert.coinId}-${index}`}
          className="flex items-center gap-4 rounded-2xl border border-neutral-600/30 bg-neutral-600/10 px-4 py-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.02 }}
        >
          <span
            className={clsx(
              'inline-flex h-3 w-3 rounded-full',
              actionDot[alert.action] || 'bg-neutral-400'
            )}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-100">
              {alert.action} {alert.coinId.toUpperCase()} @{' '}
              <span className="text-neutral-300">
                ${alert.marketPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
            <p className="text-xs text-neutral-400">{alert.reason}</p>
          </div>
          <div className="text-right text-xs text-neutral-400">
            <p>
              {new Date(alert.dispatchedAt || alert.createdAt).toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-neutral-500">
              Confidence {(alert.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </motion.div>
      ))}
      {!alerts.length && (
        <p className="text-sm text-neutral-400">No alerts dispatched yet — stay tuned.</p>
      )}
    </div>
  </div>
);

export default AlertHistory;
