import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PeriodPicker } from './PeriodPicker';

function Search() {
  return <div data-testid="search">{useLocation().search}</div>;
}

function setup(entry = '/kpi') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PeriodPicker />
      <Search />
    </MemoryRouter>,
  );
}

describe('PeriodPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T15:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('프리셋 클릭 시 쿼리가 바뀌고 배너를 표시한다', () => {
    setup();
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '최근 7일' }));
    expect(screen.getByTestId('search').textContent).toBe('?from=2026-10-22&to=2026-10-28');
    expect(screen.getByText('조회 기간 2026-10-22 ~ 2026-10-28 (7일) · 실시간 아님')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '최근 7일' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '오늘' }));
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('시작일이 종료일보다 늦으면 오류를 표시하고 이동하지 않는다', () => {
    setup();
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.getByRole('alert')).toHaveTextContent('시작일이 종료일보다 늦습니다.');
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('유효한 직접 입력은 쿼리로 반영한다', () => {
    setup();
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-10-07' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.getByTestId('search').textContent).toBe('?from=2026-10-01&to=2026-10-07');
  });

  it('잘못된 쿼리로 진입하면 안내하고 오늘 모드로 표시한다', () => {
    setup('/kpi?from=2026-10-01');
    expect(screen.getByRole('alert')).toHaveTextContent('잘못된 조회 기간이라 오늘 기준으로 표시합니다.');
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('프리셋과 다른 기간이면 어떤 프리셋도 눌림 상태가 아니다', () => {
    setup('/kpi?from=2026-10-01&to=2026-10-07');
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-10-01');
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });
});
