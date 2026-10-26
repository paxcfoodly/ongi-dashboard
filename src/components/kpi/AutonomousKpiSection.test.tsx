import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AutonomousKpiSection } from './AutonomousKpiSection';

// 인력 지표 최신값 — 테스트마다 교체
let hr: Record<string, unknown> | null = null;
vi.mock('../../hooks/useHrKpi', () => ({
  useLatestHrKpi: () => ({ data: hr }),
}));

const targets = { job_conversion_target: 50, satisfaction_target: 4.5 };
const cardOf = (label: string) => screen.getByText(label).closest('div')!.parentElement!;

describe('AutonomousKpiSection', () => {
  beforeEach(() => {
    hr = null;
  });

  it('만족도 4.45 → 카드 "4.45" + 미달, 산출식도 4.45점 (표시값 = 판정값)', () => {
    hr = { measured_on: '2026-10-01', job_conversion_rate_pct: null, satisfaction_score: 4.45 };
    render(<AutonomousKpiSection claimsCount={0} targets={targets} />);
    const card = cardOf('직무 전환 후 만족도');
    expect(within(card).getByText('4.45')).toBeInTheDocument();
    expect(within(card).getByText('미달')).toBeInTheDocument();
    expect(card.textContent).toContain('관리자 입력 최신값 4.45점');
  });

  it('직무 전환율 49.96 → 카드·산출식 모두 50.0 으로 같은 자릿수', () => {
    hr = { measured_on: '2026-10-01', job_conversion_rate_pct: 49.96, satisfaction_score: null };
    render(<AutonomousKpiSection claimsCount={0} targets={targets} />);
    const card = cardOf('인력 직무 전환율');
    expect(within(card).getByText('50.0')).toBeInTheDocument();
    expect(within(card).getByText('목표 달성')).toBeInTheDocument();
    expect(card.textContent).toContain('관리자 입력 최신값 50.0%');
    expect(card.textContent).not.toContain('49.96');
  });
});
