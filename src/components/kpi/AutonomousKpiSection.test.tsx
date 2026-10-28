import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AutonomousKpiSection } from './AutonomousKpiSection';

// 인력 지표 지표별 최신값 — 테스트마다 교체
type Latest = { value: number; measured_on: string } | null;
let hr: { job: Latest; satisfaction: Latest } | undefined = undefined;
vi.mock('../../hooks/useHrKpi', () => ({
  useLatestHrKpi: () => ({ data: hr }),
}));

const targets = { job_conversion_target: 50, satisfaction_target: 4.5 };
const cardOf = (label: string) => screen.getByText(label).closest('div')!.parentElement!;

describe('AutonomousKpiSection', () => {
  beforeEach(() => {
    hr = undefined;
  });

  it('만족도 4.45 → 카드 "4.45" + 미달, 산출식도 4.45점 (표시값 = 판정값)', () => {
    hr = { job: null, satisfaction: { value: 4.45, measured_on: '2026-10-01' } };
    render(<AutonomousKpiSection claimsCount={0} targets={targets} />);
    const card = cardOf('직무 전환 후 만족도');
    expect(within(card).getByText('4.45')).toBeInTheDocument();
    expect(within(card).getByText('미달')).toBeInTheDocument();
    expect(card.textContent).toContain('관리자 입력 최신값 4.45점');
  });

  it('직무 전환율 49.96 → 카드·산출식 모두 50.0 으로 같은 자릿수', () => {
    hr = { job: { value: 49.96, measured_on: '2026-10-01' }, satisfaction: null };
    render(<AutonomousKpiSection claimsCount={0} targets={targets} />);
    const card = cardOf('인력 직무 전환율');
    expect(within(card).getByText('50.0')).toBeInTheDocument();
    expect(within(card).getByText('목표 달성')).toBeInTheDocument();
    expect(card.textContent).toContain('관리자 입력 최신값 50.0%');
    expect(card.textContent).not.toContain('49.96');
  });

  it('최신 기록에 전환율만 있으면 만족도는 이전 기록 값과 그 기준일을 쓴다', () => {
    hr = {
      job: { value: 52, measured_on: '2026-10-20' },
      satisfaction: { value: 4.1, measured_on: '2026-09-20' },
    };
    render(<AutonomousKpiSection claimsCount={0} targets={targets} />);
    const job = cardOf('인력 직무 전환율');
    const sat = cardOf('직무 전환 후 만족도');
    expect(job.textContent).toContain('기준일 2026-10-20');
    expect(within(sat).getByText('4.10')).toBeInTheDocument();
    expect(sat.textContent).toContain('기준일 2026-09-20');
    expect(sat.textContent).not.toContain('입력된 기록 없음');
  });

  it('기간 모드에서 기록이 없으면 기간 내 기록 없음과 합계 안내를 표시한다', () => {
    render(
      <AutonomousKpiSection
        claimsCount={2}
        targets={targets}
        scope="period"
        periodHr={{ job: null, satisfaction: null }}
      />,
    );
    expect(screen.getAllByText('기간 내 기록 없음')).toHaveLength(2);
    expect(screen.getByText('선택 기간 합계 (목표는 분기 기준)')).toBeInTheDocument();
  });
});
