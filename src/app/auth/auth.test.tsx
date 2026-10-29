import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp, stubFetch } from '../../../test/render-app';
import { currentPersona } from '../../mock/demo-auth';
import { DEMO_ACCOUNT } from './demo-account';

const fill = async (user: ReturnType<typeof userEvent.setup>, name: string, password: string) => {
  if (name) await user.type(screen.getByLabelText('Username'), name);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
};

/** Everything this tab keeps in sessionStorage. */
const storedValues = () =>
  Array.from({ length: sessionStorage.length }, (_, i) => {
    const key = sessionStorage.key(i) ?? '';
    return `${key}=${sessionStorage.getItem(key) ?? ''}`;
  }).join('\n');

describe('demo login and protected routes', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('the landing page shows only the name and Continue, which opens the login', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/', { signedIn: false });
    expect(screen.getByRole('heading', { level: 1, name: 'AD-MSR Demo' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Continue' }));
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('asks for both fields', async () => {
    const user = userEvent.setup();
    renderApp('/login', { signedIn: false });
    await fill(user, '', '');
    expect(screen.getByText('Enter your username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(currentPersona()).toBeUndefined();
  });

  it('refuses a wrong password and stores nothing', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login', { signedIn: false });
    await fill(user, DEMO_ACCOUNT.username, 'wrong');
    expect(screen.getByText('The username or password is incorrect.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(currentPersona()).toBeUndefined();
    expect(storedValues()).not.toContain('wrong');
  });

  it('a protected address without login goes to login, then back to that address', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/admin/fleet?q=A6', { signedIn: false });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?returnTo=%2Fadmin%2Ffleet%3Fq%3DA6');
    // No protected content rendered on the way.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await fill(user, DEMO_ACCOUNT.username, DEMO_ACCOUNT.password);
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/fleet'));
    expect(router.state.location.search).toBe('?q=A6');
    expect(storedValues()).not.toContain(DEMO_ACCOUNT.password);
  });

  it('with no address requested, login opens the dashboard', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login', { signedIn: false });
    await fill(user, DEMO_ACCOUNT.username, DEMO_ACCOUNT.password);
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('unknown addresses are protected too', () => {
    const { router } = renderApp('/no-such-page', { signedIn: false });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('a signed-in visitor opening /login goes to the app', async () => {
    const { router } = renderApp('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});
