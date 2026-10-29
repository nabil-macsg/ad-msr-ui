import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const CSRF_COOKIE = 'masar_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Sign-in and refresh answer 401 for their own reasons; a refresh can't help them. */
const NO_REFRESH = /\/api\/v1\/auth\/(refresh|login|callback|external\/|mobile\/)/;

export function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

function withCsrf(request: Request): Request {
  const token = readCookie(CSRF_COOKIE);
  if (!token || !MUTATING.has(request.method)) return request;
  const headers = new Headers(request.headers);
  headers.set(CSRF_HEADER, token);
  return new Request(request, { headers });
}

type SessionListener = () => void;
const sessionEndedListeners = new Set<SessionListener>();

/** Called when the session can't be renewed: the app goes back to sign-in. */
export function onSessionEnded(listener: SessionListener): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh token once, however many requests found the access token expired. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { [CSRF_HEADER]: readCookie(CSRF_COOKIE) ?? '' },
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * Every API call: same-origin cookies, the CSRF header on mutating requests, and one retry
 * after renewing an expired access token (the session cookie lives 15 minutes, PROMPT §2.6).
 */
export async function masarFetch(input: Request): Promise<Response> {
  const retry = input.clone();
  const response = await fetch(withCsrf(input));
  if (response.status !== 401 || NO_REFRESH.test(input.url)) return response;
  // The readable CSRF cookie exists only while a session does; without it there is nothing to renew.
  if (!readCookie(CSRF_COOKIE)) return response;
  if (!(await refreshSession())) {
    for (const listener of sessionEndedListeners) listener();
    return response;
  }
  return fetch(withCsrf(retry));
}

export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: 'same-origin',
  fetch: masarFetch,
});
