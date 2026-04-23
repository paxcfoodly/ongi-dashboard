import { Bar } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

export function PrfBarChart() {
  // Phase 1 스펙: Precision/Recall/F1은 ground truth 부재로 mock
  return (
    <Bar
      data={{
        labels: ['Precision', 'Recall', 'F1'],
        datasets: [
          { label: '목표', data: [97, 99, 98], backgroundColor: chartColors.primary + '55' },
          { label: '현재', data: [95, 97, 96], backgroundColor: chartColors.good },
        ],
      }}
      options={{
        ...baseLineOptions,
        scales: { ...baseLineOptions.scales, y: { ...baseLineOptions.scales.y, max: 100 } },
      } as never}
    />
  );
}
