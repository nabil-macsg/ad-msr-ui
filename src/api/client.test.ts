import { afterEach, describe, expect, it, vi } from 'vitest';
import { json } from '../../test/render-app';
import { masarFetch, onSessionEnded } from './client';

const url = (path: string) => new URL(path, window.location.origin).toString();
const setCsrf = (value: string | null) => {
  document.cookie = value
    ? `masar_csrf=${value}`
    : 'masar_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

describe('PROMPT-2.6 the web client and its session', () => {
  afterEach(() => setCsrf(null));

  it('PROMPT-2.6 sends the CSRF token on changes, not on reads', async () => {
    setCsrf('csrf-123');
    const fetchMock = vi.fn(() => Promise.resolve(json({})));
    vi.stubGlobal('fetch', fetchMock);
    await masarFetch(new Request(url('/api/v1/notifications/read-all'), { method: 'POST' }));
    await masarFetch(new Request(url('/api/v1/me')));
    const [post, get] = fetchMock.mock.calls.map((c) => (c as unknown as [Request])[0]);
    expect(post?.headers.get('x-csrf-token')).toBe('csrf-123');
    expect(get?.headers.get('x-csrf-token')).toBeNull();
  });

  it('PROMPT-2.6 renews an expired access token once and retries the request', async () => {
    setCsrf('csrf-123');
    const seen: string[] = [];
    let meCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo) => {
        const path = typeof input === 'string' ? input : new URL(input.url).pathname;
        seen.push(path);
        if (path === '/api/v1/auth/refresh') return Promise.resolve(json({}));
        meCalls += 1;
        return Promise.resolve(
          meCalls === 1
            ? json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401)
            : json({ ok: true }),
        );
      }),
    );
    const response = await masarFetch(new Request(url('/api/v1/me')));
    expect(response.status).toBe(200);
    expect(seen).toEqual(['/api/v1/me', '/api/v1/auth/refresh', '/api/v1/me']);
  });

  it('P-26 when the refresh is refused, the session has ended', async () => {
    setCsrf('csrf-123');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401))),
    );
    const ended = vi.fn();
    const off = onSessionEnded(ended);
    const response = await masarFetch(new Request(url('/api/v1/me')));
    off();
    expect(response.status).toBe(401);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('PROMPT-2.6 sign-in calls are never retried through a refresh', async () => {
    setCsrf('csrf-123');
    const fetchMock = vi.fn(() =>
      Promise.resolve(json({ error: { code: 'INVALID_CREDENTIALS', message: 'x' } }, 401)),
    );
    vi.stubGlobal('fetch', fetchMock);
    await masarFetch(new Request(url('/api/v1/auth/external/login'), { method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
