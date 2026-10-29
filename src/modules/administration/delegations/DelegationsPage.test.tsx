import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';

const delegation = {
  id: '00000000-0000-4000-8000-000000000b01',
  delegator: { userId: '00000000-0000-4000-8000-000000000a01', name: 'Reem Al Kindi' },
  delegate: { userId: '00000000-0000-4000-8000-000000000a02', name: 'Omar Haddad' },
  moduleKeys: ['people-logistics'],
  startsAt: '2026-10-14T04:00:00Z',
  endsAt: '2026-10-20T04:00:00Z',
  reason: 'Annual leave',
  status: 'active' as const,
  revokedReason: null,
  version: 3,
};
const device = {
  id: '00000000-0000-4000-8000-000000000c01',
  user: {
    id: '00000000-0000-4000-8000-000000000a03',
    name: 'Daniel Hughes',
    email: 'd.hughes@fal.masar.example',
  },
  platform: 'ios' as const,
  model: 'iPhone 16',
  osVersion: '18.4',
  appVersion: '1.0.0',
  pushEnabled: true,
  registeredAt: '2026-10-01T04:00:00Z',
  lastSeenAt: '2026-10-13T04:00:00Z',
  status: 'active' as const,
  revokedReason: null,
  blockedReason: null,
  version: 4,
};

function stub() {
  const sent: { path: string; body: unknown; ifMatch: string | null }[] = [];
  stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .json()
        .then((body: unknown) =>
          sent.push({ path, body, ifMatch: request.headers.get('if-match') }),
        );
      if (path.endsWith('/block')) return json({ ...device, status: 'blocked', version: 5 });
      if (request.method === 'PATCH') return json({ ...delegation, version: 4 });
      return new Response(null, { status: 204 });
    }
    if (path === '/api/v1/access/delegations')
      return json({ items: [delegation], total: 1, page: 1, pageSize: 20 });
    if (path === '/api/v1/access/devices')
      return json({ items: [device], total: 1, page: 1, pageSize: 20 });
    return undefined;
  });
  return sent;
}

const DELEGATION_ADMIN: Right[] = ['view', 'create', 'edit', 'export'];
afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.1.4-MST the Delegation page (spec 10 §2.4)', () => {
  it('BRD-D.2.1.4-MST lists delegations, and revokes one with a reason and its version', async () => {
    const sent = stub();
    renderApp('/admin/delegations', {
      access: accessWith({ 'admin.delegations': DELEGATION_ADMIN }),
    });
    expect(await screen.findByText('Reem Al Kindi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New delegation' })).toBeInTheDocument();
    await expectAccessible();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Actions for Reem Al Kindi → Omar Haddad' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Revoke' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason'), 'Leave cancelled');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        path: `/api/v1/access/delegations/${delegation.id}/revoke`,
        body: { reason: 'Leave cancelled' },
        ifMatch: '3',
      });
    });
  });

  it('BRD-D.2.1.4-MST amends the end of an active delegation, not its start', async () => {
    const sent = stub();
    renderApp('/admin/delegations', {
      access: accessWith({ 'admin.delegations': DELEGATION_ADMIN }),
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Reem Al Kindi → Omar Haddad' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Amend' }));
    const form = screen.getByRole('dialog');
    expect(within(form).getByLabelText('Starts')).toBeDisabled();
    await user.clear(within(form).getByLabelText('Ends'));
    await user.type(within(form).getByLabelText('Ends'), '2026-10-25T08:00');
    await user.type(within(form).getByLabelText('Reason'), 'Leave extended');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        path: `/api/v1/access/delegations/${delegation.id}`,
        body: { endsAt: '2026-10-25T04:00:00.000Z', reason: 'Leave extended' },
        ifMatch: '3',
      });
    });
  });

  it('PROMPT-2.7 a viewer can’t change delegations', async () => {
    stub();
    renderApp('/admin/delegations', { access: accessWith({ 'admin.delegations': ['view'] }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Reem Al Kindi → Omar Haddad' }),
    );
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['History']);
    expect(screen.queryByRole('button', { name: 'New delegation' })).not.toBeInTheDocument();
  });
});

describe('ADR-0039 the Devices page', () => {
  it('ADR-0039 revokes and blocks a device, with a reason and its version', async () => {
    const sent = stub();
    renderApp('/admin/devices', {
      access: accessWith({ 'admin.devices': ['view', 'deactivate', 'export'] }),
    });
    expect(await screen.findByText('Daniel Hughes')).toBeInTheDocument();
    await expectAccessible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for iPhone 16 · Daniel Hughes' }));
    await user.click(screen.getByRole('menuitem', { name: 'Revoke and block' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Revoke and block iPhone 16 · Daniel Hughes?',
    });
    await user.type(within(dialog).getByLabelText('Reason'), 'Reported lost');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke and block' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        path: `/api/v1/access/devices/${device.id}/block`,
        body: { reason: 'Reported lost' },
        ifMatch: '4',
      });
    });
  });
});
