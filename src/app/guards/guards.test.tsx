import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { accessWith, json, renderApp, stubFetch } from '../../../test/render-app';
import { pageOf } from '../access/registry';

describe('PROMPT-2.7 route guards', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('PROMPT-2.7 redirects Home with a notice when the user lacks the view right', async () => {
    const { router } = renderApp('/admin/users', { access: accessWith() });
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(await screen.findByText("You don't have access to Users.")).toBeInTheDocument();
  });

  it('PROMPT-0 a page the user may view shows "In scope, not built yet" until its phase', async () => {
    // HEMS flights are built in Phase 4.
    const page = pageOf('hems.flights');
    renderApp(page.route ?? '/', { access: accessWith({ 'hems.flights': ['view'] }) });
    expect(await screen.findByRole('heading', { level: 1, name: page.label })).toBeInTheDocument();
    expect(screen.getByText('In scope, not built yet')).toBeInTheDocument();
  });

  it('PROMPT-0 a page held by an open point says which one', async () => {
    const page = pageOf('registers.airworthiness');
    renderApp(page.route ?? '/', { access: accessWith({ 'registers.airworthiness': ['view'] }) });
    expect(await screen.findByText(/open point P-11/)).toBeInTheDocument();
  });

  it('PROMPT-4.2 an unknown address shows Page not found inside the shell', async () => {
    renderApp('/no-such-page');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('PROMPT-2.6 when the API has no session the app goes to login, keeping the address', async () => {
    stubFetch((path) =>
      path === '/api/v1/me' || path === '/api/v1/me/access' || path === '/api/v1/auth/refresh'
        ? json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } }, 401)
        : undefined,
    );
    const { router } = renderApp('/booking/my-bookings', { signedIn: false, demoLogin: true });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?returnTo=%2Fbooking%2Fmy-bookings');
  });

  it('PROMPT-2.6 when the session can no longer be renewed, login says so', async () => {
    document.cookie = 'masar_csrf=expired-session';
    stubFetch((path) =>
      path === '/api/v1/me' || path === '/api/v1/me/access' || path === '/api/v1/auth/refresh'
        ? json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } }, 401)
        : undefined,
    );
    const { router } = renderApp('/booking/my-bookings', { signedIn: false, demoLogin: true });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain('error=SESSION_ENDED');
    document.cookie = 'masar_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
});
