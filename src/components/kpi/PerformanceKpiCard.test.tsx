import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceKpiCard } from './PerformanceKpiCard';

const base = {
  label: '원가 (LOT당 작업공수)',
  unit: 'man-hour',
  baseline: 24,
  target: 16,
  direction: 'lower' as const,
  noDataReason: '완료된 LOT 없음 (최근 30일)',
  formula: <span>산출식: 투입인원 × 작업시간</span>,
};

describe('PerformanceKpiCard', () => {
  it('목표 미달이면 미달 배지와 기존→목표 줄을 표시한다', () => {
    render(<PerformanceKpiCard {...base} value={17.5} />);
    expect(screen.getByText('17.5')).toBeInTheDocument();
    expect(screen.getByText('미달')).toBeInTheDocument();
    expect(screen.getByText('기존 24 → 목표 16 man-hour')).toBeInTheDocument();
  });

  it('목표 달성이면 목표 달성 배지를 표시한다', () => {
    render(<PerformanceKpiCard {...base} value={15} />);
    expect(screen.getByText('목표 달성')).toBeInTheDocument();
  });

  it('값이 null이면 — 와 사유를 표시하고 배지는 없다', () => {
    render(<PerformanceKpiCard {...base} value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('완료된 LOT 없음 (최근 30일)')).toBeInTheDocument();
    expect(screen.queryByText('목표 달성')).not.toBeInTheDocument();
    expect(screen.queryByText('미달')).not.toBeInTheDocument();
  });

  it('목표/기준선이 null이면 - 로 표시하고 NaN을 노출하지 않는다', () => {
    render(<PerformanceKpiCard {...base} value={17.5} baseline={null} target={null} />);
    expect(screen.getByText('기존 - → 목표 - man-hour')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText('미달')).not.toBeInTheDocument();
  });
});
