import { Bar } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';

interface HourBucket {
  hour: string;  // '08'
  output: number;
}

// 목표가 없으면(undefined) 0선 대신 목표 데이터셋 자체를 생략한다
export function HourlyProductionChart({ buckets, target }: { buckets: HourBucket[]; target: number | undefined }) {
  return (
    <Bar
      data={{
        labels: buckets.map((b) => b.hour),
        datasets: [
          { label: '실적', data: buckets.map((b) => b.output), backgroundColor: chartColors.good, borderRadius: 4 },
          ...(target == null ? [] : [{
            label: '목표',
            data: buckets.map(() => target),
            type: 'line' as const,
            borderColor: chartColors.gray,
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          }]),
        ],
      } as never}
      options={baseLineOptions as never}
    />
  );
}
