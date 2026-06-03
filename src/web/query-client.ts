import { QueryClient } from '@tanstack/react-query';

export function createBrunchQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1_000,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
}
