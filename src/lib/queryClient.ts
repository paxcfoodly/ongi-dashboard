import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      retry: 3,
    },
    mutations: { retry: 0 },
  },
});
