import { useMemo, useState } from 'react';
import clsx from 'clsx';
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
import { useCurrency } from '@/context/CurrencyContext';
import { formatCurrency, formatPercent } from '@/lib/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const ranges = [
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
  { label: '30D', hours: 720 },
  { label: '90D', hours: 2160 },
  { label: '1Y', hours: 8760 },
];

const ForecastTrendChart = ({ series = [] }) => {
  const [activeRange, setActiveRange] = useState('1Y');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const { currency, rate } = useCurrency();
  const maxHours = ranges.find((item) => item.label === activeRange)?.hours || 8760;
  const points = useMemo(
    () => series.filter((item) => Number(item.hours) <= maxHours),
    [series, maxHours]
  );

  const chartData = useMemo(
    () => {
      const expectedPrices = points.map((item) => Number(item.expectedPrice)).filter(Number.isFinite);
      const isPositiveTrend =
        expectedPrices.length < 2 || expectedPrices[expectedPrices.length - 1] >= expectedPrices[0];
      const trendColor = isPositiveTrend ? '#00ff88' : '#f6465d';
      const trendSoft = isPositiveTrend ? 'rgba(0, 255, 136, 0.1)' : 'rgba(246, 70, 93, 0.1)';
      const rangeColor = isPositiveTrend ? 'rgba(0, 255, 136, 0.28)' : 'rgba(246, 70, 93, 0.28)';
      const rangeFill = isPositiveTrend ? 'rgba(0, 255, 136, 0.07)' : 'rgba(246, 70, 93, 0.07)';
      const segmentColor = (context) => {
        const previous = Number(context.p0?.parsed?.y);
        const next = Number(context.p1?.parsed?.y);
        if (!Number.isFinite(previous) || !Number.isFinite(next)) return trendColor;
        return next >= previous ? '#00ff88' : '#f6465d';
      };
      const rangeSegmentColor = (context) => {
        const previous = Number(context.p0?.parsed?.y);
        const next = Number(context.p1?.parsed?.y);
        if (!Number.isFinite(previous) || !Number.isFinite(next)) return rangeColor;
        return next >= previous ? 'rgba(0, 255, 136, 0.32)' : 'rgba(246, 70, 93, 0.32)';
      };

      return {
        labels: points.map((item) => item.timestamp),
        datasets: [
          {
            label: 'High range',
            data: points.map((item) => Number(item.highRange) * rate),
            borderColor: rangeColor,
            backgroundColor: rangeFill,
            segment: { borderColor: rangeSegmentColor },
            pointRadius: 0,
            tension: 0.35,
            fill: '+1',
          },
          {
            label: 'Expected',
            data: points.map((item) => Number(item.expectedPrice) * rate),
            borderColor: trendColor,
            backgroundColor: trendSoft,
            segment: { borderColor: segmentColor },
            pointRadius: 0,
            pointHitRadius: 12,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 2,
            pointHoverBackgroundColor: '#020617',
            pointHoverBorderColor: trendColor,
            tension: 0.35,
          },
          {
            label: 'Low range',
            data: points.map((item) => Number(item.lowRange) * rate),
            borderColor: rangeColor,
            backgroundColor: rangeFill,
            segment: { borderColor: rangeSegmentColor },
            pointRadius: 0,
            tension: 0.35,
            fill: false,
          },
        ],
      };
    },
    [points, rate]
  );

  const selectedPoint =
    points[selectedIndex ?? points.length - 1] || points[points.length - 1];

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', boxWidth: 10, usePointStyle: true },
        },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(2, 6, 23, 0.96)',
          borderColor: 'rgba(0, 255, 136, 0.45)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => {
              const point = points[items?.[0]?.dataIndex];
              return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: activeRange === '1Y' ? 'numeric' : undefined,
                hour: point?.granularity === 'hour' ? 'numeric' : undefined,
                minute: point?.granularity === 'hour' ? '2-digit' : undefined,
              }).format(new Date(point?.timestamp));
            },
            label: (context) => {
              if (context.dataset.label === 'Expected') {
                return `Expected: ${formatCurrency(context.parsed.y, { currency })}`;
              }
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y, { currency })}`;
            },
            afterBody: (items) => {
              const point = points[items?.[0]?.dataIndex];
              if (!point) return [];
              return [
                `Move: ${formatPercent(point.expectedMovePct)}`,
                `Probability up: ${point.probabilityUp.toFixed(3)}%`,
                `Granularity: ${point.granularity}`,
              ];
            },
          },
        },
      },
      onHover: (_event, elements) => {
        if (elements?.length) {
          setSelectedIndex(elements[0].index);
        }
      },
      onClick: (_event, elements) => {
        if (elements?.length) {
          setSelectedIndex(elements[0].index);
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            callback: (_value, index) =>
              new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: points[index]?.granularity === 'hour' ? 'numeric' : undefined,
              }).format(new Date(points[index]?.timestamp)),
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
        },
        y: {
          ticks: {
            color: '#94a3b8',
            callback: (value) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency,
                notation: 'compact',
                maximumFractionDigits: 2,
              }).format(value),
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
        },
      },
    }),
    [activeRange, currency, points]
  );

  if (!points.length) {
    return (
      <div className="rounded-2xl border border-neutral-700/50 bg-neutral-950/40 p-5 text-sm text-neutral-400">
        Forecast trend is not available yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-700/50 bg-neutral-950/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">Forecast Trend</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-100">Expected range over time</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Hover anywhere along the line to inspect date, expected range, move, probability, and time granularity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => setActiveRange(range.label)}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                activeRange === range.label
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 h-72">
        <Line data={chartData} options={options} />
      </div>
      {selectedPoint?.report && (
        <div className="mt-5 rounded-2xl border border-accent/20 bg-neutral-900/80 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">Point Report</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-100">
                {selectedPoint.report.title}
              </h4>
              <p className="mt-1 text-xs text-neutral-500">
                {new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: selectedPoint.hours >= 2160 ? 'numeric' : undefined,
                  hour: selectedPoint.granularity === 'hour' ? 'numeric' : undefined,
                  minute: selectedPoint.granularity === 'hour' ? '2-digit' : undefined,
                }).format(new Date(selectedPoint.timestamp))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <ReportMetric
                label="Expected"
                value={formatCurrency(Number(selectedPoint.expectedPrice) * rate, { currency })}
                accent={selectedPoint.expectedMovePct >= 0 ? 'text-accent' : 'text-red-400'}
              />
              <ReportMetric
                label="Move"
                value={formatPercent(selectedPoint.expectedMovePct)}
                accent={selectedPoint.expectedMovePct >= 0 ? 'text-accent' : 'text-red-400'}
              />
              <ReportMetric
                label="Prob. Up"
                value={`${Number(selectedPoint.probabilityUp).toFixed(3)}%`}
              />
              <ReportMetric label="Read" value={selectedPoint.report.direction} />
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-neutral-200">
            {selectedPoint.report.thesis}
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-neutral-700/50 bg-neutral-950/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">AI Reasoning</p>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-neutral-300">
                {selectedPoint.report.reasoning.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-neutral-700/50 bg-neutral-950/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Risk Read</p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                {selectedPoint.report.riskNote}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-700/50 bg-neutral-950/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">Invalidation</p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                {selectedPoint.report.invalidation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportMetric = ({ label, value, accent = 'text-neutral-100' }) => (
  <div className="rounded-xl border border-neutral-700/50 bg-neutral-950/60 px-3 py-2">
    <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
    <p className={clsx('mt-1 font-semibold', accent)}>{value}</p>
  </div>
);

export default ForecastTrendChart;
