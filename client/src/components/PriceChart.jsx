import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useCurrency } from '@/context/CurrencyContext';
import { formatCurrency } from '@/lib/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const PriceChart = ({ prices = [] }) => {
  const { currency, rate } = useCurrency();

  const chartData = useMemo(() => {
    const labels = prices.map(([timestamp]) => timestamp);
    const data = prices.map(([, price]) => Number(price) * rate);
    const numericPrices = prices.map(([, price]) => Number(price)).filter(Number.isFinite);
    const isPositiveTrend =
      numericPrices.length < 2 || numericPrices[numericPrices.length - 1] >= numericPrices[0];
    const trendColor = isPositiveTrend ? '#00ff88' : '#f6465d';
    const trendFill = isPositiveTrend ? 'rgba(0, 255, 136, 0.1)' : 'rgba(246, 70, 93, 0.1)';
    const segmentColor = (context) => {
      const previous = Number(context.p0?.parsed?.y);
      const next = Number(context.p1?.parsed?.y);
      if (!Number.isFinite(previous) || !Number.isFinite(next)) return trendColor;
      return next >= previous ? '#00ff88' : '#f6465d';
    };

    return {
      labels,
      datasets: [
        {
          label: `Price (${currency})`,
          data,
          fill: true,
          tension: 0.3,
          borderColor: trendColor,
          backgroundColor: trendFill,
          segment: {
            borderColor: segmentColor,
            backgroundColor: segmentColor,
          },
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: '#020617',
          pointHoverBorderColor: trendColor,
        },
      ],
    };
  }, [prices, currency, rate]);

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
              const timestamp = items?.[0]?.label;
              return new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(Number(timestamp)));
            },
            label: (context) => `Price: ${formatCurrency(context.parsed.y, { currency })}`,
          },
        },
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
                hour: 'numeric',
              }).format(new Date(prices[index]?.[0])),
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
    [prices, currency]
  );

  return (
    <div className="h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default PriceChart;
