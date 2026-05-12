const computeAccuracy = (predictions = []) => {
  if (!predictions.length) {
    return { score: 0, samples: 0 };
  }
  const mapped = predictions.slice(0, 20);
  let hits = 0;
  mapped.forEach((item) => {
    const trend = item.change24h;
    if (item.action === 'BUY' && trend > 0) hits += 1;
    if (item.action === 'SELL' && trend < 0) hits += 1;
    if (item.action === 'HOLD' && Math.abs(trend) < 1) hits += 1;
  });
  return {
    score: Math.round((hits / mapped.length) * 100),
    samples: mapped.length,
  };
};

const AccuracyCard = ({ predictions = [] }) => {
  const { score, samples } = computeAccuracy(predictions);
  return (
    <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Signal Alignment</p>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-4xl font-bold text-accent">{score}%</p>
          <p className="text-sm text-neutral-400">
            {samples ? `${samples} recent signals matched against 24h movement` : 'Waiting for enough signals'}
          </p>
        </div>
        <div className="text-right text-sm text-neutral-300">
          <p>Benchmark: 65%</p>
          <p className="text-xs text-neutral-500">
            BUY counts correct when price moved up, SELL when price moved down, HOLD when price stayed range-bound.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccuracyCard;
