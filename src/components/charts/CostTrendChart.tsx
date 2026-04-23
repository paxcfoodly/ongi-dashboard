import { Line } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

interface DayPoint {
  label: string;
  value: number;
}

export function CostTrendChart({ points, target }: { points: DayPoint[]; target: number }) {
  return (
    <Line
      data={{
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: '실적',
            data: points.map((p) => p.value),
            borderColor: chartColors.amber,
            backgroundColor: chartColors.amber + '22',
            fill: true,
            tension: 0.3,
          },
          {
            label: '목표',
            data: points.map(() => target),
            borderColor: chartColors.danger,
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      }}
      options={baseLineOptions as never}
    />
  );
}
