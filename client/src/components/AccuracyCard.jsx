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
    <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Weekly Accuracy</p>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-4xl font-bold text-accent">{score}%</p>
          <p className="text-sm text-neutral-400">Based on {samples} latest signals</p>
        </div>
        <div className="text-right text-sm text-neutral-300">
          <p>Goal: 65%</p>
          <p className="text-xs text-neutral-500">
            Calculated via historical signal vs 24h trend alignment
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccuracyCard;
