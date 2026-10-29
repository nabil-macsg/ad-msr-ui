import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type { Role } from './roles-api';
import type { RoleMatrix } from './matrix-api';

const ROLE_ID = '00000000-0000-4000-8000-000000000701';
const LOCATION = {
  id: '00000000-0000-4000-8000-0000000000b1',
  code: 'DAS-1',
  name: 'Das Terminal',
};

const matrix = (overrides: Partial<RoleMatrix> = {}): RoleMatrix => ({
  role: {
    id: ROLE_ID,
    code: 'dispatch-team',
    name: 'Dispatch Team',
    isAdminTier: false,
    isLocked: false,
    isActive: true,
  },
  version: 12,
  modules: [
    {
      key: 'people-logistics',
      label: 'People Logistics',
      enabled: true,
      pages: [
        {
          key: 'dispatch.board',
          label: 'Dispatch Board',
          area: 'DISPATCH',
          channel: 'web',
          available: ['view', 'edit', 'export', 'reopen'],
          openRights: [],
          granted: ['view'],
        },
        {
          key: 'mobile.flight-log',
          label: 'Digital Flight Log',
          area: 'APP',
          channel: 'mobile',
          available: ['view', 'create', 'edit'],
          openRights: [],
          granted: [],
        },
      ],
    },
  ],
  capabilities: [
    {
      key: 'dispatch.offload',
      module: 'people-logistics',
      label: 'Offload a passenger',
      description: 'Remove a passenger from a departure, with a reason.',
      locationScoped: true,
      granted: false,
      locationIds: null,
    },
  ],
  kpis: { modulesHeld: 1, modulesTotal: 7, view: 1, edit: 0, export: 0 },
  editable: true,
  readOnlyReason: null,
  ...overrides,
});

function stubMatrix(current: RoleMatrix, options: { conflict?: boolean } = {}) {
  const sent: { body: unknown; ifMatch: string | null }[] = [];
  stubFetch((path, request) => {
    if (request.method === 'PUT') {
      void request
        .clone()
        .json()
        .then((body: unknown) => sent.push({ body, ifMatch: request.headers.get('if-match') }));
      if (options.conflict) {
        return json(
          {
            error: {
              code: 'VERSION_CONFLICT',
              message: 'This record was changed by someone else.',
            },
          },
          409,
        );
      }
      return json({ ...current, version: current.version + 1 });
    }
    if (path === '/api/v1/access/access-rights/options') {
      return json({
        roles: [{ id: ROLE_ID, code: 'dispatch-team', name: 'Dispatch Team', isActive: true }],
        locations: [LOCATION],
      });
    }
    if (path === `/api/v1/access/access-rights/${ROLE_ID}`) return json(current);
    if (path === '/api/v1/access/access-rights/versions') {
      return json({
        items: [
          {
            versionNo: 12,
            role: { id: ROLE_ID, name: 'Dispatch Team' },
            summary: 'Dispatch Team: 1 page',
            changedBy: 'Admin User',
            changedAt: '2026-10-13T06:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      });
    }
    if (path === '/api/v1/access/access-rights/versions/12/changes') {
      return json({
        from: 11,
        to: 12,
        changes: [
          {
            role: 'Dispatch Team',
            kind: 'page',
            key: 'dispatch.board',
            label: 'Dispatch Board',
            before: 'None',
            after: 'View',
          },
        ],
      });
    }
    return undefined;
  });
  return sent;
}

const EDITOR: Right[] = ['view', 'edit', 'export'];
afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.1.3-MST the Access Rights Matrix page (spec 10 §2.3)', () => {
  it('BRD-D.2.1.3-MST asks for a role, then shows its modules, pages and rights', async () => {
    stubMatrix(matrix());
    renderApp('/admin/access-rights', { access: accessWith({ 'admin.access-rights': EDITOR }) });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access Rights Matrix' }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await screen.findByRole('option', { name: 'Dispatch Team' });
    await user.selectOptions(screen.getByLabelText('Role'), ROLE_ID);
    expect(
      await screen.findByRole('heading', { name: 'People Logistics module' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('View: Dispatch Board')).toBeChecked();
    expect(screen.getByLabelText('Admin tier only: Reopen')).toBeInTheDocument();
    expect(screen.getByText('1 of 7')).toBeInTheDocument();
    await expectAccessible();
  });

  it('PROMPT-2.7 any right brings View; a save sends the matrix version', async () => {
    const sent = stubMatrix(matrix());
    renderApp(`/admin/access-rights?role=${ROLE_ID}`, {
      access: accessWith({ 'admin.access-rights': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Edit: Digital Flight Log'));
    expect(screen.getByLabelText('View: Digital Flight Log')).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'People Logistics module switched on' }));
    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    await user.click(within(bar).getByRole('button', { name: 'Save as a new version' }));
    await waitFor(() => {
      expect(sent).toEqual([
        {
          ifMatch: '12',
          body: {
            modules: { 'people-logistics': false },
            pages: { 'dispatch.board': ['view'], 'mobile.flight-log': ['view', 'edit'] },
            capabilities: [],
          },
        },
      ]);
    });
    expect(await screen.findByText('Saved as version 13.')).toBeInTheDocument();
  });

  it('PROMPT-2.16 says when someone else saved first, and offers a reload', async () => {
    stubMatrix(matrix(), { conflict: true });
    renderApp(`/admin/access-rights?role=${ROLE_ID}`, {
      access: accessWith({ 'admin.access-rights': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Export: Dispatch Board'));
    await user.click(screen.getByRole('button', { name: 'Save as a new version' }));
    expect(
      await screen.findByText(/Someone saved the matrix after you opened it/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('ADR-0049 a role the viewer holds is read-only, and says why', async () => {
    stubMatrix(matrix({ editable: false, readOnlyReason: 'own-role' }));
    renderApp(`/admin/access-rights?role=${ROLE_ID}`, {
      access: accessWith({ 'admin.access-rights': EDITOR }),
    });
    expect(
      await screen.findByText(
        'You hold this role, so you can’t change its rights. Ask another administrator.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('View: Dispatch Board')).toBeDisabled();
  });

  it('BRD-A.4.4.1-CM grants a capability at chosen locations', async () => {
    const sent = stubMatrix(matrix());
    renderApp(`/admin/access-rights?role=${ROLE_ID}`, {
      access: accessWith({ 'admin.access-rights': EDITOR }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Capabilities' }));
    await user.click(screen.getByLabelText(/Offload a passenger/));
    await user.click(screen.getByLabelText('Only at these locations'));
    expect(screen.getByLabelText('Das Terminal (DAS-1)')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save as a new version' }));
    await waitFor(() => {
      expect(sent[0]?.body).toMatchObject({
        capabilities: [{ key: 'dispatch.offload', locationIds: [LOCATION.id] }],
      });
    });
  });

  it('BRD-D.2.1.3-MST shows the role’s versions and what each changed', async () => {
    stubMatrix(matrix());
    renderApp(`/admin/access-rights?role=${ROLE_ID}`, {
      access: accessWith({ 'admin.access-rights': ['view'] }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'History' }));
    expect(await screen.findByText('Version 12 · Dispatch Team: 1 page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show changes' }));
    expect(await screen.findByText(/None → View/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });
});

describe('BRD-D.2.1.2-MST the Roles page (spec 10 §2.2)', () => {
  const role: Role = {
    id: ROLE_ID,
    code: 'super-admin',
    name: 'Super Admin',
    description: 'Administers the platform.',
    type: 'system',
    scopeLevel: 'platform',
    maxHolders: 5,
    holders: 1,
    isLocked: true,
    isAdminTier: true,
    isExternal: false,
    channels: ['web'],
    isActive: true,
    deactivatedReason: null,
    version: 1,
    updatedAt: '2026-10-13T06:00:00Z',
  };

  it('BRD-D.2.1.2-MST lists roles with their holders, and the banner', async () => {
    stubFetch((path) =>
      path === '/api/v1/access/roles'
        ? json({ items: [role], total: 1, page: 1, pageSize: 20 })
        : undefined,
    );
    renderApp('/admin/roles', {
      access: accessWith({
        'admin.roles': ['view', 'create', 'edit'],
        'admin.access-rights': ['view'],
      }),
    });
    expect(
      await screen.findByText(
        'A role decides nothing on its own — what it may open and do is set on the Access Rights Matrix.',
        {},
        // The page is lazy-loaded; its first load can take longer than the default second.
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();
    await expectAccessible();
  });

  it('BRD-D.2.1.2-MST creates a role through the form', async () => {
    const sent: unknown[] = [];
    stubFetch((path, request) => {
      if (request.method === 'POST') {
        void request
          .clone()
          .json()
          .then((b: unknown) => sent.push(b));
        return json(role, 201);
      }
      return path === '/api/v1/access/roles'
        ? json({ items: [], total: 0, page: 1, pageSize: 20 })
        : undefined;
    });
    renderApp('/admin/roles', { access: accessWith({ 'admin.roles': ['view', 'create'] }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New role' }));
    const form = screen.getByRole('dialog', { name: 'New role' });
    await user.type(within(form).getByLabelText('Code'), 'Bad Code');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Use 3–41 lower-case letters, digits or hyphens'),
    ).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Code'));
    await user.type(within(form).getByLabelText('Code'), 'fuel-auditor');
    await user.type(within(form).getByLabelText('Name'), 'Fuel Auditor');
    await user.type(within(form).getByLabelText('What it is for'), 'Audits fuel stations.');
    await user.type(within(form).getByLabelText('Maximum holders'), '0');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Enter a whole number from 1 to 100,000, or leave it empty'),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
    await user.clear(within(form).getByLabelText('Maximum holders'));
    await user.type(within(form).getByLabelText('Maximum holders'), '3');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toEqual([
        {
          code: 'fuel-auditor',
          name: 'Fuel Auditor',
          description: 'Audits fuel stations.',
          type: 'module',
          scopeLevel: 'site',
          maxHolders: 3,
          isLocked: false,
          isExternal: false,
          channels: ['web'],
        },
      ]);
    });
  });

  it('BRD-D.2.1.2-MST offers no Edit on a role the viewer holds', async () => {
    // The signed-in test user holds Passenger.
    const held: Role = {
      ...role,
      id: '00000000-0000-4000-8000-0000000000a1',
      code: 'passenger',
      name: 'Passenger',
      isLocked: false,
      isAdminTier: false,
    };
    const other: Role = {
      ...role,
      id: '00000000-0000-4000-8000-0000000000a2',
      code: 'auditor',
      name: 'Auditor',
      isLocked: false,
      isAdminTier: false,
    };
    stubFetch((path) =>
      path === '/api/v1/access/roles'
        ? json({ items: [held, other], total: 2, page: 1, pageSize: 20 })
        : undefined,
    );
    renderApp('/admin/roles', { access: accessWith({ 'admin.roles': ['view', 'edit'] }) });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Auditor' }, { timeout: 5000 }),
    );
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Actions for Passenger' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('BRD-D.2.1.2-MST makes the code from the name when it is left empty', async () => {
    const sent: { code?: string }[] = [];
    stubFetch((path, request) => {
      if (request.method === 'POST') {
        void request
          .clone()
          .json()
          .then((b: { code?: string }) => sent.push(b));
        return json(role, 201);
      }
      return path === '/api/v1/access/roles'
        ? json({ items: [], total: 0, page: 1, pageSize: 20 })
        : undefined;
    });
    renderApp('/admin/roles', { access: accessWith({ 'admin.roles': ['view', 'create'] }) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New role' }));
    const form = screen.getByRole('dialog', { name: 'New role' });
    await user.type(within(form).getByLabelText('Name'), 'ASP Team (Ops) 2');
    await user.type(within(form).getByLabelText('What it is for'), 'Runs the provider.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent.map((b) => b.code)).toEqual(['asp-team-ops-2']);
    });
  });
});
