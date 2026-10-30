import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RawDataExport } from './RawDataExport';

// vi.fn 이 거부된 Promise를 추적하면 테스트가 실패로 잡히므로 응답은 직접 관리
const mocks = vi.hoisted(() => ({
  equipment: (() => Promise.resolve([])) as () => Promise<unknown[]>,
  downloads: [] as { csv: string; name: string }[],
}));
vi.mock('../../hooks/useRawExport', () => ({
  fetchRawEquipment: (_p: unknown, onPage?: (n: number) => void) => { onPage?.(1); return mocks.equipment(); },
  fetchRawVision: () => Promise.resolve([]),
}));
vi.mock('../../utils/csv', async (orig) => ({
  ...(await orig<typeof import('../../utils/csv')>()),
  downloadCsv: (csv: string, name: string) => { mocks.downloads.push({ csv, name }); },
}));

beforeEach(() => { mocks.downloads = []; });

describe('RawDataExport', () => {
  it('설비 원데이터를 기간이 들어간 파일명으로 내려받는다', async () => {
    mocks.equipment = () => Promise.resolve([
      { bucket_at: '2026-10-29T03:05:00+00:00', runtime_seconds: 58, output_count: 28, devices: { code: 'packaging_01', name: '삼면포장기' } },
    ]);
    render(<RawDataExport period={{ from: '2026-10-01', to: '2026-10-29' }} />);
    fireEvent.click(screen.getByRole('button', { name: '설비 CSV' }));
    await waitFor(() => expect(mocks.downloads).toHaveLength(1));
    expect(mocks.downloads[0].name).toBe('설비_분단위_2026-10-01_2026-10-29.csv');
    expect(mocks.downloads[0].csv).toContain('2026-10-29 12:05,packaging_01,삼면포장기,58,28');
  });

  it('31일을 넘는 기간은 버튼을 막고 안내한다', () => {
    render(<RawDataExport period={{ from: '2026-08-01', to: '2026-10-29' }} />);
    expect(screen.getByRole('button', { name: '설비 CSV' })).toBeDisabled();
    expect(screen.getByText(/31일 이하/)).toBeInTheDocument();
  });

  it('불러오기 실패는 오류로 보여 준다', async () => {
    mocks.equipment = () => Promise.reject(new Error('network down'));
    render(<RawDataExport period={{ from: '2026-10-01', to: '2026-10-02' }} />);
    fireEvent.click(screen.getByRole('button', { name: '설비 CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('network down'));
    expect(mocks.downloads).toHaveLength(0);
  });
});
