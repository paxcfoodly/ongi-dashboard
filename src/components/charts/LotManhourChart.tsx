import { Bar } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';
import type { LotManhourRow } from '../../hooks/useManhourKpi';

// LOT별 작업공수 막대 + 목표선 (훅은 최신순이므로 시간순으로 뒤집어 표시)
// 목표가 없으면(undefined) 0선 대신 목표 데이터셋 자체를 생략한다
export function LotManhourChart({ rows, target }: { rows: LotManhourRow[]; target: number | undefined }) {
  const ordered = rows.filter((r) => r.man_hour != null).slice().reverse();
  return (
    <Bar
      data={{
        labels: ordered.map((r) => r.lot_no),
        datasets: [
          {
            label: '작업공수',
            data: ordered.map((r) => r.man_hour),
            backgroundColor: chartColors.primary,
            borderRadius: 4,
          },
          ...(target == null ? [] : [{
            label: '목표',
            data: ordered.map(() => target),
            type: 'line' as const,
            borderColor: chartColors.danger,
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
