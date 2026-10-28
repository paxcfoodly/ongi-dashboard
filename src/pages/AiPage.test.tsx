import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiPage } from './AiPage';

// 차트는 jsdom에서 그려지지 않으므로 대체
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
  Bar: () => <div data-testid="bar-chart" />,
}));

vi.mock('../hooks/useAiMetrics', () => ({
  useAiMetrics: () => ({
    isLoading: false,
    data: {
      total_inspected: 12000,
      defect_count: 120,
      unknown_count: 60,
      total_inspection_time_sec: 24000,
      defect_detection_pct: 1.0,
      throughput_ea_per_hr: 1800,
      recheck_rate_pct: 0.5,
    },
  }),
}));

const dailyState = vi.hoisted(() => ({ isError: false }));
vi.mock('../hooks/usePeriodKpi', () => ({
  usePeriodDaily: () => dailyState.isError ? ({ isError: true, isLoading: false, data: undefined }) : ({
    isError: false,
    isLoading: false,
    data: [
      { day: '2026-01-05', production: 58, runtime_sec: 112, inspected: 30, defects: 1, unknown: 1, inspection_time_sec: 55.5, claims: 0 },
      { day: '2026-01-06', production: 0, runtime_sec: 0, inspected: 0, defects: 0, unknown: 0, inspection_time_sec: 0, claims: 0 },
    ],
  }),
}));

function wrap(ui: React.ReactNode, entry = '/ai') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AiPage', () => {
  it('오늘 모드: 카드 값과 최근 7일 추이 제목을 유지한다', () => {
    render(wrap(<AiPage />));
    expect(screen.getByText('AI 성능 추이 (최근 7일)')).toBeInTheDocument();
    expect(screen.getByText('1,800')).toBeInTheDocument();
    expect(screen.queryByText('날짜별 AI 성능')).not.toBeInTheDocument();
  });

  describe('기간 모드', () => {
    it('일별 조회 실패 시 로딩 대신 오류 안내를 표시한다', () => {
      dailyState.isError = true;
      try {
        render(wrap(<AiPage />, '/ai?from=2026-01-05&to=2026-01-06'));
        expect(screen.getByRole('alert')).toHaveTextContent('기간 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        expect(screen.queryByText(/로딩 중/)).not.toBeInTheDocument();
      } finally {
        dailyState.isError = false;
      }
    });

    const period = '/ai?from=2026-01-05&to=2026-01-06';

    it('추이 차트 제목과 날짜별 AI 성능 표를 표시한다', () => {
      render(wrap(<AiPage />, period));
      expect(screen.getByText('AI 성능 추이 (선택 기간)')).toBeInTheDocument();
      expect(screen.queryByText('AI 성능 추이 (최근 7일)')).not.toBeInTheDocument();
      const table = screen.getByText('날짜별 AI 성능').closest('section')!;
      const foot = table.querySelector('tfoot') as HTMLElement;
      expect(within(foot).getByText('합계 30')).toBeInTheDocument();
      // 불량 검출율·재검율 모두 1/30 이므로 칸 위치로 구분한다 (날짜 칸 제외 인덱스)
      const cells = foot.querySelectorAll('td');
      expect(cells[1].textContent).toBe('합계 30');
      expect(cells[5].textContent).toBe('평균 3.33%');
      expect(cells[7].textContent).toBe('평균 3.33%');
    });

    it('데이터 없는 날의 비율 칸은 —', () => {
      render(wrap(<AiPage />, period));
      const table = screen.getByText('날짜별 AI 성능').closest('section')!;
      const row = within(table).getByText('2026-01-06').closest('tr')!;
      const tds = row.querySelectorAll('td');
      // 날짜, 검사수, 불량수, 재검수, 검사시간, 불량 검출율, 처리량, 재검율
      expect(tds[5].textContent).toBe('—');
      expect(tds[6].textContent).toBe('—');
      expect(tds[7].textContent).toBe('—');
    });
  });
});
