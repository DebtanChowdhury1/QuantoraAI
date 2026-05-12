import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatConfidencePercent } from '@/lib/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const actionColors = {
  BUY: '#00ff88',
  HOLD: '#ffc400',
  SELL: '#fb7185',
};

const ConfidenceChart = ({ history = [] }) => {
  const points = useMemo(
    () =>
      [...history]
        .filter((item) => Number.isFinite(Number(item.confidence)))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-40),
    [history]
  );

  const chartData = useMemo(
    () => {
      const values = points.map((item) => Number(item.confidence) * 100);
      const isPositiveTrend = values.length < 2 || values[values.length - 1] >= values[0];
      const trendColor = isPositiveTrend ? '#00ff88' : '#f6465d';
      const segmentColor = (context) => {
        const previous = Number(context.p0?.parsed?.y);
        const next = Number(context.p1?.parsed?.y);
        if (!Number.isFinite(previous) || !Number.isFinite(next)) return trendColor;
        return next >= previous ? '#00ff88' : '#f6465d';
      };

      return {
        labels: points.map((item) => new Date(item.createdAt).getTime()),
        datasets: [
          {
            label: 'Confidence',
            data: values,
            borderColor: trendColor,
            backgroundColor: isPositiveTrend ? 'rgba(0, 255, 136, 0.1)' : 'rgba(246, 70, 93, 0.1)',
            segment: { borderColor: segmentColor },
            pointBackgroundColor: points.map((item) => actionColors[item.action] || '#94a3b8'),
            pointBorderColor: '#020617',
            pointHoverRadius: 6,
            pointRadius: 4,
            fill: true,
            tension: 0.35,
          },
        ],
      };
    },
    [points]
  );

  const yBounds = useMemo(() => {
    const values = points.map((item) => Number(item.confidence) * 100);
    if (!values.length) {
      return { min: 0, max: 100, stable: false };
    }

    const lowest = Math.min(...values);
    const highest = Math.max(...values);
    const spread = highest - lowest;

    if (spread < 0.5) {
      return {
        min: Math.max(0, Math.floor(lowest - 5)),
        max: Math.min(100, Math.ceil(highest + 5)),
        stable: true,
      };
    }

    return {
      min: Math.max(0, Math.floor(lowest - Math.max(3, spread * 0.35))),
      max: Math.min(100, Math.ceil(highest + Math.max(3, spread * 0.35))),
      stable: false,
    };
  }, [points]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false,
          mode: 'index',
          displayColors: false,
          backgroundColor: 'rgba(2, 6, 23, 0.96)',
          borderColor: 'rgba(0, 255, 136, 0.45)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => {
              const timestamp = Number(items?.[0]?.label);
              return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(timestamp));
            },
            label: (context) => {
              const item = points[context.dataIndex];
              return `${item.action} confidence: ${context.parsed.y.toFixed(3)}%`;
            },
            afterLabel: (context) => {
              const item = points[context.dataIndex];
              return `Risk: ${item.riskLevel || 'MEDIUM'} | Trend: ${item.trendDirection || 'SIDEWAYS'}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 5,
            callback: (_value, index) =>
              new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
              }).format(new Date(points[index]?.createdAt)),
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
        },
        y: {
          min: yBounds.min,
          max: yBounds.max,
          ticks: {
            color: '#94a3b8',
            callback: (value) => `${Number(value).toFixed(2)}%`,
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
        },
      },
    }),
    [points, yBounds]
  );

  if (!points.length) {
    return (
      <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
        <h3 className="text-lg font-semibold text-neutral-100">Confidence Chart</h3>
        <p className="mt-4 text-sm text-neutral-400">No confidence history available yet.</p>
      </div>
    );
  }

  const latest = points[points.length - 1];

  return (
    <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">Confidence Chart</h3>
          <p className="text-sm text-neutral-400">
            Confidence calibration across recent live signals
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Latest</p>
          <p className="text-2xl font-semibold text-accent">
            {formatConfidencePercent(latest.confidence)}
          </p>
        </div>
      </div>
      <div className="mt-6 h-64">
        <Line data={chartData} options={options} />
      </div>
      {yBounds.stable && (
        <p className="mt-3 text-xs text-neutral-500">
          Confidence is stable because market inputs are currently similar. Quantora does not add
          artificial movement.
        </p>
      )}
    </div>
  );
};

export default ConfidenceChart;
