import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      // 실제 색상값은 src/index.css의 테마별 변수에 있음 (밝은·어두운 테마 전환)
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface2'),
        border: {
          DEFAULT: token('border'),
          strong: token('border-strong'),
        },
        text: {
          DEFAULT: token('text'),
          dim: token('text-dim'),
          muted: token('text-muted'),
        },
        primary: {
          DEFAULT: token('primary'),
          light: token('primary-light'),
          dark: token('primary-dark'),
        },
        good: {
          DEFAULT: token('good'),
          light: token('good-light'),
          dark: token('good-dark'),
        },
        warn: {
          DEFAULT: token('warn'),
          light: token('warn-light'),
          dark: token('warn-dark'),
        },
        danger: {
          DEFAULT: token('danger'),
          light: token('danger-light'),
          dark: token('danger-dark'),
        },
        // 채워진 색(primary·warn·danger) 위의 글자색
        'on-fill': token('on-fill'),
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      fontSize: {
        xs:   ['13px', { lineHeight: '1.6' }],
        sm:   ['15px', { lineHeight: '1.6' }],
        base: ['16px', { lineHeight: '1.6' }],
        lg:   ['20px', { lineHeight: '1.5' }],
        xl:   ['22px', { lineHeight: '1.4' }],
        '2xl':['28px', { lineHeight: '1.3' }],
      },
      backgroundImage: {
        'primary-gradient':
          'linear-gradient(90deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary) / 0.65) 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
