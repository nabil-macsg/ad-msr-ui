import { routeOf } from '../access/registry';

/** Only in-app paths: never another origin (`//host`), a scheme, or the public pages. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return routeOf('home');
  }
  const path = value.split(/[?#]/)[0];
  if (path === '/' || path === '/login') return routeOf('home');
  return value;
}

export function loginPath(returnTo: string, error?: string): string {
  const params = new URLSearchParams();
  if (returnTo !== '/' && returnTo !== routeOf('home')) params.set('returnTo', returnTo);
  if (error) params.set('error', error);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
