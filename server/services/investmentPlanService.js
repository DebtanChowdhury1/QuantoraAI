import InvestmentPlan from '../models/InvestmentPlan.js';
import Prediction from '../models/Prediction.js';
import { getCryptoData } from './cryptoDataService.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const formatPercent = (value) => `${toNumber(value).toFixed(3)}%`;

const signalBias = (action) => {
  if (action === 'BUY') return 1;
  if (action === 'SELL') return -1;
  return 0;
};

const computeProbabilityUp = ({
  expectedMovePct,
  rangePct,
  confidence,
  bias,
  momentum,
  change24h,
  volatility,
  days,
}) => {
  const signalEdge = bias * (confidence - 0.5) * 18;
  const momentumEdge = clamp(momentum * 1.45 + change24h * 0.65, -18, 18);
  const pathEdge = clamp(expectedMovePct * 1.18, -28, 28);
  const uncertaintyDrag = clamp(rangePct * 0.16 + Math.log1p(days) * 1.15 + volatility * 0.22, 0, 24);
  const rawEdge = pathEdge + signalEdge + momentumEdge;
  const adjustedEdge =
    Math.sign(rawEdge) * Math.max(Math.abs(rawEdge) - uncertaintyDrag, 0);
  const horizonMeanReversion = clamp(Math.log1p(days) / Math.log(366), 0, 1) * 0.28;
  const probability = 50 + adjustedEdge * (1 - horizonMeanReversion);

  return clamp(probability, 8, 92);
};

const buildForecast = ({ currentPrice, change24h, volatility, momentum, signal }) => {
  const confidence = toNumber(signal?.confidence, 0.5);
  const bias = signalBias(signal?.action);
  const dailyVolatility = clamp(volatility / Math.sqrt(7), 0.25, 18);
  const driftBase = clamp(momentum * 0.32 + change24h * 0.16 + bias * confidence * 3.5, -14, 14);

  return [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: '1Y', days: 365 },
  ].map((period) => {
    const timeScale = Math.sqrt(period.days / 7);
    const expectedMovePct = clamp(driftBase * timeScale, -45, 65);
    const rangePct = clamp(dailyVolatility * timeScale * 1.2, 1.5, 85);
    const probabilityUp = computeProbabilityUp({
      expectedMovePct,
      rangePct,
      confidence,
      bias,
      momentum,
      change24h,
      volatility,
      days: period.days,
    });

    return {
      horizon: period.label,
      days: period.days,
      expectedPrice: Number((currentPrice * (1 + expectedMovePct / 100)).toFixed(currentPrice >= 1 ? 2 : 8)),
      lowRange: Number((currentPrice * (1 + (expectedMovePct - rangePct) / 100)).toFixed(currentPrice >= 1 ? 2 : 8)),
      highRange: Number((currentPrice * (1 + (expectedMovePct + rangePct) / 100)).toFixed(currentPrice >= 1 ? 2 : 8)),
      expectedMovePct: Number(expectedMovePct.toFixed(3)),
      probabilityUp: Number(probabilityUp.toFixed(3)),
      confidence: Number(clamp(confidence * 100 - period.days / 40, 15, 88).toFixed(3)),
    };
  });
};

const buildForecastSeries = ({ currentPrice, change24h, volatility, momentum, signal }) => {
  const now = Date.now();
  const confidence = toNumber(signal?.confidence, 0.5);
  const bias = signalBias(signal?.action);
  const dailyVolatility = clamp(volatility / Math.sqrt(7), 0.25, 18);
  const driftBase = clamp(momentum * 0.32 + change24h * 0.16 + bias * confidence * 3.5, -14, 14);
  const intraday = Array.from({ length: 96 }, (_, index) => ({
    hours: (index + 1) * 0.25,
    granularity: '15m',
  }));
  const hourly = Array.from({ length: 144 }, (_, index) => ({
    hours: 24 + index + 1,
    granularity: 'hour',
  }));
  const sixHourly = Array.from({ length: 92 }, (_, index) => ({
    hours: 168 + (index + 1) * 6,
    granularity: '6h',
  }));
  const daily = Array.from({ length: 365 - 30 }, (_, index) => ({
    hours: (index + 31) * 24,
    granularity: 'day',
  }));
  const periods = [...intraday, ...hourly, ...sixHourly, ...daily];

  return periods.map((period) => {
    const days = period.hours / 24;
    const timeScale = Math.sqrt(Math.max(days, 1 / 24) / 7);
    const expectedMovePct = clamp(driftBase * timeScale, -45, 65);
    const rangePct = clamp(dailyVolatility * timeScale * 1.2, 0.25, 85);
    const probabilityUp = computeProbabilityUp({
      expectedMovePct,
      rangePct,
      confidence,
      bias,
      momentum,
      change24h,
      volatility,
      days,
    });

    const direction =
      expectedMovePct > 1 ? 'upside-biased' : expectedMovePct < -1 ? 'downside-biased' : 'range-bound';
    const confidenceQuality =
      confidence >= 0.72 ? 'strong' : confidence >= 0.58 ? 'moderate' : 'limited';
    const volatilityState =
      volatility >= 8 ? 'high volatility' : volatility >= 3.5 ? 'active volatility' : 'controlled volatility';
    const riskNote =
      direction === 'upside-biased'
        ? 'Upside needs confirmation from continued momentum and stable volatility.'
        : direction === 'downside-biased'
          ? 'Downside pressure needs risk control before considering fresh exposure.'
          : 'Range conditions favor patience, not aggressive entries.';

    return {
      timestamp: new Date(now + period.hours * 60 * 60 * 1000).toISOString(),
      hours: period.hours,
      granularity: period.granularity,
      expectedPrice: Number((currentPrice * (1 + expectedMovePct / 100)).toFixed(currentPrice >= 1 ? 2 : 8)),
      lowRange: Number((currentPrice * (1 + (expectedMovePct - rangePct) / 100)).toFixed(currentPrice >= 1 ? 2 : 8)),
      highRange: Number((currentPrice * (1 + (expectedMovePct + rangePct) / 100)).toFixed(currentPrice >= 1 ? 2 : 8)),
      expectedMovePct: Number(expectedMovePct.toFixed(3)),
      probabilityUp: Number(probabilityUp.toFixed(3)),
      report: {
        title:
          period.hours <= 24
            ? 'Near-term forecast checkpoint'
            : period.hours <= 720
              ? 'Swing forecast checkpoint'
              : 'Long-range forecast checkpoint',
        direction,
        confidenceQuality,
        volatilityState,
        thesis: `The model projects a ${expectedMovePct.toFixed(3)}% move over ${
          period.hours < 1
            ? `${Math.round(period.hours * 60)}m`
            : period.hours <= 24
              ? `${Number(period.hours.toFixed(2))}h`
              : `${Math.round(days)}d`
        } with ${probabilityUp.toFixed(3)}% upside probability.`,
        reasoning: [
          `Signal: ${signal?.action || 'HOLD'} with ${formatPercent(confidence * 100)} confidence.`,
          `Momentum input is ${formatPercent(momentum)} and 24h movement is ${formatPercent(change24h)}.`,
          `Volatility regime is ${volatilityState} at ${formatPercent(volatility)}.`,
        ],
        riskNote,
        invalidation:
          signal?.action === 'BUY'
            ? 'If confidence drops or price breaks below the low range, the bullish read weakens.'
            : signal?.action === 'SELL'
              ? 'If price reclaims the expected path with improving confidence, the defensive read weakens.'
              : 'If price breaks outside the forecast range with rising confidence, the HOLD read should be reviewed.',
      },
    };
  });
};

const buildRecommendation = ({ plan, snapshot, signal, pnlPct, distanceToEntryPct, forecast }) => {
  const action = signal?.action || 'HOLD';
  const confidence = toNumber(signal?.confidence, 0.5);
  const volatility = toNumber(snapshot.volatility_7d, 3);
  const currentPrice = toNumber(snapshot.price);
  const riskBufferPct = clamp(volatility * 1.5, 3, 18);
  const upsideTargetPct = clamp(volatility * 2.4 + confidence * 8, 5, 35);
  const downsideGuardPct = clamp(volatility * 1.25, 3, 16);

  if (plan.status === 'OPEN') {
    const suggestedStop = Number((currentPrice * (1 - downsideGuardPct / 100)).toFixed(currentPrice >= 1 ? 2 : 8));
    const suggestedProfit = Number((currentPrice * (1 + upsideTargetPct / 100)).toFixed(currentPrice >= 1 ? 2 : 8));
    const next = forecast[0];
    const shouldReduce =
      action === 'SELL' || pnlPct <= -riskBufferPct || (action === 'HOLD' && pnlPct > upsideTargetPct);
    const stance = shouldReduce ? 'REDUCE_RISK' : action === 'BUY' ? 'HOLD_WINNER' : 'MONITOR';

    return {
      stance,
      headline:
        stance === 'REDUCE_RISK'
          ? 'Protect capital and consider reducing exposure.'
          : stance === 'HOLD_WINNER'
          ? 'Position is supported by the current signal.'
          : 'Hold only while price respects the risk zone.',
      guidance:
        stance === 'REDUCE_RISK'
          ? 'The live signal or drawdown profile is not strong enough for blind holding. Review position size, stop-loss, and whether the thesis is still valid.'
          : 'Keep monitoring confidence, trend direction, and the 7-day forecast range. Do not treat the target as guaranteed.',
      suggestedStop,
      suggestedProfit,
      nextReview: action === 'SELL' || volatility > 8 ? '12-24H' : '24-72H',
      probabilityNote: `Near-term upside probability is ${next.probabilityUp.toFixed(3)}% for the 7D model window.`,
    };
  }

  const attractiveEntry = action === 'BUY' ? currentPrice * (1 - volatility / 180) : currentPrice * (1 - riskBufferPct / 100);
  const avoidAbove = currentPrice * (1 + clamp(volatility * 0.8, 1.5, 10) / 100);
  const readyToBuy = action === 'BUY' && Math.abs(distanceToEntryPct) <= clamp(volatility, 1.5, 8);

  return {
    stance: readyToBuy ? 'ENTRY_ACTIVE' : 'WAIT_FOR_ENTRY',
    headline: readyToBuy
      ? 'Planned entry is close to the current market zone.'
      : 'Wait for a cleaner entry instead of chasing price.',
    guidance:
      action === 'SELL'
        ? 'The current signal is defensive. A planned buy should wait until downside pressure eases and confidence recovers.'
        : 'Use the entry level as a decision zone. If price moves far above the plan, reassess instead of buying emotionally.',
    suggestedEntry: Number(attractiveEntry.toFixed(currentPrice >= 1 ? 2 : 8)),
    avoidAbove: Number(avoidAbove.toFixed(currentPrice >= 1 ? 2 : 8)),
    nextReview: volatility > 8 ? '12-24H' : '24-72H',
    probabilityNote: `Current planned-entry distance is ${distanceToEntryPct.toFixed(3)}%.`,
  };
};

const buildExitPlan = ({ plan, recommendation, forecastSeries }) => {
  if (plan.status !== 'OPEN') return null;

  const sorted = [...forecastSeries].sort((a, b) => Number(a.hours) - Number(b.hours));
  const profitTarget = Number(plan.targetPrice) > 0 ? Number(plan.targetPrice) : recommendation.suggestedProfit;
  const stopTarget = Number(plan.stopLossPrice) > 0 ? Number(plan.stopLossPrice) : recommendation.suggestedStop;
  const nearTermPoints = sorted.filter((point) => Number(point.hours) <= 168);
  const profitTargetReached = sorted.some((point) => Number(point.expectedPrice) >= profitTarget);
  const profitZonePossible = sorted.some((point) => Number(point.highRange) >= profitTarget);
  const stopTargetTouched = sorted.some((point) => Number(point.lowRange) <= stopTarget);
  const pointAtOrAfter = (hours) =>
    sorted.find((point) => Number(point.hours) >= hours) || sorted[sorted.length - 1] || sorted[0];
  const bestNearTermPoint = nearTermPoints.reduce(
    (best, point) =>
      Number(point.expectedPrice) * (Number(point.probabilityUp) / 100) >
      Number(best.expectedPrice) * (Number(best.probabilityUp) / 100)
        ? point
        : best,
    nearTermPoints[nearTermPoints.length - 1] || sorted[0]
  );
  let profitPoint = profitTargetReached
    ? sorted.find((point) => Number(point.expectedPrice) >= profitTarget)
    : profitZonePossible
      ? sorted.find((point) => Number(point.highRange) >= profitTarget && Number(point.probabilityUp) >= 54) ||
        bestNearTermPoint
      : pointAtOrAfter(24);
  let riskPoint = stopTargetTouched
    ? sorted.find((point) => Number(point.lowRange) <= stopTarget)
    : pointAtOrAfter(12);
  const profitHours = Number(profitPoint?.hours);
  const riskHours = Number(riskPoint?.hours);

  if (Number.isFinite(profitHours) && Number.isFinite(riskHours) && profitHours <= riskHours) {
    riskPoint = pointAtOrAfter(Math.max(6, riskHours - 6));
    profitPoint = pointAtOrAfter(Math.max(riskHours + 12, 24));
  }
  const likelyDirection =
    Number(profitPoint?.probabilityUp || 0) >= 58
      ? 'upside window'
      : Number(profitPoint?.probabilityUp || 0) <= 42
        ? 'downside risk window'
        : 'range-review window';

  return {
    likelyDirection,
    sellReviewAt: profitPoint?.timestamp,
    riskReviewAt: riskPoint?.timestamp,
    profitTarget: Number(profitTarget.toFixed(profitTarget >= 1 ? 2 : 8)),
    stopTarget: Number(stopTarget.toFixed(stopTarget >= 1 ? 2 : 8)),
    expectedAtSellReview: profitPoint?.expectedPrice,
    lowAtRiskReview: riskPoint?.lowRange,
    sellReviewMovePct: profitPoint?.expectedMovePct,
    riskReviewMovePct: riskPoint?.expectedMovePct,
    profitTargetReached,
    profitZonePossible,
    stopTargetTouched,
    probabilityUp: Number(profitPoint?.probabilityUp || 0),
    guidance:
      recommendation.stance === 'REDUCE_RISK'
        ? 'Because the position is in a defensive state, review the risk window first. If price weakens toward the stop zone, preserving capital takes priority over waiting for upside.'
        : profitTargetReached
          ? 'Use the sell-review window as a profit-management checkpoint, not a guaranteed exit. If price reaches the profit zone with falling confidence, consider locking partial gains.'
          : profitZonePossible
            ? 'The expected path has not reached the profit zone yet, but the upper forecast range can test it. Treat the sell-review time as a partial-profit checkpoint only if price moves toward the upper range with stable confidence.'
            : 'The model is not projecting a clean profit-zone test yet. Keep this as a monitoring checkpoint: hold only while price stays above the stop zone and upside probability does not weaken.',
  };
};

const buildActionPlan = ({ plan, market, signal, position, recommendation, forecastSeries, exitPlan }) => {
  const sorted = [...forecastSeries].sort((a, b) => Number(a.hours) - Number(b.hours));
  const currentPrice = toNumber(market.currentPrice);
  const action = signal?.action || 'HOLD';
  const confidence = toNumber(signal?.confidence, 0.5);
  const volatility = toNumber(market.volatility7d, 3);
  const nearTerm = sorted.filter((point) => Number(point.hours) <= 168);
  const reviewUniverse = nearTerm.length ? nearTerm : sorted;
  const maxProfitPoint = reviewUniverse.reduce((best, point) => {
    const score =
      Number(point.expectedPrice) *
      (Number(point.probabilityUp) / 100) *
      (1 + Math.max(Number(point.expectedMovePct), 0) / 100);
    const bestScore =
      Number(best.expectedPrice) *
      (Number(best.probabilityUp) / 100) *
      (1 + Math.max(Number(best.expectedMovePct), 0) / 100);
    return score > bestScore ? point : best;
  }, reviewUniverse[0] || sorted[0]);
  const downsidePoint =
    reviewUniverse.find((point) => Number(point.probabilityUp) < 45 || Number(point.expectedMovePct) < -1) ||
    sorted.find((point) => Number(point.lowRange) <= Number(recommendation.suggestedStop || 0)) ||
    reviewUniverse[0] ||
    sorted[0];
  const hasConstructiveForecast =
    Number(maxProfitPoint?.probabilityUp || 0) >= 58 &&
    Number(maxProfitPoint?.expectedMovePct || 0) >= 1 &&
    Number(maxProfitPoint?.expectedPrice || 0) > currentPrice;

  if (plan.status === 'OPEN') {
    const stop = Number(plan.stopLossPrice) > 0 ? Number(plan.stopLossPrice) : recommendation.suggestedStop;
    const profit = Number(plan.targetPrice) > 0 ? Number(plan.targetPrice) : recommendation.suggestedProfit;
    const riskReviewNow =
      action === 'SELL' ||
      (Number.isFinite(stop) && currentPrice <= stop) ||
      recommendation.stance === 'REDUCE_RISK';
    const profitReviewNow =
      Number.isFinite(profit) &&
      currentPrice >= profit &&
      (confidence < 0.68 || Number(position.pnlPct) > volatility * 2);
    const decision = riskReviewNow
      ? 'RISK_REVIEW_NOW'
      : profitReviewNow
        ? 'PROFIT_REVIEW_NOW'
        : action === 'BUY' && hasConstructiveForecast
          ? 'HOLD_FOR_UPSIDE'
          : 'HOLD_AND_REVIEW';
    const profitTargetActive = decision !== 'RISK_REVIEW_NOW' && hasConstructiveForecast;

    return {
      decision,
      primaryAction:
        decision === 'RISK_REVIEW_NOW'
          ? 'Risk check active'
          : decision === 'PROFIT_REVIEW_NOW'
            ? 'Profit review now'
            : decision === 'HOLD_FOR_UPSIDE'
              ? 'Hold for upside'
              : 'Hold and review',
      now:
        decision === 'RISK_REVIEW_NOW'
          ? 'Risk is elevated, but this is not an automatic sell order. Compare the live exchange price with your own risk limit before changing the position.'
          : decision === 'PROFIT_REVIEW_NOW'
            ? 'Price is inside the profit review zone. Consider protecting gains, but do not treat this as an automatic sell order.'
            : 'No urgent exit is detected. Keep reviewing price, confidence, and stop zone before making any trade decision.',
      buyGuidance:
        hasConstructiveForecast
          ? 'Already bought: adding more is only reasonable if the signal stays BUY, confidence remains strong, and price holds above the risk zone.'
          : 'Already bought: do not add more. The current forecast does not show enough upside edge for increasing exposure.',
      sellGuidance:
        decision === 'RISK_REVIEW_NOW'
          ? 'Review reducing exposure only if your exchange price is at or below the stop review zone, or if the SELL signal remains active after your next manual check.'
          : `Already bought: review selling near ${exitPlan?.profitTargetReached ? 'the expected profit path' : 'the upper forecast range'}; take profit if momentum weakens near the target.`,
      maxProfitWindow: profitTargetActive ? maxProfitPoint?.timestamp : null,
      maxProfitExpectedPrice: profitTargetActive ? maxProfitPoint?.highRange || maxProfitPoint?.expectedPrice : null,
      maxProfitProbability: maxProfitPoint?.probabilityUp,
      riskWindow: exitPlan?.riskReviewAt || downsidePoint?.timestamp,
      riskPrice: exitPlan?.lowAtRiskReview || downsidePoint?.lowRange,
      stopPrice: stop,
      targetPrice: profitTargetActive ? profit : null,
      confidenceScore: Number((confidence * 100).toFixed(3)),
      summary: `For this already-bought position, Quantora is showing a ${decision === 'RISK_REVIEW_NOW' ? 'risk review' : decision === 'PROFIT_REVIEW_NOW' ? 'profit review' : 'hold review'} based on live price, signal confidence, volatility, and the forecast path. Treat these as review zones, not trade orders.`,
    };
  }

  const suggestedEntry = recommendation.suggestedEntry || plan.entryPrice;
  const avoidAbove = recommendation.avoidAbove;
  const entryDiscountPct = suggestedEntry > 0 ? ((currentPrice - suggestedEntry) / suggestedEntry) * 100 : 0;
  const projectedTarget = hasConstructiveForecast ? maxProfitPoint?.highRange || maxProfitPoint?.expectedPrice : null;
  const stopAfterEntry = recommendation.suggestedEntry
    ? Number((recommendation.suggestedEntry * (1 - clamp(volatility * 1.2, 3, 14) / 100)).toFixed(currentPrice >= 1 ? 2 : 8))
    : null;
  const rewardPct =
    Number.isFinite(projectedTarget) && suggestedEntry > 0
      ? ((projectedTarget - suggestedEntry) / suggestedEntry) * 100
      : 0;
  const riskPct =
    Number.isFinite(stopAfterEntry) && suggestedEntry > 0
      ? ((suggestedEntry - stopAfterEntry) / suggestedEntry) * 100
      : 0;
  const rewardRisk = riskPct > 0 ? rewardPct / riskPct : 0;
  const buySetupActive =
    action === 'BUY' &&
    confidence >= 0.62 &&
    Math.abs(entryDiscountPct) <= clamp(volatility, 1.2, 6) &&
    hasConstructiveForecast &&
    rewardRisk >= 1.2;
  const waitForDip = Number.isFinite(avoidAbove) && currentPrice > avoidAbove;
  const decision = buySetupActive
    ? 'BUY_REVIEW_ACTIVE'
    : waitForDip || action === 'SELL'
      ? 'WAIT_FOR_BETTER_ENTRY'
      : 'NO_TRADE_SETUP';

  return {
    decision,
    primaryAction:
      decision === 'BUY_REVIEW_ACTIVE'
        ? 'Buy review active'
        : decision === 'WAIT_FOR_BETTER_ENTRY'
          ? 'Wait for better entry'
          : 'No trade setup',
    now:
      decision === 'BUY_REVIEW_ACTIVE'
        ? 'The setup is strong enough for a manual buy review: price is near entry, signal is BUY, upside probability is elevated, and reward/risk is acceptable.'
        : decision === 'WAIT_FOR_BETTER_ENTRY'
          ? 'Do not chase the move. Wait for price to return closer to the suggested entry zone or for confidence to improve.'
          : 'Do not buy yet. The current setup does not have enough upside probability, confidence, or reward/risk edge.',
    buyGuidance:
      decision === 'BUY_REVIEW_ACTIVE'
        ? 'Planning to buy: use this only as a review zone. Start small, define the stop first, and avoid entry if live price jumps above the avoid-chasing level.'
        : `Planning to buy: wait. A valid buy setup requires BUY signal, stronger upside probability, acceptable reward/risk, and price near the entry zone.`,
    sellGuidance: 'After you buy: define the stop before entry and only review profit-taking if price moves toward a confirmed upside target.',
    maxProfitWindow: hasConstructiveForecast ? maxProfitPoint?.timestamp : null,
    maxProfitExpectedPrice: projectedTarget,
    maxProfitProbability: maxProfitPoint?.probabilityUp,
    riskWindow: downsidePoint?.timestamp,
    riskPrice: Math.min(Number(downsidePoint?.lowRange || currentPrice), currentPrice),
    stopPrice: stopAfterEntry,
    targetPrice: projectedTarget,
    confidenceScore: Number((confidence * 100).toFixed(3)),
    rewardRisk: Number(rewardRisk.toFixed(3)),
    summary: `For this planned buy, Quantora will not call a buy unless signal quality, upside probability, entry distance, and reward/risk all pass together.`,
  };
};

export const analyzeInvestmentPlan = async (plan) => {
  const [snapshot, signal] = await Promise.all([
    getCryptoData(plan.coinId),
    Prediction.findOne({ coinId: plan.coinId, sourceType: 'raw' }).sort({ createdAt: -1 }).lean(),
  ]);

  const currentPrice = toNumber(snapshot.price);
  const entryPrice = toNumber(plan.entryPrice);
  const quantity = toNumber(plan.quantity);
  const capitalUsd = quantity > 0 ? quantity * entryPrice : toNumber(plan.capitalUsd);
  const currentValue = quantity > 0 ? quantity * currentPrice : capitalUsd * (entryPrice > 0 ? currentPrice / entryPrice : 0);
  const pnlUsd = plan.status === 'OPEN' ? currentValue - capitalUsd : 0;
  const pnlPct = plan.status === 'OPEN' && entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  const distanceToEntryPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
  const momentum = toNumber(signal?.momentum, toNumber(snapshot.change_24h));
  const forecast = buildForecast({
    currentPrice,
    change24h: toNumber(snapshot.change_24h),
    volatility: toNumber(snapshot.volatility_7d),
    momentum,
    signal,
  });
  const forecastSeries = buildForecastSeries({
    currentPrice,
    change24h: toNumber(snapshot.change_24h),
    volatility: toNumber(snapshot.volatility_7d),
    momentum,
    signal,
  });

  const recommendation = buildRecommendation({
    plan,
    snapshot,
    signal,
    pnlPct,
    distanceToEntryPct,
    forecast,
  });
  const exitPlan = buildExitPlan({ plan, recommendation, forecastSeries });
  const market = {
    coinId: snapshot.coinId,
    name: snapshot.name,
    symbol: snapshot.symbol,
    image: snapshot.image,
    currentPrice,
    change24h: toNumber(snapshot.change_24h),
    volatility7d: toNumber(snapshot.volatility_7d),
    source: snapshot.source,
    lastUpdated: snapshot.lastUpdated,
  };
  const position = {
    capitalUsd: Number(capitalUsd.toFixed(2)),
    currentValue: Number(currentValue.toFixed(2)),
    pnlUsd: Number(pnlUsd.toFixed(2)),
    pnlPct: Number(pnlPct.toFixed(3)),
    distanceToEntryPct: Number(distanceToEntryPct.toFixed(3)),
  };
  const actionPlan = buildActionPlan({
    plan,
    market,
    signal,
    position,
    recommendation,
    forecastSeries,
    exitPlan,
  });

  return {
    plan: plan.toObject ? plan.toObject() : plan,
    market,
    signal: signal
      ? {
          action: signal.action,
          confidence: signal.confidence,
          riskLevel: signal.riskLevel,
          trendDirection: signal.trendDirection,
          predictionHorizon: signal.predictionHorizon,
          momentum: signal.momentum,
          marketStrength: signal.marketStrength,
          reasoning: signal.reasoning || signal.reason,
          createdAt: signal.createdAt,
        }
      : null,
    position,
    recommendation,
    exitPlan,
    actionPlan,
    forecast,
    forecastSeries,
    disclaimer: 'AI-generated planning analysis only. Quantora does not execute trades and this is not financial advice.',
  };
};

export const listInvestmentPlans = async (sessionId) => {
  const plans = await InvestmentPlan.find({ sessionId }).sort({ updatedAt: -1 });
  const analyses = await Promise.allSettled(plans.map((plan) => analyzeInvestmentPlan(plan)));
  return analyses.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : { plan: plans[index].toObject(), error: result.reason?.message || 'Analysis unavailable' }
  );
};

export const createInvestmentPlan = (payload) => InvestmentPlan.create(payload);

export const migrateInvestmentPlans = async ({ fromSessionId, toSessionId }) => {
  if (!fromSessionId || !toSessionId || fromSessionId === toSessionId) {
    return { migrated: 0, removedDuplicates: 0 };
  }

  const legacyPlans = await InvestmentPlan.find({ sessionId: fromSessionId });
  let migrated = 0;
  let removedDuplicates = 0;

  for (const plan of legacyPlans) {
    const duplicate = await InvestmentPlan.findOne({
      sessionId: toSessionId,
      coinId: plan.coinId,
      status: plan.status,
      entryPrice: plan.entryPrice,
      createdAt: plan.createdAt,
    });

    if (duplicate) {
      await InvestmentPlan.deleteOne({ _id: plan._id });
      removedDuplicates += 1;
      continue;
    }

    plan.sessionId = toSessionId;
    await plan.save();
    migrated += 1;
  }

  return { migrated, removedDuplicates };
};

export const updateInvestmentPlan = async ({ sessionId, id, updates }) =>
  InvestmentPlan.findOneAndUpdate({ _id: id, sessionId }, updates, { new: true });

export const deleteInvestmentPlan = async ({ sessionId, id }) =>
  InvestmentPlan.deleteOne({ _id: id, sessionId });
