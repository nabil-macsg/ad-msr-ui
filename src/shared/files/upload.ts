import { masarFetch } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { components, paths } from '../../api/schema';

export type Attachment = components['schemas']['Attachment'];
export type FilePurpose = NonNullable<
  paths['/api/v1/files']['post']['parameters']['query']
>['purpose'];

/**
 * Uploads one file for a purpose (PROMPT §2.10); attach it to its record in that record's own
 * request. Goes through the API client's fetch, so the session and CSRF token apply.
 */
export async function uploadFile(purpose: FilePurpose, file: File): Promise<Attachment> {
  const url = new URL('/api/v1/files', window.location.origin);
  url.searchParams.set('purpose', purpose);
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await masarFetch(
    new Request(url, { method: 'POST', body, credentials: 'same-origin' }),
  );
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw ApiError.from(response.status, json);
  return json as Attachment;
}
