const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const pct = (value) => `${toNumber(value).toFixed(2)}%`;
const roundConfidence = (value) => Number(value.toFixed(5));

const computeMomentum = ({ change24h, marketPrice, avgPrice }) => {
  const priceVsAverage = avgPrice > 0 ? ((marketPrice - avgPrice) / avgPrice) * 100 : 0;
  return change24h * 0.65 + priceVsAverage * 0.35;
};

const computePriceVsAverage = ({ marketPrice, avgPrice }) =>
  avgPrice > 0 ? ((marketPrice - avgPrice) / avgPrice) * 100 : 0;

const classifyTrend = ({ momentum, change24h, priceVsAverage }) => {
  if (momentum >= 1.2 && change24h >= 0.4 && priceVsAverage >= -0.8) return 'UPTREND';
  if (momentum <= -1.2 && change24h <= -0.4 && priceVsAverage <= 0.8) return 'DOWNTREND';
  return 'SIDEWAYS';
};

const classifyRisk = (volatility, confidence, action) => {
  if (volatility >= 9 || confidence < 0.48) return 'HIGH';
  if (volatility >= 4.5 || action === 'SELL') return 'MEDIUM';
  return 'LOW';
};

const actionReason = ({ action, coinName, change24h, volatility, momentum, trendDirection }) => {
  const assetName = coinName || 'This asset';
  if (action === 'BUY') {
    return `${assetName} is showing constructive momentum: 24h price movement is ${pct(change24h)}, volatility is ${pct(volatility)}, and the trend reads ${trendDirection.toLowerCase()}. The signal favors upside continuation while risk remains controlled.`;
  }
  if (action === 'SELL') {
    return `${assetName} is under downside pressure: 24h price movement is ${pct(change24h)}, volatility is ${pct(volatility)}, and momentum is negative at ${momentum.toFixed(2)}. The signal prioritizes risk reduction until strength improves.`;
  }
  return `${assetName} is moving without a strong directional edge. 24h price movement is ${pct(change24h)}, volatility is ${pct(volatility)}, and momentum is modest at ${momentum.toFixed(2)}, so the signal stays neutral until a clearer trend forms.`;
};

const actionFromTrend = ({ trendDirection, momentum, change24h, priceVsAverage, volatility }) => {
  const volatilityGate = Math.max(0.85, volatility * 0.18);
  const bullishSetup =
    trendDirection === 'UPTREND' &&
    momentum >= volatilityGate &&
    change24h >= 0.65 &&
    priceVsAverage >= -1.5 &&
    volatility < 12;
  const bearishSetup =
    trendDirection === 'DOWNTREND' &&
    Math.abs(momentum) >= volatilityGate &&
    change24h <= -0.65 &&
    priceVsAverage <= 1.5;

  if (bullishSetup) return 'BUY';
  if (bearishSetup) {
    return 'SELL';
  }
  return 'HOLD';
};

export const buildQuantoraFallbackSignal = ({
  change24h = 0,
  volatility = 0,
  avgPrice = 0,
  marketPrice = 0,
  coinName,
  providerFailure,
}) => {
  const priceVsAverage = computePriceVsAverage({ marketPrice, avgPrice });
  const momentum = computeMomentum({ change24h, marketPrice, avgPrice });
  const trendDirection = classifyTrend({ momentum, change24h, priceVsAverage });
  const action = actionFromTrend({ trendDirection, momentum, change24h, priceVsAverage, volatility });
  const directionStrength = clamp(Math.abs(momentum) / 6, 0, 1);
  const changeStrength = clamp(Math.abs(change24h) / 8, 0, 1);
  const volatilityDrag = clamp(volatility / 18, 0, 1);
  const priceExtension = clamp(Math.abs(priceVsAverage) / 10, 0, 1);
  const trendConfirmation = trendDirection === 'SIDEWAYS' ? 0 : 1;
  const confidence =
    action === 'HOLD'
      ? clamp(
          0.36 +
            clamp(1 - directionStrength, 0, 1) * 0.16 +
            clamp(1 - volatilityDrag, 0, 1) * 0.12 +
            clamp(1 - priceExtension, 0, 1) * 0.08 +
            clamp(1 - changeStrength, 0, 1) * 0.04 -
            volatilityDrag * 0.03,
          0.35,
          0.74
        )
      : clamp(
          0.39 +
            directionStrength * 0.2 +
            changeStrength * 0.12 +
            trendConfirmation * 0.11 +
            clamp(Math.abs(priceVsAverage) / 5, 0, 1) * 0.08 -
            volatilityDrag * 0.14 -
            (priceExtension > 0.75 ? 0.06 : 0),
          0.38,
          0.9
        );
  const riskLevel = classifyRisk(volatility, confidence, action);
  const predictionHorizon = riskLevel === 'HIGH' ? '12-24H' : '24-72H';

  const reasoning = actionReason({
    action,
    coinName,
    change24h,
    volatility,
    momentum,
    trendDirection,
  });

  return {
    action,
    confidence: roundConfidence(confidence),
    reasoning,
    reason: reasoning,
    riskLevel,
    trendDirection,
    predictionHorizon,
    momentum: Number(momentum.toFixed(3)),
    marketStrength: Number(clamp(50 + momentum * 5 - volatility, 0, 100).toFixed(3)),
    providerStatus: providerFailure ? 'FALLBACK_ACTIVE' : 'QUANTORA_MODEL',
    raw: {
      fallback: Boolean(providerFailure),
      source: 'quantora-deterministic-engine',
      change24h,
      volatility,
      avgPrice,
      marketPrice,
      momentum,
      priceVsAverage,
      confidenceInputs: {
        directionStrength: Number(directionStrength.toFixed(5)),
        changeStrength: Number(changeStrength.toFixed(5)),
        volatilityDrag: Number(volatilityDrag.toFixed(5)),
        priceExtension: Number(priceExtension.toFixed(5)),
        trendConfirmation,
      },
    },
  };
};

export const normalizeProviderSignal = (signal, marketContext) => {
  const fallback = buildQuantoraFallbackSignal({
    ...marketContext,
    providerFailure: false,
  });
  const action = ['BUY', 'HOLD', 'SELL'].includes(signal?.action) ? signal.action : fallback.action;
  const confidence = clamp(toNumber(signal?.confidence, fallback.confidence), 0, 1);
  const riskLevel = ['LOW', 'MEDIUM', 'HIGH'].includes(signal?.riskLevel)
    ? signal.riskLevel
    : fallback.riskLevel;
  const trendDirection = ['UPTREND', 'SIDEWAYS', 'DOWNTREND'].includes(signal?.trendDirection)
    ? signal.trendDirection
    : fallback.trendDirection;

  return {
    action,
    confidence: roundConfidence(confidence),
    reasoning: String(signal?.reasoning || signal?.reason || fallback.reasoning).slice(0, 700),
    reason: String(signal?.reasoning || signal?.reason || fallback.reasoning).slice(0, 700),
    riskLevel,
    trendDirection,
    predictionHorizon: String(signal?.predictionHorizon || fallback.predictionHorizon).slice(0, 24),
    momentum: toNumber(signal?.momentum, fallback.momentum),
    marketStrength: toNumber(signal?.marketStrength, fallback.marketStrength),
    providerStatus: signal?.providerStatus || 'AI_PROVIDER',
    raw: signal?.raw,
  };
};
