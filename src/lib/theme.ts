import { useSyncExternalStore } from 'react';
import { applyChartTheme, type ChartTheme } from './chartDefaults';

// 밝은·어두운 테마 — 화면 색은 CSS 변수(data-theme), 차트 색은 chartDefaults가 따라간다
export type Theme = ChartTheme;

export const THEME_STORAGE_KEY = 'ongi-theme';

let current: Theme = 'dark';
const listeners = new Set<() => void>();

function apply(theme: Theme) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  applyChartTheme(theme);
  listeners.forEach((l) => l());
}

export const getTheme = (): Theme => current;

export function initTheme(): Theme {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰는 환경에서는 기본 테마로 시작
  }
  apply(saved === 'light' || saved === 'dark' ? saved : 'dark');
  return current;
}

export function setTheme(theme: Theme) {
  apply(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장에 실패해도 현재 화면에는 적용됨
  }
}

export const toggleTheme = () => setTheme(current === 'dark' ? 'light' : 'dark');

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useTheme = (): Theme => useSyncExternalStore(subscribe, getTheme);
