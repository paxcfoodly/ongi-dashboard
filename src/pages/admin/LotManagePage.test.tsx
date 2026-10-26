import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LotManagePage } from './LotManagePage';
import { toast } from '../../lib/toast';

const createMutateAsync = vi.hoisted(() => vi.fn());
const updateMutateAsync = vi.hoisted(() => vi.fn());
vi.mock('../../lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// useEffect 의존성(rows)이 매 렌더 바뀌어 폼이 초기화되지 않도록 안정된 참조 사용
const ROWS = vi.hoisted(() => [{
      id: 'l1', lot_no: 'LOT-TEST-1', client_id: 'c1', client_name: '삼성웰스토리',
      product_name: '온열팩', status: 'planned', started_at: null as string | null, ended_at: null as string | null,
      target_quantity: 3000, notes: null,
      inspected: 0, good_count: 0, defect_count: 0, unknown_count: 0,
      defect_rate_pct: 0, judgment: '미검사',
      worker_count: null, ordered_at: null, shipped_at: null,
      work_hours: null, man_hour: null, lead_days: null,
    }]);
// 재조회 시뮬레이션용: 테스트에서 lotsState.rows 를 새 배열로 교체할 수 있다
const lotsState = vi.hoisted(() => ({ rows: null as unknown[] | null }));
vi.mock('../../hooks/useLots', () => ({
  useLots: () => ({ data: lotsState.rows ?? ROWS, isLoading: false }),
}));

vi.mock('../../hooks/useAdminLots', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAdminLots')>('../../hooks/useAdminLots');
  return {
    ...actual,
    useCreateLot: () => ({ mutateAsync: createMutateAsync, isPending: false }),
    useUpdateLot: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
    useDeleteLot: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useStartLot: () => vi.fn(),
    useEndLot: () => vi.fn(),
    fetchClients: () => Promise.resolve([{ id: 'c1', name: '삼성웰스토리' }]),
  };
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe('LotManagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders LOT table with action buttons', () => {
    render(wrap(<LotManagePage />));
    expect(screen.getByText('LOT 관리')).toBeInTheDocument();
    expect(screen.getByText('LOT-TEST-1')).toBeInTheDocument();
    expect(screen.getByText('+ 신규 LOT')).toBeInTheDocument();
  });

  it('opens create modal on button click', () => {
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    expect(screen.getByText('신규 LOT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('LOT-20260424-001')).toBeInTheDocument();
  });

  it('신규 LOT 모달에 투입인원/일자/시각 필드가 있다', () => {
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    for (const l of ['투입인원 (명)', '수주일', '출하일', '시작 시각', '종료 시각']) {
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    }
  });

  it('투입인원·수주일 입력 후 생성 시 payload에 포함된다', async () => {
    createMutateAsync.mockResolvedValue({});
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    fireEvent.change(screen.getByPlaceholderText('LOT-20260424-001'), { target: { value: 'L-1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '삼성웰스토리' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('투입인원 (명)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('수주일'), { target: { value: '2026-11-02' } });
    fireEvent.click(screen.getByText('생성'));
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync.mock.calls[0][0]).toMatchObject({
      worker_count: 3,
      ordered_at: '2026-11-02',
      shipped_at: null,
      started_at: null,
      ended_at: null,
    });
  });

  it('투입인원이 양의 정수가 아니면 저장하지 않는다', async () => {
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    fireEvent.change(screen.getByPlaceholderText('LOT-20260424-001'), { target: { value: 'L-1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '삼성웰스토리' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('투입인원 (명)'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('생성'));
    expect(toast.error).toHaveBeenCalled();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('저장 실패(DB 제약 위반) 시 toast.error를 호출한다', async () => {
    createMutateAsync.mockRejectedValue(new Error('lots_end_after_start'));
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    fireEvent.change(screen.getByPlaceholderText('LOT-20260424-001'), { target: { value: 'L-1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '삼성웰스토리' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByText('생성'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('저장 실패')));
  });

  it('편집 중 재조회로 rows 가 새 배열이 되어도 입력값을 유지한다', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = () => (
      <QueryClientProvider client={qc}><MemoryRouter><LotManagePage /></MemoryRouter></QueryClientProvider>
    );
    const { rerender } = render(ui());
    fireEvent.click(screen.getByText('편집'));
    await waitFor(() => expect(screen.getByDisplayValue('LOT-TEST-1')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('비고'), { target: { value: '입력 중 메모' } });
    // 같은 id, 검사수만 바뀐 새 배열 (30초 재조회 결과)
    lotsState.rows = [{ ...ROWS[0], inspected: 120, good_count: 118 }];
    try {
      rerender(ui());
      expect(screen.getByLabelText('비고')).toHaveValue('입력 중 메모');
    } finally {
      lotsState.rows = null;
    }
  });

  describe('편집 시 시각 보존', () => {
    beforeEach(() => {
      ROWS[0].started_at = '2026-11-02T01:23:45.000Z';
      updateMutateAsync.mockResolvedValue({});
    });

    afterEach(() => {
      ROWS[0].started_at = null;
    });

    it('시각을 건드리지 않으면 started_at/ended_at을 보내지 않는다', async () => {
      render(wrap(<LotManagePage />));
      fireEvent.click(screen.getByText('편집'));
      await waitFor(() => expect(screen.getByDisplayValue('LOT-TEST-1')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('비고'), { target: { value: '메모' } });
      fireEvent.click(screen.getByText('저장'));
      await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
      const changes = updateMutateAsync.mock.calls[0][0].changes;
      expect(changes).not.toHaveProperty('started_at');
      expect(changes).not.toHaveProperty('ended_at');
      expect(changes.notes).toBe('메모');
    });

    it('시작 시각을 바꾸면 started_at을 보낸다', async () => {
      render(wrap(<LotManagePage />));
      fireEvent.click(screen.getByText('편집'));
      await waitFor(() => expect(screen.getByDisplayValue('LOT-TEST-1')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('시작 시각'), { target: { value: '2026-11-02T09:00' } });
      fireEvent.click(screen.getByText('저장'));
      await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
      const changes = updateMutateAsync.mock.calls[0][0].changes;
      expect(changes.started_at).toBe(new Date('2026-11-02T09:00').toISOString());
      expect(changes).not.toHaveProperty('ended_at');
    });
  });
});
