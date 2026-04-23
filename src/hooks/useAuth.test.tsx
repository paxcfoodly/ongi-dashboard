import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

vi.mock('../lib/supabase', () => {
  const listeners: Array<(e: string, s: unknown) => void> = [];
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn((cb) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading=true initially then session=null when unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.role).toBeNull();
  });
});
