import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserPage } from './UserPage';

vi.mock('../../hooks/useAdminUsers', () => ({
  useUsers: () => ({
    data: [{
      id: 'u1', full_name: '관리자', role: 'admin', active: true,
      created_at: '2026-04-01T00:00:00Z',
    }],
    isLoading: false,
  }),
  useInviteUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUserProfile: () => ({ mutate: vi.fn() }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

describe('UserPage', () => {
  it('renders user list with role pill', () => {
    render(wrap(<UserPage />));
    expect(screen.getByText('사용자 관리')).toBeInTheDocument();
    expect(screen.getByText('관리자')).toBeInTheDocument();
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0);
  });

  it('opens invite modal', () => {
    render(wrap(<UserPage />));
    fireEvent.click(screen.getByText('+ 사용자 초대'));
    expect(screen.getByText('사용자 초대')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('8자 이상')).toBeInTheDocument();
  });
});
