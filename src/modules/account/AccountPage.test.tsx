import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { accessWith, json, ME, renderApp, stubFetch } from '../../../test/render-app';

const DELEGATE = { userId: '00000000-0000-4000-8000-000000000a01', name: 'Fatima Al Hashimi' };
const delegation = {
  id: '00000000-0000-4000-8000-000000000b01',
  delegator: { userId: ME.id, name: ME.displayName },
  delegate: DELEGATE,
  moduleKeys: null,
  startsAt: '2026-10-14T04:00:00Z',
  endsAt: '2026-10-20T04:00:00Z',
  reason: 'Annual leave',
  status: 'active' as const,
  revokedReason: null,
  version: 1,
};
const PREFERENCES = {
  categories: [
    {
      key: 'security',
      label: 'Security alerts',
      mandatory: true,
      channels: { email: true, sms: true, push: true },
    },
    {
      key: 'freight',
      label: 'Freight',
      mandatory: false,
      channels: { email: true, sms: false, push: true },
    },
  ],
};

function stubAccount() {
  const sent: { method: string; path: string; body: unknown }[] = [];
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .text()
        .then((text) =>
          sent.push({
            method: request.method,
            path,
            body: text ? (JSON.parse(text) as unknown) : null,
          }),
        );
      if (path === '/api/v1/me/notification-preferences') return json(PREFERENCES);
      if (path === '/api/v1/me/delegations') return json(delegation, 201);
      return new Response(null, { status: 204 });
    }
    if (path === '/api/v1/me/delegations') return json({ given: [delegation], received: [] });
    if (path === '/api/v1/me/devices') {
      return json({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000c01',
            deviceId: 'dev-123456789',
            platform: 'ios',
            model: 'iPhone 16',
            osVersion: '18.4',
            appVersion: '1.0.0',
            pushEnabled: true,
            registeredAt: '2026-10-01T04:00:00Z',
            lastSeenAt: '2026-10-13T04:00:00Z',
            revokedAt: null,
            revokedReason: null,
            current: false,
          },
        ],
      });
    }
    if (path === '/api/v1/me/notification-preferences') return json(PREFERENCES);
    if (path === '/api/v1/me/people') {
      return json({
        items: [
          {
            userId: DELEGATE.userId,
            name: DELEGATE.name,
            email: 'f.alhashimi@masar.example',
            organisation: null,
          },
        ],
      });
    }
    return undefined;
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('spec-10-1.5 My account', () => {
  it('spec-10-1.5 shows the profile with its source, roles with scope, delegations, devices and preferences', async () => {
    stubAccount();
    renderApp('/account', { access: accessWith() });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'My account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('VIA SAP')).toBeInTheDocument();
    expect(screen.getByText('Own records')).toBeInTheDocument();
    expect(await screen.findByText('Fatima Al Hashimi')).toBeInTheDocument();
    expect(await screen.findByText('iPhone 16')).toBeInTheDocument();
    expect(await screen.findByLabelText('Email for Security alerts')).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Password' })).not.toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.2.1.4-MST creates a delegation to a colleague found by name', async () => {
    const sent = stubAccount();
    renderApp('/account', { access: accessWith() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New delegation' }));
    const form = screen.getByRole('dialog', { name: 'New delegation' });
    await user.type(within(form).getByLabelText('Delegate to'), 'Fat');
    await user.click(await within(form).findByRole('button', { name: 'Choose Fatima Al Hashimi' }));
    await user.type(within(form).getByLabelText('Starts'), '2026-10-20T08:00');
    await user.type(within(form).getByLabelText('Ends'), '2026-10-27T08:00');
    await user.type(within(form).getByLabelText('Reason'), 'Annual leave');
    await user.click(within(form).getByRole('button', { name: 'Create delegation' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: '/api/v1/me/delegations',
        body: {
          delegateUserId: DELEGATE.userId,
          moduleKeys: null,
          startsAt: '2026-10-20T04:00:00.000Z',
          endsAt: '2026-10-27T04:00:00.000Z',
          reason: 'Annual leave',
        },
      });
    });
  });

  it('spec-10-1.2 saves only the preferences people may change', async () => {
    const sent = stubAccount();
    renderApp('/account', { access: accessWith() });
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('SMS for Freight'));
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'PUT',
        path: '/api/v1/me/notification-preferences',
        body: {
          categories: [{ key: 'freight', channels: { email: true, sms: true, push: true } }],
        },
      });
    });
    expect(await screen.findByText('Preferences saved.')).toBeInTheDocument();
  });

  it('PROMPT-2.6 signs a device out, and offers external users their password', async () => {
    const sent = stubAccount();
    renderApp('/account', {
      access: accessWith(),
      me: { ...ME, isExternal: true, authMethod: 'password_otp' },
    });
    const user = userEvent.setup();
    expect(await screen.findByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New delegation' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Sign out iPhone 16' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'DELETE',
          path: '/api/v1/me/devices/00000000-0000-4000-8000-000000000c01',
        }),
      );
    });
  });
});

describe('spec-10-1.2 the Notifications page', () => {
  it('spec-10-1.2 lists alerts, filters by category and unread, and marks them read', async () => {
    const calls: string[] = [];
    stubFetch((path, request) => {
      if (path === '/api/v1/notifications') {
        calls.push(decodeURIComponent(new URL(request.url).search));
        return json({
          items: [
            {
              id: '00000000-0000-4000-8000-000000000d01',
              kind: 'alert',
              title: 'Booking BK-2026-0001 approved',
              body: 'Abu Dhabi → Das Island',
              link: null,
              category: 'booking',
              severity: 'info',
              createdAt: '2026-10-13T04:00:00Z',
              read: false,
            },
          ],
          nextCursor: null,
          unreadCount: 1,
        });
      }
      if (path === '/api/v1/me/notification-preferences') return json(PREFERENCES);
      if (request.method !== 'GET') return new Response(null, { status: 204 });
      return undefined;
    });
    renderApp('/notifications', { access: accessWith() });
    const user = userEvent.setup();
    expect(await screen.findByText('Booking BK-2026-0001 approved')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Unread only'));
    await screen.findByRole('option', { name: 'Freight' });
    await user.selectOptions(screen.getByLabelText('Category'), 'freight');
    await waitFor(() => {
      expect(calls.some((c) => c.includes('unread=true') && c.includes('category=freight'))).toBe(
        true,
      );
    });
    await user.click(
      await screen.findByRole('button', { name: 'Mark “Booking BK-2026-0001 approved” as read' }),
    );
    await user.click(screen.getByRole('tab', { name: 'Emails' }));
    await waitFor(() => {
      expect(calls.some((c) => c.includes('tab=emails'))).toBe(true);
    });
    expect(calls.filter((c) => c.includes('tab=emails')).every((c) => !c.includes('unread'))).toBe(
      true,
    );
  });
});
