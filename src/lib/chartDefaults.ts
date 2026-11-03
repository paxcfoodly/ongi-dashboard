import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// 전역 등록 (한 번만)
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type ChartTheme = 'light' | 'dark';

const palettes: Record<ChartTheme, Record<'primary' | 'primaryLight' | 'good' | 'amber' | 'danger' | 'gray' | 'grid' | 'text' | 'textDim' | 'tooltipBg', string>> = {
  light: {
    primary: '#1E64B4',
    primaryLight: '#D2E6FA',
    good: '#1D9E75',
    amber: '#E8933A',
    danger: '#D94444',
    gray: '#8CA0B8',
    grid: '#DCE6F2',
    text: '#0F2340',
    textDim: '#5F708A',
    tooltipBg: '#FFFFFF',
  },
  dark: {
    primary: '#6EA8EC',
    primaryLight: '#1F3A5F',
    good: '#34C98B',
    amber: '#F0A63E',
    danger: '#F26B6B',
    gray: '#98A8BE',
    grid: '#2E3C53',
    text: '#F2F6FC',
    textDim: '#B4C1D4',
    tooltipBg: '#243146',
  },
};

// 테마 전환 시 같은 객체를 갱신한다 — 차트는 useTheme()를 key로 써서 다시 그린다
export const chartColors = { ...palettes.light };

export const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.grid,
      borderWidth: 1,
      titleColor: chartColors.text,
      bodyColor: chartColors.textDim,
      titleFont: { family: 'JetBrains Mono', size: 11 },
      bodyFont: { family: 'JetBrains Mono', size: 11 },
      padding: 8,
    },
  },
  scales: {
    x: {
      ticks: { color: chartColors.textDim, font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: chartColors.grid, drawTicks: false },
    },
    y: {
      ticks: { color: chartColors.textDim, font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: chartColors.grid },
      beginAtZero: true,
    },
  },
};

export function applyChartTheme(theme: ChartTheme) {
  Object.assign(chartColors, palettes[theme]);
  const { tooltip } = baseLineOptions.plugins;
  tooltip.backgroundColor = chartColors.tooltipBg;
  tooltip.borderColor = chartColors.grid;
  tooltip.titleColor = chartColors.text;
  tooltip.bodyColor = chartColors.textDim;
  for (const axis of [baseLineOptions.scales.x, baseLineOptions.scales.y]) {
    axis.ticks.color = chartColors.textDim;
    axis.grid.color = chartColors.grid;
  }
}
