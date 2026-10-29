import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Client errors (401, 403, 404, 422) won't change on retry.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
        refetchOnWindowFocus: true,
      },
    },
  });
}
