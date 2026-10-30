import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';

/** Base path of the demo pob mock API. */
export const POB_API = '/api/v1/demo/pob';

/** A call to the demo pob mock API (answered in the browser by src/mock). */
export async function pobCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${POB_API}${path}`, init);
  const body: unknown = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw ApiError.from(response.status, body);
  return body as T;
}

/** A JSON write (POST/PUT/PATCH/DELETE) to the demo pob mock API. */
export const pobSend = <T>(method: string, path: string, body?: unknown) =>
  pobCall<T>(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** A GET under the demo pob API, cached by TanStack Query under ['demo-pob', path]. */
export function usePobQuery<T>(path: string, enabled = true) {
  return useQuery({
    queryKey: ['demo-pob', path],
    queryFn: () => pobCall<T>(path),
    placeholderData: keepPreviousData,
    enabled,
  });
}
