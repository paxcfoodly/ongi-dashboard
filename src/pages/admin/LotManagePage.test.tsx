import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LotManagePage } from './LotManagePage';

vi.mock('../../hooks/useLots', () => ({
  useLots: () => ({
    data: [{
      id: 'l1', lot_no: 'LOT-TEST-1', client_id: 'c1', client_name: '삼성웰스토리',
      product_name: '온열팩', status: 'planned', started_at: null, ended_at: null,
      target_quantity: 3000, notes: null,
      inspected: 0, good_count: 0, defect_count: 0, unknown_count: 0,
      defect_rate_pct: 0, judgment: '미검사',
    }],
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useAdminLots', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAdminLots')>('../../hooks/useAdminLots');
  return {
    ...actual,
    useCreateLot: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateLot: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  beforeEach(() => vi.clearAllMocks());

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
});
