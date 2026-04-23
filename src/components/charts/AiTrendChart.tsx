import { Line } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

export function AiTrendChart({
  labels,
  detection,
  recheck,
}: {
  labels: string[];
  detection: number[];
  recheck: number[];
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: '불량검출율',
            data: detection,
            borderColor: chartColors.good,
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: '재검율',
            data: recheck,
            borderColor: chartColors.danger,
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      }}
      options={{
        ...baseLineOptions,
        scales: {
          ...baseLineOptions.scales,
          y:  { ...baseLineOptions.scales.y,  position: 'left' as const },
          y1: { ...baseLineOptions.scales.y,  position: 'right' as const, grid: { drawOnChartArea: false } },
        },
      } as never}
    />
  );
}
