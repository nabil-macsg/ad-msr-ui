import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { downloadFile, fileNameOf } from './download';

afterEach(() => vi.unstubAllGlobals());

describe('PROMPT-2.16 export downloads', () => {
  it('reads the server’s file name', () => {
    expect(fileNameOf('attachment; filename="zones-2026-10-13.xlsx"')).toBe(
      'zones-2026-10-13.xlsx',
    );
    expect(fileNameOf(null)).toBeNull();
  });

  it('asks for the list’s query and saves the file under the server’s name', async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(
        new Response('Code\r\nDAS\r\n', {
          headers: { 'content-disposition': 'attachment; filename="zones-2026-10-13.csv"' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const createObjectURL = vi.fn(() => 'blob:zones');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await downloadFile('/api/v1/masters/zones/export', { 'filter[zone]': 'z1', format: 'csv' });

    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.url).toBe(
      `${window.location.origin}/api/v1/masters/zones/export?filter%5Bzone%5D=z1&format=csv`,
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('zones-2026-10-13.csv');
  });

  it('throws the API’s refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You do not have access.' } }),
            { status: 403, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    await expect(downloadFile('/api/v1/masters/zones/export', { format: 'xlsx' })).rejects.toEqual(
      new ApiError(403, 'FORBIDDEN', 'You do not have access.'),
    );
  });
});
