import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AlarmRulePage } from './AlarmRulePage';

vi.mock('../../lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// 기존 규칙: 폐기된 cost_ratio 규칙 1건 + defect_rate 규칙 1건
const RULES = vi.hoisted(() => [
  { id: 'r1', name: '원가 비율', metric: 'cost_ratio', operator: '>', threshold: 30, severity: 'warning',
    message_template: 'm', enabled: false },
  { id: 'r2', name: '불량률', metric: 'defect_rate', operator: '>', threshold: 1, severity: 'warning',
    message_template: 'm', enabled: true },
]);
vi.mock('../../hooks/useAdminAlarmRules', () => ({
  useAlarmRules: () => ({ data: RULES, isLoading: false }),
  useCreateRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRule: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }),
  useDeleteRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// '지표 *' 필드의 select 옵션 값 목록
function metricOptions() {
  const field = screen.getByText('지표 *').parentElement as HTMLElement;
  return within(field).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
}

describe('AlarmRulePage 지표 옵션 (D6-1)', () => {
  it('신규 규칙에서는 폐기된 cost_ratio를 고를 수 없다', () => {
    render(<AlarmRulePage />);
    fireEvent.click(screen.getByText('+ 신규 규칙'));
    expect(metricOptions()).not.toContain('cost_ratio');
    expect(metricOptions()).toContain('defect_rate');
  });

  it('cost_ratio를 쓰는 기존 규칙을 편집할 때는 폐기 표시와 함께 보인다', () => {
    render(<AlarmRulePage />);
    fireEvent.click(screen.getAllByText('편집')[0]);
    expect(metricOptions()).toContain('cost_ratio');
    expect(screen.getByRole('option', { name: 'cost_ratio (제조원가 %, 폐기)' })).toBeInTheDocument();
  });

  it('다른 지표 규칙을 편집할 때는 cost_ratio가 없다', () => {
    render(<AlarmRulePage />);
    fireEvent.click(screen.getAllByText('편집')[1]);
    expect(metricOptions()).not.toContain('cost_ratio');
  });
});
