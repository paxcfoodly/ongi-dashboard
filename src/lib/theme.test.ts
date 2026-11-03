import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getTheme, setTheme, toggleTheme, initTheme, THEME_STORAGE_KEY } from './theme';
import { chartColors, baseLineOptions } from './chartDefaults';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저장값이 없으면 어두운 테마로 시작한다', () => {
    expect(initTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('저장된 테마를 복원한다', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(initTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('알 수 없는 저장값은 무시한다', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(initTheme()).toBe('dark');
  });

  it('전환하면 화면 속성과 저장값이 함께 바뀐다', () => {
    setTheme('dark');
    toggleTheme();
    expect(getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('저장소를 쓸 수 없어도 전환은 동작한다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('저장 불가');
    });
    setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('차트 색상도 테마에 맞춰 바뀌고, 객체 참조는 유지된다', () => {
    const colors = chartColors;
    const options = baseLineOptions;
    setTheme('light');
    const lightGrid = chartColors.grid;
    const lightTick = baseLineOptions.scales.x.ticks.color;
    setTheme('dark');
    expect(chartColors).toBe(colors);
    expect(baseLineOptions).toBe(options);
    expect(chartColors.grid).not.toBe(lightGrid);
    expect(baseLineOptions.scales.x.ticks.color).not.toBe(lightTick);
    expect(baseLineOptions.plugins.tooltip.backgroundColor).not.toBe('#FFFFFF');
  });
});
