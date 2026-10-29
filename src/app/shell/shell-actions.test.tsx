import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, ME, renderApp, stubFetch } from '../../../test/render-app';
import { currentPersona } from '../../mock/demo-auth';

const alert = (id: string, read: boolean) => ({
  id,
  kind: 'alert',
  title: `Alert ${id}`,
  body: 'Body',
  link: '/support',
  category: 'system',
  severity: 'info',
  createdAt: '2026-10-13T06:00:00Z',
  read,
});

describe('spec-10-1.2 the notification bell', () => {
  it('spec-10-1.2 lists alerts, marks them read and opens their link', async () => {
    const calls: string[] = [];
    stubFetch((path, request) => {
      calls.push(`${request.method} ${path}`);
      if (path === '/api/v1/notifications') {
        const tab = new URL(request.url).searchParams.get('tab');
        return json({
          items: tab === 'alerts' ? [alert('a1', false)] : [],
          nextCursor: null,
          unreadCount: 1,
        });
      }
      if (path.startsWith('/api/v1/notifications/') || path === '/api/v1/notifications/read-all') {
        return new Response(null, { status: 204 });
      }
      return undefined;
    });
    const user = userEvent.setup();
    const { router } = renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Notifications (1)' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(calls).toContain('POST /api/v1/notifications/read-all'));

    await user.click(await within(dialog).findByRole('button', { name: /Alert a1/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/support'));
    expect(calls).toContain('PATCH /api/v1/notifications/a1');
  });

  it('spec-10-1.2 the Emails tab says when there are none', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    await user.click(await screen.findByRole('tab', { name: 'Emails' }));
    expect(await screen.findByText('No emails yet.')).toBeInTheDocument();
  });
});

describe('PROMPT-2.6 signing out and changing password', () => {
  it('PROMPT-2.6 Log out ends the demo session and opens the login page', async () => {
    stubFetch();
    const user = userEvent.setup();
    const { router } = renderApp('/dashboard');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.click(within(nav).getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('');
    expect(currentPersona()).toBeUndefined();
  });

  it('PROMPT-2.6 an external user changes their password from the user menu', async () => {
    let changed: unknown;
    stubFetch((path, request) => {
      if (path !== '/api/v1/auth/external/password/change') return undefined;
      changed = request;
      return new Response(null, { status: 204 });
    });
    const user = userEvent.setup();
    renderApp('/dashboard', { me: { ...ME, isExternal: true, authMethod: 'password_otp' } });
    await user.click(await screen.findByRole('button', { name: 'Your account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change password' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Current password'), 'Old password 2025');
    await user.type(within(dialog).getByLabelText('New password'), 'Sunrise over Das 2026');
    await user.type(within(dialog).getByLabelText('Confirm the new password'), 'Sunset');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(await within(dialog).findByText("The passwords don't match")).toBeInTheDocument();
    expect(changed).toBeUndefined();

    await user.clear(within(dialog).getByLabelText('Confirm the new password'));
    await user.type(
      within(dialog).getByLabelText('Confirm the new password'),
      'Sunrise over Das 2026',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(await within(dialog).findByText(/Your other sessions have ended/)).toBeInTheDocument();
  });

  it('PROMPT-2.6 shows why a password change was refused', async () => {
    stubFetch((path) =>
      path === '/api/v1/auth/external/password/change'
        ? json(
            { error: { code: 'INVALID_CREDENTIALS', message: 'Your current password is wrong.' } },
            422,
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderApp('/dashboard', { me: { ...ME, isExternal: true, authMethod: 'password_otp' } });
    await user.click(await screen.findByRole('button', { name: 'Your account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change password' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Current password'), 'Wrong password');
    await user.type(within(dialog).getByLabelText('New password'), 'Sunrise over Das 2026');
    await user.type(
      within(dialog).getByLabelText('Confirm the new password'),
      'Sunrise over Das 2026',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(await within(dialog).findByText('Your current password is wrong.')).toBeInTheDocument();
  });
});
