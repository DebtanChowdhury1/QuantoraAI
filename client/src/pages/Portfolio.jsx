import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import ForecastTrendChart from '@/components/ForecastTrendChart';
import useInvestmentPlans from '@/hooks/useInvestmentPlans';
import { useCurrency } from '@/context/CurrencyContext';
import { formatConfidencePercent, formatPercent, formatUsdAsCurrency } from '@/lib/formatters';

const emptyForm = {
  coinId: 'bitcoin',
  status: 'PLANNED',
  entryPrice: '',
  quantity: '',
  capitalUsd: '',
  targetPrice: '',
  stopLossPrice: '',
  note: '',
};

const statusStyles = {
  PLANNED: 'border-gold/40 bg-gold/10 text-gold',
  OPEN: 'border-accent/40 bg-accent/10 text-accent',
};

const stanceStyles = {
  ENTRY_ACTIVE: 'border-accent/40 bg-accent/10 text-accent',
  WAIT_FOR_ENTRY: 'border-gold/40 bg-gold/10 text-gold',
  HOLD_WINNER: 'border-accent/40 bg-accent/10 text-accent',
  MONITOR: 'border-gold/40 bg-gold/10 text-gold',
  REDUCE_RISK: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const signalMeanings = {
  BUY: 'BUY means the current market data supports a possible entry, but position size and risk controls still matter.',
  HOLD: 'HOLD means do not buy or sell aggressively right now. The edge is neutral, so monitor price, confidence, and risk zones.',
  SELL: 'SELL means downside risk is elevated and the position needs defensive review. It is not an automatic sell order.',
};

const getTargetStatusText = (exitPlan) => {
  if (!exitPlan) return 'No exit plan available yet.';
  if (exitPlan.profitTargetReached) return 'AI expects the take-profit trigger can be reached on the expected path.';
  if (exitPlan.profitZonePossible) return 'AI sees the take-profit trigger only in the upper forecast range.';
  return 'AI does not currently project the take-profit trigger.';
};

const formatDecisionTime = (value) => {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const formatPlanMoney = (value, { currency, rate }) => {
  if (!Number.isFinite(Number(value))) return 'Not active';
  return formatUsdAsCurrency(value, { currency, rate });
};

const getPlanSummary = ({ plan, market, signal, position, recommendation, exitPlan, actionPlan, currency, rate }) => {
  const coin = `${market.name} (${market.symbol})`;
  const livePrice = formatUsdAsCurrency(market.currentPrice, { currency, rate });
  const signalText = `${signal?.action || 'HOLD'}${signal ? ` at ${formatConfidencePercent(signal.confidence)}` : ''}`;

  if (plan.status === 'OPEN') {
    const pnlText = `${formatUsdAsCurrency(position.pnlUsd, { currency, rate })} / ${formatPercent(position.pnlPct)}`;
    const stopText = recommendation.suggestedStop
      ? formatUsdAsCurrency(recommendation.suggestedStop, { currency, rate })
      : 'N/A';
    const profitText = recommendation.suggestedProfit
      ? formatUsdAsCurrency(recommendation.suggestedProfit, { currency, rate })
      : 'N/A';
    return `${coin} is already bought. Live price is ${livePrice}. Current P/L is ${pnlText}. Signal is ${signalText}. Sell manually if price falls to ${stopText} or rises to ${profitText}. ${getTargetStatusText(exitPlan)}`;
  }

  const distanceText = formatPercent(position.distanceToEntryPct);
  const entryText = recommendation.suggestedEntry
    ? formatUsdAsCurrency(recommendation.suggestedEntry, { currency, rate })
    : formatUsdAsCurrency(plan.entryPrice, { currency, rate });
  const avoidText = recommendation.avoidAbove
    ? formatUsdAsCurrency(recommendation.avoidAbove, { currency, rate })
    : 'N/A';
  if (actionPlan?.decision === 'BUY_REVIEW_ACTIVE') {
    return `${coin} is a planned buy. Live price is ${livePrice}. Price is ${distanceText} from your planned entry. Signal is ${signalText}. Buy review is active near ${entryText}, but only with predefined stop and position size. Avoid chasing above ${avoidText}.`;
  }
  return `${coin} is a planned buy. Live price is ${livePrice}. Price is ${distanceText} from your planned entry. Signal is ${signalText}. No buy action is recommended yet; wait for stronger probability, better reward/risk, and price near ${entryText}. Avoid chasing above ${avoidText}.`;
};

const getPortfolioSummary = ({ plans, stats, currency, rate }) => {
  if (!plans.length) {
    return 'No portfolio cases yet. Add a planned buy or already-bought position to get live AI guidance.';
  }

  const open = plans.filter((item) => item.plan?.status === 'OPEN' && !item.error);
  const planned = plans.filter((item) => item.plan?.status === 'PLANNED' && !item.error);
  const defensive = plans.filter(
    (item) => item.signal?.action === 'SELL' || item.recommendation?.stance === 'REDUCE_RISK'
  );
  const strongest = [...plans]
    .filter((item) => !item.error)
    .sort((a, b) => Number(b.signal?.confidence || 0) - Number(a.signal?.confidence || 0))[0];
  const pnlText = formatUsdAsCurrency(stats.pnl, { currency, rate });
  const bias =
    stats.pnl > 0
      ? `Tracked open P/L is positive at ${pnlText}.`
      : stats.pnl < 0
        ? `Tracked open P/L is negative at ${pnlText}; protect downside first.`
        : `Tracked open P/L is flat at ${pnlText}.`;
  const riskText = defensive.length
    ? `${defensive.length} case${defensive.length === 1 ? '' : 's'} need defensive attention.`
    : 'No saved case is currently marked as defensive.';
  const focusText = strongest
    ? `Highest-confidence signal is ${strongest.market?.name} with ${strongest.signal?.action || 'HOLD'} at ${formatConfidencePercent(strongest.signal?.confidence || 0)}.`
    : 'No confidence leader yet.';

  return `You have ${open.length} open position${open.length === 1 ? '' : 's'} and ${planned.length} planned entr${planned.length === 1 ? 'y' : 'ies'}. ${bias} ${riskText} ${focusText}`;
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs uppercase tracking-wide text-neutral-400">{label}</span>
    <div className="mt-2">{children}</div>
  </label>
);

const inputClass =
  'w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-100 outline-none transition focus:border-accent/70';

const PlanForm = ({ onSubmit, saving }) => {
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState('');
  const { currency, rate } = useCurrency();
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toUsd = (value) => Number(value || 0) / Number(rate || 1);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    try {
      await onSubmit({
        ...form,
        coinId: form.coinId.trim().toLowerCase(),
        entryPrice: toUsd(form.entryPrice),
        quantity: Number(form.quantity || 0),
        capitalUsd: toUsd(form.capitalUsd),
        targetPrice: form.targetPrice ? toUsd(form.targetPrice) : null,
        stopLossPrice: form.stopLossPrice ? toUsd(form.stopLossPrice) : null,
      });
      setForm(emptyForm);
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save this investment case. Please check the values and try again.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Trade Planning Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-100">Portfolio Intelligence</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Track planned buys or existing positions. Quantora reviews each case against live price,
            signal confidence, volatility, and probabilistic forecast ranges.
          </p>
        </div>
        <p className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          Live market sync
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Field label="Coin ID">
          <input
            className={inputClass}
            value={form.coinId}
            onChange={(event) => update('coinId', event.target.value)}
            placeholder="bitcoin, ethereum, solana"
            required
          />
        </Field>
        <Field label="Plan Type">
          <select
            className={inputClass}
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="PLANNED">Planning to buy</option>
            <option value="OPEN">Already bought</option>
          </select>
        </Field>
        <Field label={`${form.status === 'OPEN' ? 'Bought At' : 'Planned Buy Price'} (${currency})`}>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="any"
            value={form.entryPrice}
            onChange={(event) => update('entryPrice', event.target.value)}
            placeholder={`Entry price in ${currency}`}
            required
          />
        </Field>
        <Field label="Quantity">
          <input
            className={inputClass}
            type="number"
            min="0"
            step="any"
            value={form.quantity}
            onChange={(event) => update('quantity', event.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label={`Capital (${currency})`}>
          <input
            className={inputClass}
            type="number"
            min="0"
            step="any"
            value={form.capitalUsd}
            onChange={(event) => update('capitalUsd', event.target.value)}
            placeholder={`Used when quantity is empty (${currency})`}
          />
        </Field>
        <Field label={`Target / Stop (${currency})`}>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="any"
              value={form.targetPrice}
              onChange={(event) => update('targetPrice', event.target.value)}
              placeholder="Target"
            />
            <input
              className={inputClass}
              type="number"
              min="0"
              step="any"
              value={form.stopLossPrice}
              onChange={(event) => update('stopLossPrice', event.target.value)}
              placeholder="Stop"
            />
          </div>
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-20 resize-none`}
          value={form.note}
          onChange={(event) => update('note', event.target.value)}
          placeholder="Why this coin, risk limit, target thesis..."
        />
      </Field>
      <button
        type="submit"
        disabled={saving}
        className="mt-5 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-background shadow-glow transition hover:bg-accent/90 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save investment case'}
      </button>
      {submitError && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {submitError}
        </p>
      )}
    </form>
  );
};

const ForecastTable = ({ forecast = [] }) => (
  <ForecastTableInner forecast={forecast} />
);

const ForecastTableInner = ({ forecast = [] }) => {
  const { currency, rate } = useCurrency();

  return (
  <div className="overflow-x-auto rounded-2xl border border-neutral-700/50">
    <table className="w-full min-w-[620px] text-sm">
      <thead className="bg-neutral-950/70 text-xs uppercase tracking-wide text-neutral-400">
        <tr>
          <th className="px-4 py-3 text-left">Horizon</th>
          <th className="px-4 py-3 text-right">Expected</th>
          <th className="px-4 py-3 text-right">Range</th>
          <th className="px-4 py-3 text-right">Move</th>
          <th className="px-4 py-3 text-right">Prob. Up</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-700/40">
        {forecast.map((item) => (
          <tr key={item.horizon}>
            <td className="px-4 py-3 font-semibold text-neutral-100">{item.horizon}</td>
            <td className="px-4 py-3 text-right text-neutral-200">
              {formatUsdAsCurrency(item.expectedPrice, { currency, rate })}
            </td>
            <td className="px-4 py-3 text-right text-neutral-400">
              {formatUsdAsCurrency(item.lowRange, { currency, rate })} -{' '}
              {formatUsdAsCurrency(item.highRange, { currency, rate })}
            </td>
            <td
              className={clsx(
                'px-4 py-3 text-right font-semibold',
                item.expectedMovePct >= 0 ? 'text-accent' : 'text-red-400'
              )}
            >
              {formatPercent(item.expectedMovePct)}
            </td>
            <td className="px-4 py-3 text-right text-neutral-200">{item.probabilityUp.toFixed(3)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

const actionPlanStyles = {
  RISK_REVIEW_NOW: 'border-gold/50 bg-gold/10 text-gold',
  PROFIT_REVIEW_NOW: 'border-accent/40 bg-accent/10 text-accent',
  HOLD_FOR_UPSIDE: 'border-accent/40 bg-accent/10 text-accent',
  HOLD_AND_REVIEW: 'border-gold/40 bg-gold/10 text-gold',
  BUY_REVIEW_ACTIVE: 'border-accent/40 bg-accent/10 text-accent',
  WAIT_FOR_BETTER_ENTRY: 'border-gold/40 bg-gold/10 text-gold',
  NO_TRADE_SETUP: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const ActionPlanPanel = ({ actionPlan, plan }) => {
  const { currency, rate } = useCurrency();
  if (!actionPlan) return null;
  const isOpen = plan.status === 'OPEN';

  const isRiskReview = actionPlan.decision === 'RISK_REVIEW_NOW';

  return (
    <div className="rounded-2xl border border-accent/30 bg-neutral-950/70 p-5 shadow-glow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">AI Buy / Sell Plan</p>
          <h3 className="mt-2 text-xl font-semibold text-neutral-50">
            {isOpen ? 'Already bought: hold, sell, or reduce' : 'Planning to buy: wait or enter'}
          </h3>
        </div>
        <span
          className={clsx(
            'self-start rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
            actionPlanStyles[actionPlan.decision] || actionPlanStyles.NO_TRADE_SETUP
          )}
        >
          {actionPlan.primaryAction}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-neutral-200">{actionPlan.summary}</p>
      <div
        className={clsx(
          'mt-4 rounded-xl border p-4',
          isRiskReview ? 'border-gold/30 bg-gold/10' : 'border-accent/20 bg-accent/5'
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Right now</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-100">{actionPlan.now}</p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-700/70 bg-neutral-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {isOpen ? 'Add-more rule' : 'Before you buy'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-200">{actionPlan.buyGuidance}</p>
        </div>
        <div className="rounded-xl border border-neutral-700/70 bg-neutral-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {isOpen ? 'Sell rule' : 'After you buy'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-200">{actionPlan.sellGuidance}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={isOpen ? 'Profit Review Window' : 'Next Valid Entry Review'}
          value={formatDecisionTime(actionPlan.maxProfitWindow)}
          accent={actionPlan.maxProfitWindow ? 'text-accent' : 'text-neutral-400'}
          compact
        />
        <Metric
          label={isOpen ? 'Projected Profit Zone' : 'Valid Upside Target'}
          value={formatPlanMoney(actionPlan.maxProfitExpectedPrice, { currency, rate })}
          accent={Number.isFinite(Number(actionPlan.maxProfitExpectedPrice)) ? 'text-accent' : 'text-neutral-400'}
          compact
        />
        <Metric
          label={isOpen ? 'Upside Probability' : 'Buy Setup Probability'}
          value={`${Number(actionPlan.maxProfitProbability || 0).toFixed(3)}%`}
          accent={Number(actionPlan.maxProfitProbability || 0) >= 58 ? 'text-accent' : 'text-red-300'}
          compact
        />
        <Metric
          label={isOpen ? 'Risk Review Time' : 'Risk Before Buying'}
          value={formatDecisionTime(actionPlan.riskWindow)}
          accent={isRiskReview ? 'text-gold' : 'text-red-400'}
          compact
        />
        <Metric
          label={isOpen ? 'Stop Review Zone' : 'Stop After Entry'}
          value={formatUsdAsCurrency(actionPlan.stopPrice, { currency, rate })}
          accent="text-red-400"
          compact
        />
        <Metric
          label={isOpen ? 'Take Profit Near' : 'First Profit Target'}
          value={formatPlanMoney(actionPlan.targetPrice, { currency, rate })}
          accent={Number.isFinite(Number(actionPlan.targetPrice)) ? 'text-accent' : 'text-neutral-400'}
          compact
        />
        <Metric
          label="Forecast Low Zone"
          value={formatUsdAsCurrency(actionPlan.riskPrice, { currency, rate })}
          accent="text-red-300"
          compact
        />
        <Metric
          label={isOpen ? 'AI Confidence' : 'Reward / Risk'}
          value={isOpen ? `${Number(actionPlan.confidenceScore || 0).toFixed(3)}%` : `${Number(actionPlan.rewardRisk || 0).toFixed(3)}x`}
          accent={isOpen ? 'text-neutral-100' : Number(actionPlan.rewardRisk || 0) >= 1.2 ? 'text-accent' : 'text-red-300'}
          compact
        />
      </div>
      <p className="mt-4 rounded-xl border border-neutral-700/60 bg-neutral-900/70 p-3 text-xs leading-relaxed text-neutral-400">
        Quantora does not execute trades. Use these as review checkpoints and confirm the live exchange price,
        position size, and your personal risk limit before buying or selling.
      </p>
    </div>
  );
};

const PlanCard = ({ item, onDelete, saving }) => {
  const { plan, market, signal, position, recommendation, forecast, exitPlan, actionPlan, error } = item;
  const { currency, rate } = useCurrency();
  const isDefensiveReview = actionPlan?.decision === 'RISK_REVIEW_NOW';
  const plainSummary = useMemo(
    () => getPlanSummary({ plan, market, signal, position, recommendation, exitPlan, actionPlan, currency, rate }),
    [plan, market, signal, position, recommendation, exitPlan, actionPlan, currency, rate]
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">
        Unable to analyze {plan.coinId}: {error}
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {market.image ? (
            <img src={market.image} alt="" className="h-11 w-11 rounded-full bg-neutral-800" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
              {market.symbol?.slice(0, 2)}
            </span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-neutral-100">
                {market.name} ({market.symbol})
              </h2>
              <span className={clsx('rounded-full border px-2 py-1 text-[10px] font-semibold', statusStyles[plan.status])}>
                {plan.status === 'OPEN' ? 'ALREADY BOUGHT' : 'PLANNING BUY'}
              </span>
              <span className={clsx('rounded-full border px-2 py-1 text-[10px] font-semibold', stanceStyles[recommendation.stance])}>
                {recommendation.stance.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-400">{recommendation.headline}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDelete(plan._id)}
          className="self-start rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Live Summary</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-100">{plainSummary}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Live Price" value={formatUsdAsCurrency(market.currentPrice, { currency, rate })} accent="text-accent" />
        <Metric label="Entry" value={formatUsdAsCurrency(plan.entryPrice, { currency, rate })} />
        <Metric
          label={plan.status === 'OPEN' ? `P/L${Number(plan.quantity) > 0 ? ` (${Number(plan.quantity)} units)` : ''}` : 'Distance'}
          value={
            plan.status === 'OPEN'
              ? `${formatUsdAsCurrency(position.pnlUsd, { currency, rate })} / ${formatPercent(position.pnlPct)}`
              : formatPercent(position.distanceToEntryPct)
          }
          accent={plan.status === 'OPEN' && position.pnlPct < 0 ? 'text-red-400' : 'text-accent'}
        />
        <Metric
          label="Signal"
          value={`${signal?.action || 'HOLD'} ${signal ? formatConfidencePercent(signal.confidence) : ''}`}
          accent={signal?.action === 'SELL' ? 'text-red-400' : signal?.action === 'BUY' ? 'text-accent' : 'text-gold'}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border border-neutral-700/50 bg-neutral-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">AI Review</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-200">{recommendation.guidance}</p>
          <p className="mt-3 rounded-xl border border-neutral-700/50 bg-neutral-900/70 px-3 py-2 text-xs leading-relaxed text-neutral-400">
            {signalMeanings[signal?.action || 'HOLD']}
          </p>
          <div className="mt-4 grid gap-3 text-sm">
            {'suggestedEntry' in recommendation && (
                <Metric label="Buy Near This Price" value={formatUsdAsCurrency(recommendation.suggestedEntry, { currency, rate })} accent="text-accent" compact />
              )}
            {'avoidAbove' in recommendation && (
              <Metric label="Do Not Buy Above" value={formatUsdAsCurrency(recommendation.avoidAbove, { currency, rate })} accent="text-gold" compact />
            )}
            {'suggestedStop' in recommendation && (
              <Metric label="Stop Review Zone" value={formatUsdAsCurrency(recommendation.suggestedStop, { currency, rate })} accent="text-red-400" compact />
            )}
            {'suggestedProfit' in recommendation && !isDefensiveReview && (
              <Metric label="Take Profit Near" value={formatUsdAsCurrency(recommendation.suggestedProfit, { currency, rate })} accent="text-accent" compact />
            )}
            {'suggestedProfit' in recommendation && isDefensiveReview && (
              <Metric label="Profit Target" value="Paused until risk improves" accent="text-gold" compact />
            )}
            <Metric label="Next Review" value={recommendation.nextReview} compact />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">{recommendation.probabilityNote}</p>
        </div>
        <div className="space-y-4">
          <ActionPlanPanel actionPlan={actionPlan} plan={plan} />
          {exitPlan && (
            <div className="rounded-2xl border border-accent/30 bg-neutral-950/70 p-5 shadow-glow">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">AI Exit / P&L Plan</p>
              <h3 className="mt-2 text-xl font-semibold text-neutral-50">
                Probable {exitPlan.likelyDirection}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-200">{exitPlan.guidance}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Sell Checkpoint"
                  value={formatDecisionTime(exitPlan.sellReviewAt)}
                  accent="text-accent"
                  compact
                />
                <Metric
                  label="Risk Checkpoint"
                  value={formatDecisionTime(exitPlan.riskReviewAt)}
                  accent="text-red-400"
                  compact
                />
                <Metric
                  label="Take-Profit Sell Trigger"
                  value={formatUsdAsCurrency(exitPlan.profitTarget, { currency, rate })}
                  accent="text-accent"
                  compact
                />
                <Metric
                  label="Stop-Loss Sell Trigger"
                  value={formatUsdAsCurrency(exitPlan.stopTarget, { currency, rate })}
                  accent="text-red-400"
                  compact
                />
                <Metric
                  label="Expected At Sell Check"
                  value={formatUsdAsCurrency(exitPlan.expectedAtSellReview, { currency, rate })}
                  accent="text-neutral-100"
                  compact
                />
                <Metric
                  label="Forecast Low At Risk Check"
                  value={formatUsdAsCurrency(exitPlan.lowAtRiskReview, { currency, rate })}
                  accent="text-neutral-100"
                  compact
                />
                <Metric
                  label="Upside Probability"
                  value={`${Number(exitPlan.probabilityUp).toFixed(3)}%`}
                  accent={Number(exitPlan.probabilityUp) >= 55 ? 'text-accent' : 'text-gold'}
                  compact
                />
                <Metric
                  label="Target Status"
                  value={
                    exitPlan.profitTargetReached
                      ? 'Expected path reaches target'
                      : exitPlan.profitZonePossible
                        ? 'Upper range can test target'
                        : 'Target not projected yet'
                  }
                  accent={exitPlan.profitTargetReached ? 'text-accent' : 'text-gold'}
                  compact
                />
              </div>
              <div className="mt-4 rounded-xl border border-neutral-700/60 bg-neutral-900/80 p-3 text-xs leading-relaxed text-neutral-300">
                <p className="font-semibold text-neutral-100">How to read this</p>
                <p className="mt-1">
                  If live price touches the stop-loss sell trigger, treat it as an immediate manual exit
                  signal. If live price touches the take-profit sell trigger, treat it as an immediate
                  manual profit-taking signal. Quantora does not execute trades; you must place the order
                  on your exchange.
                </p>
              </div>
            </div>
          )}
          <ForecastTrendChart series={item.forecastSeries || []} />
          <ForecastTable forecast={forecast} />
        </div>
      </div>
    </article>
  );
};

const Metric = ({ label, value, accent = 'text-neutral-100', compact = false }) => (
  <div className={clsx('rounded-xl border border-neutral-700/70 bg-neutral-950/80', compact ? 'p-3' : 'p-4')}>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
    <p className={clsx('mt-2 font-semibold leading-tight', compact ? 'text-base' : 'text-lg', accent)}>
      {value}
    </p>
  </div>
);

const Portfolio = () => {
  const { plans, plansQuery, createPlan, deletePlan, saving } = useInvestmentPlans();
  const { currency, rate } = useCurrency();
  const stats = useMemo(() => {
    const open = plans.filter((item) => item.plan?.status === 'OPEN');
    const planned = plans.filter((item) => item.plan?.status === 'PLANNED');
    const pnl = open.reduce((total, item) => total + Number(item.position?.pnlUsd || 0), 0);
    return { open: open.length, planned: planned.length, pnl };
  }, [plans]);
  const portfolioSummary = useMemo(
    () => getPortfolioSummary({ plans, stats, currency, rate }),
    [plans, stats, currency, rate]
  );

  if (plansQuery.isLoading) {
    return <Loader label="Loading portfolio intelligence" />;
  }

  if (plansQuery.isError) {
    return <ErrorState message={plansQuery.error?.message || 'Unable to load investment plans'} onRetry={plansQuery.refetch} />;
  }

  return (
    <div className="space-y-8">
      <PlanForm onSubmit={createPlan} saving={saving} />

      <section className="rounded-2xl border border-accent/25 bg-neutral-900/80 p-5 shadow-glow backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Portfolio Summary</p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-50">Live account read</h2>
          </div>
          <span className="self-start rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Live market sync
          </span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-neutral-100">{portfolioSummary}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Open Positions" value={stats.open} accent="text-accent" />
        <Metric label="Planned Entries" value={stats.planned} accent="text-gold" />
        <Metric label="Tracked P/L" value={formatUsdAsCurrency(stats.pnl, { currency, rate })} accent={stats.pnl >= 0 ? 'text-accent' : 'text-red-400'} />
      </div>

      <div className="space-y-5">
        {plans.map((item) => (
          <PlanCard key={item.plan._id} item={item} onDelete={deletePlan} saving={saving} />
        ))}
        {!plans.length && (
          <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-8 text-center text-neutral-300 shadow-glow">
            <p className="text-lg font-semibold text-neutral-100">No investment cases yet.</p>
            <p className="mt-2 text-sm text-neutral-400">
              Add a planned buy or an already-bought position to get AI review, P/L tracking, and forecast ranges.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
