import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessWith, ME, renderApp, stubFetch } from '../../../test/render-app';

describe('PROMPT-4.2 web shell', () => {
  beforeEach(() => {
    stubFetch();
    window.__MASAR_CONFIG__ = { features: { ai: false } };
  });

  it('PROMPT-4.2 menus differ by role: a passenger sees Booking only', async () => {
    renderApp('/dashboard', { access: accessWith({ 'booking.bookings': ['view'] }) });
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('PEOPLE LOGISTICS')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Bookings' })).toHaveAttribute(
      'href',
      '/booking/my-bookings',
    );
    expect(within(nav).queryByText('POB TRACKING')).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Administration' })).toBeNull();
  });

  it('PROMPT-4.2 menus differ by role: an administrator also gets Administration', async () => {
    renderApp('/dashboard', {
      access: accessWith({ 'pob.dashboard': ['view'], 'admin.users': ['view'] }),
    });
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('POB TRACKING')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Administration' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
  });

  it('PROMPT-4.2 the admin sidebar has its own groups and Back to MASAR', async () => {
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ['view'] }) });
    const nav = await screen.findByRole('navigation', { name: 'Administration navigation' });
    expect(within(nav).getByRole('link', { name: 'Back to MASAR' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(within(nav).getByText('ACCESS CONTROL')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
    // Each entry carries its reference icon, as the main sidebar's do.
    for (const link of within(nav).getAllByRole('link')) {
      expect(link.querySelector('svg')).not.toBeNull();
    }
  });

  it('PROMPT-4.2 greets the user in GST and hides the AI button unless enabled', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-13T04:30:00Z') });
    renderApp('/dashboard', { access: accessWith({ 'ai.assistant': ['view'] }) });
    expect(await screen.findByText('Good morning, Ahmed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'AI assistant' })).toBeNull();
    vi.useRealTimers();
  });

  it('PROMPT-4.2 shows the AI button when the feature is on and the user may use it', async () => {
    window.__MASAR_CONFIG__ = { features: { ai: true } };
    renderApp('/dashboard', { access: accessWith({ 'ai.assistant': ['view'] }) });
    expect(await screen.findByRole('link', { name: 'AI assistant' })).toHaveAttribute(
      'href',
      '/assistant',
    );
  });

  it('PROMPT-2.6 the user menu offers Change password to external users only', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderApp('/dashboard', { me: { ...ME, isExternal: true, authMethod: 'password_otp' } });
    await user.click(await screen.findByRole('button', { name: 'Your account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Change password' })).toBeInTheDocument();
  });

  it('PROMPT-2.6 staff have no Change password', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Your account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'My account' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Change password' })).toBeNull();
  });

  it('spec-10-1.3 the / shortcut opens global search, which asks for two characters', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderApp('/dashboard');
    await screen.findByRole('navigation', { name: 'Main navigation' });
    await user.keyboard('/');
    const dialog = await screen.findByRole('dialog', { name: 'Global search' });
    expect(within(dialog).getByLabelText('Global search')).toHaveFocus();
    expect(
      within(dialog).getByText(
        'Type at least two characters: a name, personnel no., HSE Passport no., location, installation, or flight or voyage no.',
      ),
    ).toBeInTheDocument();
  });

  it('spec-10-1.2 the bell shows the unread count', async () => {
    stubFetch((path) =>
      path === '/api/v1/notifications'
        ? new Response(JSON.stringify({ items: [], nextCursor: null, unreadCount: 3 }), {
            headers: { 'content-type': 'application/json' },
          })
        : undefined,
    );
    renderApp('/dashboard');
    expect(await screen.findByRole('button', { name: 'Notifications (3)' })).toBeInTheDocument();
  });
});
