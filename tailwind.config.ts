import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bg: '#F5F8FC',
        surface: '#FFFFFF',
        surface2: '#EEF4FB',
        border: {
          DEFAULT: '#DCE6F2',
          strong: '#B9CCE1',
        },
        text: {
          DEFAULT: '#0F2340',
          dim: '#5F708A',
          muted: '#8CA0B8',
        },
        primary: {
          DEFAULT: '#1E64B4',
          light: '#D2E6FA',
          dark: '#154A89',
        },
        good: {
          DEFAULT: '#1D9E75',
          light: '#E6F5EE',
          dark: '#14704F',
        },
        warn: {
          DEFAULT: '#E8933A',
          light: '#FDF1DE',
          dark: '#A2600F',
        },
        danger: {
          DEFAULT: '#D94444',
          light: '#FBE6E6',
          dark: '#932929',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      backgroundImage: {
        'primary-gradient':
          'linear-gradient(90deg, #1E64B4 0%, #4A90D9 60%, #7FB5E8 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
