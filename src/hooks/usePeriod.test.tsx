import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePeriod } from './usePeriod';

function setup(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ p: usePeriod(), loc: useLocation() }), { wrapper });
}

describe('usePeriod', () => {
  it('쿼리에서 기간을 읽고, setPeriod(null)은 from·to만 지우며 다른 쿼리는 유지한다', () => {
    const { result } = setup('/kpi?from=2026-10-01&to=2026-10-07&x=1');
    expect(result.current.p.period).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(result.current.p.error).toBeNull();
    act(() => result.current.p.setPeriod(null));
    expect(result.current.loc.search).toBe('?x=1');
    expect(result.current.p.period).toBeNull();
  });

  it('setPeriod(p)는 from·to를 설정한다', () => {
    const { result } = setup('/kpi?x=1');
    act(() => result.current.p.setPeriod({ from: '2026-10-02', to: '2026-10-05' }));
    const params = new URLSearchParams(result.current.loc.search);
    expect(params.get('from')).toBe('2026-10-02');
    expect(params.get('to')).toBe('2026-10-05');
    expect(params.get('x')).toBe('1');
  });

  it('잘못된 쿼리는 period null + 오류 문구', () => {
    const { result } = setup('/kpi?from=abc&to=2026-10-07');
    expect(result.current.p.period).toBeNull();
    expect(result.current.p.error).toBe('잘못된 조회 기간이라 오늘 기준으로 표시합니다.');
  });
});
