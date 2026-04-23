import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LotHistoryPage } from './LotHistoryPage';

const useLotsMock = vi.fn();
vi.mock('../hooks/useLots', () => ({
  useLots: (...args: unknown[]) => useLotsMock(...args),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LotHistoryPage', () => {
  beforeEach(() => {
    useLotsMock.mockReturnValue({
      data: [
        {
          id: 'l1', lot_no: 'LOT-TEST-1', client_id: 'c1', client_name: '삼성웰스토리',
          product_name: '온열팩', status: 'running', started_at: '2026-04-23T08:00:00+09:00',
          ended_at: null, target_quantity: 3000, notes: null,
          inspected: 2800, good_count: 2780, defect_count: 15, unknown_count: 5,
          defect_rate_pct: 0.54, judgment: '정상',
        },
      ],
      isLoading: false,
    });
  });

  it('renders table with one LOT row', () => {
    render(wrap(<LotHistoryPage />));
    expect(screen.getByText('LOT-TEST-1')).toBeInTheDocument();
    expect(screen.getAllByText('삼성웰스토리').length).toBeGreaterThan(0);
    expect(screen.getAllByText('정상').length).toBeGreaterThan(0);
  });

  it('opens detail panel on row click', () => {
    render(wrap(<LotHistoryPage />));
    fireEvent.click(screen.getByText('LOT-TEST-1'));
    expect(screen.getByText(/LOT 상세 — LOT-TEST-1/)).toBeInTheDocument();
  });
});
