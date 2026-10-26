import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HrKpiPage } from './HrKpiPage';
import { toast } from '../../lib/toast';

const upsertMutateAsync = vi.hoisted(() => vi.fn());
const deleteMutateAsync = vi.hoisted(() => vi.fn());
vi.mock('../../lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// 렌더마다 참조가 바뀌지 않도록 안정된 배열 사용
const RECORDS = vi.hoisted(() => [
  { id: 'h1', measured_on: '2026-10-20', job_conversion_rate_pct: 48, satisfaction_score: 4.2, note: '10월' },
  { id: 'h2', measured_on: '2026-09-20', job_conversion_rate_pct: null, satisfaction_score: 4.0, note: null },
]);
vi.mock('../../hooks/useHrKpi', () => ({
  useHrKpiRecords: () => ({ data: RECORDS, isLoading: false }),
  useUpsertHrKpi: () => ({ mutateAsync: upsertMutateAsync, isPending: false }),
  useDeleteHrKpi: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));

describe('HrKpiPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기록 2건의 측정일을 표시한다', () => {
    render(<HrKpiPage />);
    expect(screen.getByText('2026-10-20')).toBeInTheDocument();
    expect(screen.getByText('2026-09-20')).toBeInTheDocument();
  });

  it('만족도 5.5는 toast.error 후 저장하지 않는다', () => {
    render(<HrKpiPage />);
    fireEvent.click(screen.getByText('+ 신규 기록'));
    fireEvent.change(screen.getByLabelText('측정일 *'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('만족도 (5점 척도)'), { target: { value: '5.5' } });
    fireEvent.click(screen.getByText('저장'));
    expect(toast.error).toHaveBeenCalled();
    expect(upsertMutateAsync).not.toHaveBeenCalled();
  });

  it('전환율 100 초과·측정일 누락도 거부한다', () => {
    render(<HrKpiPage />);
    fireEvent.click(screen.getByText('+ 신규 기록'));
    fireEvent.click(screen.getByText('저장'));
    expect(toast.error).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('측정일 *'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('직무 전환율 (%)'), { target: { value: '101' } });
    fireEvent.click(screen.getByText('저장'));
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(upsertMutateAsync).not.toHaveBeenCalled();
  });

  it('정상 입력 시 upsert 인자를 전달한다', async () => {
    upsertMutateAsync.mockResolvedValue(undefined);
    render(<HrKpiPage />);
    fireEvent.click(screen.getByText('+ 신규 기록'));
    fireEvent.change(screen.getByLabelText('측정일 *'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('직무 전환율 (%)'), { target: { value: '52' } });
    fireEvent.change(screen.getByLabelText('만족도 (5점 척도)'), { target: { value: '4.6' } });
    fireEvent.click(screen.getByText('저장'));
    await waitFor(() =>
      expect(upsertMutateAsync).toHaveBeenCalledWith({
        measured_on: '2026-11-20',
        job_conversion_rate_pct: 52,
        satisfaction_score: 4.6,
        note: null,
      }),
    );
  });

  it('저장 실패 시 toast.error를 띄운다', async () => {
    upsertMutateAsync.mockRejectedValue(new Error('duplicate key'));
    render(<HrKpiPage />);
    fireEvent.click(screen.getByText('+ 신규 기록'));
    fireEvent.change(screen.getByLabelText('측정일 *'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByText('저장'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('저장 실패: duplicate key'));
  });

  it('같은 측정일 중복(23505)이면 이미 기록이 있다고 안내한다', async () => {
    upsertMutateAsync.mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint' });
    render(<HrKpiPage />);
    fireEvent.click(screen.getByText('+ 신규 기록'));
    fireEvent.change(screen.getByLabelText('측정일 *'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByText('저장'));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '저장 실패: 이미 해당 측정일 기록이 있습니다. 목록에서 편집해 주세요.',
      ),
    );
  });

  it('편집은 id를 포함해 저장하고 삭제는 확인 후 수행한다', async () => {
    upsertMutateAsync.mockResolvedValue(undefined);
    deleteMutateAsync.mockResolvedValue(undefined);
    render(<HrKpiPage />);
    fireEvent.click(screen.getAllByText('편집')[0]);
    fireEvent.change(screen.getByLabelText('만족도 (5점 척도)'), { target: { value: '4.5' } });
    fireEvent.click(screen.getByText('저장'));
    await waitFor(() =>
      expect(upsertMutateAsync).toHaveBeenCalledWith({
        id: 'h1',
        measured_on: '2026-10-20',
        job_conversion_rate_pct: 48,
        satisfaction_score: 4.5,
        note: '10월',
      }),
    );
    fireEvent.click(screen.getAllByText('삭제')[1]);
    expect(deleteMutateAsync).not.toHaveBeenCalled();
    fireEvent.click((() => { const b = screen.getAllByText('삭제'); return b[b.length - 1]; })());
    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith('h2'));
  });
});
