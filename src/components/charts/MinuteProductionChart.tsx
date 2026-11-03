import { Bar } from 'react-chartjs-2';
import { chartColors, baseLineOptions } from '../../lib/chartDefaults';
import { useTheme } from '../../lib/theme';

// 최근 N분 분당 생산량 (수신이 없는 분은 막대를 그리지 않음)
export function MinuteProductionChart({ points }: { points: { label: string; output: number | null }[] }) {
  const theme = useTheme();
  return (
    <Bar
      key={theme}
      data={{
        labels: points.map((p) => p.label),
        datasets: [{ label: '생산량', data: points.map((p) => p.output), backgroundColor: chartColors.primary, borderRadius: 1 }],
      }}
      options={{
        ...baseLineOptions,
        scales: {
          ...baseLineOptions.scales,
          x: { ...baseLineOptions.scales.x, ticks: { ...baseLineOptions.scales.x.ticks, maxTicksLimit: 6, maxRotation: 0 } },
        },
      } as never}
    />
  );
}
