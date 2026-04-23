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

export const chartColors = {
  primary: '#1E64B4',
  primaryLight: '#D2E6FA',
  good: '#1D9E75',
  amber: '#E8933A',
  danger: '#D94444',
  gray: '#8CA0B8',
  grid: '#DCE6F2',
  text: '#0F2340',
  textDim: '#5F708A',
};

export const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#FFFFFF',
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
