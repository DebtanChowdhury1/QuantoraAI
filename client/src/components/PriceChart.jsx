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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const PriceChart = ({ prices = [] }) => {
  const chartData = useMemo(() => {
    const labels = prices.map(([timestamp]) =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
      }).format(new Date(timestamp))
    );
    const data = prices.map(([, price]) => price);
    return {
      labels,
      datasets: [
        {
          label: 'Price (USD)',
          data,
          fill: true,
          tension: 0.3,
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          pointRadius: 0,
        },
      ],
    };
  }, [prices]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) =>
              `$${context.parsed.y.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
        },
      },
    }),
    []
  );

  return (
    <div className="h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default PriceChart;
