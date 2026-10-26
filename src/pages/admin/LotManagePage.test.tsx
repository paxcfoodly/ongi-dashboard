import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LotManagePage } from './LotManagePage';
import { toast } from '../../lib/toast';

const createMutateAsync = vi.hoisted(() => vi.fn());
const updateMutateAsync = vi.hoisted(() => vi.fn());
const startLotFn = vi.hoisted(() => vi.fn());
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
    useStartLot: () => startLotFn,
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

  it('투입인원이 1000을 넘으면 저장하지 않는다', async () => {
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByText('+ 신규 LOT'));
    fireEvent.change(screen.getByPlaceholderText('LOT-20260424-001'), { target: { value: 'L-1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '삼성웰스토리' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
    expect(screen.getByLabelText('투입인원 (명)')).toHaveAttribute('max', '1000');
    fireEvent.change(screen.getByLabelText('투입인원 (명)'), { target: { value: '1001' } });
    fireEvent.click(screen.getByText('생성'));
    expect(toast.error).toHaveBeenCalledWith('투입인원은 1~1000 사이의 정수여야 합니다.');
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

  // Regression: ISSUE-001 — 시작 버튼 실패(DB 제약 위반 400)가 안내 없이 묻힘
  // Found by /qa on 2026-10-26
  // Report: .gstack/qa-reports/run-20261026T085019Z/qa-report-localhost-2026-10-26.md
  it('LOT 시작이 실패하면 오류 토스트를 띄운다', async () => {
    startLotFn.mockRejectedValueOnce(new Error('violates check constraint "lots_end_after_start"'));
    render(wrap(<LotManagePage />));
    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('시작 실패')),
    );
    expect(toast.success).not.toHaveBeenCalledWith('LOT 시작됨');
  });

  // D5-1: 시각이 이미 기록된 LOT은 시작/종료 버튼을 숨기고, 폼 저장 시 시각으로 상태를 맞춘다
  describe('시각 기반 상태', () => {
    afterEach(() => {
      lotsState.rows = null;
      ROWS[0].started_at = null;
      ROWS[0].ended_at = null;
    });

    it('started_at이 있는 계획 LOT에는 [시작] 버튼이 없다', () => {
      lotsState.rows = [{ ...ROWS[0], started_at: '2026-10-20T00:00:00Z' }];
      render(wrap(<LotManagePage />));
      expect(screen.queryByRole('button', { name: '시작' })).toBeNull();
    });

    it('ended_at이 있는 진행중 LOT에는 [종료] 버튼이 없다', () => {
      lotsState.rows = [{ ...ROWS[0], status: 'running', started_at: '2026-10-20T00:00:00Z', ended_at: '2026-10-20T04:00:00Z' }];
      render(wrap(<LotManagePage />));
      expect(screen.queryByRole('button', { name: '종료' })).toBeNull();
    });

    it('편집 저장 시 시작·종료 시각이 모두 있으면 status를 completed로 보낸다', async () => {
      updateMutateAsync.mockResolvedValue({});
      ROWS[0].started_at = '2026-10-20T00:00:00.000Z';
      render(wrap(<LotManagePage />));
      fireEvent.click(screen.getByText('편집'));
      await waitFor(() => expect(screen.getByDisplayValue('LOT-TEST-1')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('종료 시각'), { target: { value: '2026-10-20T15:00' } });
      fireEvent.click(screen.getByText('저장'));
      await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
      expect(updateMutateAsync.mock.calls[0][0].changes.status).toBe('completed');
    });

    it('신규 생성 시 시작 시각만 있으면 status를 running으로 보낸다', async () => {
      createMutateAsync.mockResolvedValue({});
      render(wrap(<LotManagePage />));
      fireEvent.click(screen.getByText('+ 신규 LOT'));
      fireEvent.change(screen.getByPlaceholderText('LOT-20260424-001'), { target: { value: 'L-1' } });
      await waitFor(() => expect(screen.getByRole('option', { name: '삼성웰스토리' })).toBeInTheDocument());
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
      fireEvent.change(screen.getByLabelText('시작 시각'), { target: { value: '2026-10-20T09:00' } });
      fireEvent.click(screen.getByText('생성'));
      await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
      expect(createMutateAsync.mock.calls[0][0].status).toBe('running');
    });

    it('시각을 건드리지 않은 편집은 status를 보내지 않는다', async () => {
      updateMutateAsync.mockResolvedValue({});
      render(wrap(<LotManagePage />));
      fireEvent.click(screen.getByText('편집'));
      await waitFor(() => expect(screen.getByDisplayValue('LOT-TEST-1')).toBeInTheDocument());
      fireEvent.click(screen.getByText('저장'));
      await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
      expect(updateMutateAsync.mock.calls[0][0].changes).not.toHaveProperty('status');
    });
  });

  // D5-3: 미래 종료 시각·출하일은 KPI를 왜곡하므로 저장 전에 막는다 (시간대 여유 1일)
  describe('미래 날짜 거부', () => {
    async function openCreate() {
      render(wrap(<LotManagePage />));
      fireEvent.click(screen.getByText('+ 신규 LOT'));
      fireEvent.change(screen.getByPlaceholderText('LOT-20260424-001'), { target: { value: 'L-1' } });
      await waitFor(() => expect(screen.getByRole('option', { name: '삼성웰스토리' })).toBeInTheDocument());
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
    }
    const local = (d: Date) => d.toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T');
    const day = 24 * 3600 * 1000;

    it('종료 시각이 현재+1일보다 미래면 저장하지 않는다', async () => {
      await openCreate();
      fireEvent.change(screen.getByLabelText('시작 시각'), { target: { value: local(new Date(Date.now() - day)) } });
      fireEvent.change(screen.getByLabelText('종료 시각'), { target: { value: local(new Date(Date.now() + 3 * day)) } });
      fireEvent.click(screen.getByText('생성'));
      expect(toast.error).toHaveBeenCalledWith('종료 시각은 미래로 입력할 수 없습니다.');
      expect(createMutateAsync).not.toHaveBeenCalled();
    });

    it('출하일이 오늘+1일보다 미래면 저장하지 않는다', async () => {
      await openCreate();
      fireEvent.change(screen.getByLabelText('출하일'), {
        target: { value: new Date(Date.now() + 5 * day).toLocaleDateString('sv-SE') },
      });
      fireEvent.click(screen.getByText('생성'));
      expect(toast.error).toHaveBeenCalledWith('출하일은 미래로 입력할 수 없습니다.');
      expect(createMutateAsync).not.toHaveBeenCalled();
    });

    it('오늘 출하·방금 종료는 허용한다', async () => {
      createMutateAsync.mockResolvedValue({});
      await openCreate();
      fireEvent.change(screen.getByLabelText('시작 시각'), { target: { value: local(new Date(Date.now() - day)) } });
      fireEvent.change(screen.getByLabelText('종료 시각'), { target: { value: local(new Date()) } });
      fireEvent.change(screen.getByLabelText('출하일'), { target: { value: new Date().toLocaleDateString('sv-SE') } });
      fireEvent.click(screen.getByText('생성'));
      await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    });
  });
});
