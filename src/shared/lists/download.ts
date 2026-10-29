import { masarFetch } from '../../api/client';
import { ApiError } from '../../api/errors';

/** The file name in `Content-Disposition: attachment; filename="zones-2026-10-13.xlsx"`. */
export function fileNameOf(disposition: string | null): string | null {
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match?.[1] ?? null;
}

/**
 * Downloads a file from the API (exports) and saves it under the server's name. Goes through
 * the API client's fetch, so an expired session is renewed once; a refusal throws ApiError.
 */
export async function downloadFile(
  path: string,
  query: Readonly<Record<string, string | number | boolean>>,
): Promise<void> {
  const url = new URL(path, window.location.origin);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
  const response = await masarFetch(new Request(url, { credentials: 'same-origin' }));
  if (!response.ok) {
    throw ApiError.from(response.status, await response.json().catch(() => undefined));
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileNameOf(response.headers.get('content-disposition')) ?? 'export';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
