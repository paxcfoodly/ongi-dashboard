import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IngestSpecGuide } from './IngestSpecGuide';

vi.mock('../../lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('IngestSpecGuide', () => {
  it('1분 버킷 기준 현실적인 예시와 전송 주의사항을 보여준다', () => {
    const { container } = render(<IngestSpecGuide baseUrl="http://x" />);
    const pres = Array.from(container.querySelectorAll('pre')).map((p) => p.textContent ?? '');
    const vision = JSON.parse(pres.find((t) => t.includes('total_inspected') && t.startsWith('{'))!);
    const equip = JSON.parse(pres.find((t) => t.includes('runtime_seconds') && t.startsWith('{'))!);
    // 비전: 합계 일치, 장비: 분당 출력량
    const m = vision.metrics;
    expect(m.total_inspected).toBe(m.good_count + m.defect_count + m.unknown_count);
    expect(equip.metrics).toEqual({ runtime_seconds: 58, output_count: 30 });
    expect(container.textContent).not.toContain('1850');
    expect(screen.getByText(/누적값 아님/)).toBeInTheDocument();
    expect(screen.getByText(/\+09:00 오프셋/)).toBeInTheDocument();
    expect(screen.getByText(/200 duplicate 로 응답/)).toBeInTheDocument();
    // CSV 예시: 헤더 + 값 1행
    expect(pres.some((t) => t.startsWith('bucket_at,runtime_seconds,output_count'))).toBe(true);
  });
});
