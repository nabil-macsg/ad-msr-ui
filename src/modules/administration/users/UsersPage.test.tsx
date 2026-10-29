import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../../test/axe';
import { accessWith, json, renderApp, stubFetch } from '../../../../test/render-app';
import type { Right } from '../../../app/access/registry';
import type {
  RoleAssignment,
  RoleOption,
  ScopeOptions,
  ScopeSummary,
  UserDetail,
  UserKpis,
  UserSummary,
} from './users-api';

const ZONE = { id: '00000000-0000-4000-8000-0000000000a1', code: 'DAS', name: 'Das Island' };
const NO_SCOPE: ScopeSummary = {
  allLocations: false,
  zones: [],
  locations: [],
  serviceProvider: null,
  departments: [],
  moduleKeys: null,
  self: false,
  lineManagerOf: false,
};

const reem: UserSummary = {
  id: '00000000-0000-4000-8000-000000000101',
  displayName: 'Reem Al Kindi',
  email: 'r.alkindi@masar.example',
  personnelNo: 'OPT-90021',
  organisation: 'ADNOC Offshore',
  source: 'sap',
  signIn: 'sso',
  isExternal: false,
  status: 'active',
  roles: [
    {
      assignmentId: '00000000-0000-4000-8000-000000000201',
      code: 'master-data-power-user',
      name: 'Master Data Power User',
      isAdminTier: false,
      validUntil: '2027-03-31',
      scope: { ...NO_SCOPE, allLocations: true },
    },
  ],
  accessUntil: '2027-03-31',
  lastSignInAt: '2026-10-13T05:00:00Z',
  version: 3,
};
const newcomer: UserSummary = {
  ...reem,
  id: '00000000-0000-4000-8000-000000000102',
  displayName: 'Omar Haddad',
  email: 'o.haddad@masar.example',
  personnelNo: 'OPT-90099',
  roles: [],
  accessUntil: null,
  lastSignInAt: null,
  version: 1,
};

const assignment: RoleAssignment = {
  id: reem.roles[0]?.assignmentId ?? '',
  role: {
    code: 'master-data-power-user',
    name: 'Master Data Power User',
    scopeLevel: 'platform',
    isExternal: false,
    isAdminTier: false,
  },
  scope: { ...NO_SCOPE, allLocations: true },
  validFrom: '2026-01-01',
  validUntil: '2027-03-31',
  state: 'active',
  accessRequestRef: 'RITM0001',
  assignedBy: 'Admin User',
  assignedAt: '2026-01-01T06:00:00Z',
  version: 2,
};

const detail = (user: UserSummary, extra: Partial<UserDetail> = {}): UserDetail => ({
  ...user,
  person: {
    designation: 'Data steward',
    company: 'ADNOC Offshore',
    department: null,
    lineManager: null,
    hsePassportNo: 'HSE-1001',
    sourceStatus: 'active',
    syncedAt: '2026-10-13T01:00:00Z',
  },
  approvalTier: null,
  invitedAt: null,
  activatedAt: null,
  deactivatedAt: null,
  deactivatedReason: null,
  assignments: user.roles.length > 0 ? [assignment] : [],
  isSelf: false,
  ...extra,
});

const KPIS: UserKpis = {
  registered: 52,
  active: 47,
  invited: 5,
  expiringIn30Days: 2,
  external: 5,
  withoutRoles: 1,
  adminTierHolders: 1,
  overLimit: [],
};
const ROLES: RoleOption[] = [
  {
    code: 'helideck-inspector',
    name: 'Helideck Inspector',
    description: 'Inspects helidecks in their zones.',
    scopeLevel: 'zone',
    isExternal: false,
    isAdminTier: false,
    maxHolders: null,
    holders: 2,
  },
  {
    code: 'service-provider',
    name: 'Service Provider',
    description: 'A provider’s operations team.',
    scopeLevel: 'provider',
    isExternal: true,
    isAdminTier: false,
    maxHolders: null,
    holders: 1,
  },
];
const SCOPE_OPTIONS: ScopeOptions = {
  zones: [ZONE],
  locations: [],
  serviceProviders: [],
  departments: [],
  modules: [{ key: 'pob', label: 'POB Tracking' }],
};

function stubUsers(details: Record<string, UserDetail> = {}) {
  const sent: { method: string; path: string; body: unknown; ifMatch: string | null }[] = [];
  const fetchMock = stubFetch((path, request) => {
    if (request.method !== 'GET') {
      void request
        .clone()
        .json()
        .catch(() => null)
        .then((body: unknown) => {
          sent.push({
            method: request.method,
            path,
            body,
            ifMatch: request.headers.get('if-match'),
          });
        });
      if (path.endsWith('/assignments')) return json(assignment, 201);
      if (request.method === 'PATCH' && path.startsWith('/api/v1/access/assignments/')) {
        return json({ ...assignment, version: assignment.version + 1 });
      }
      if (path === '/api/v1/integration/sync-runs') return json({ id: assignment.id }, 202);
      return new Response(null, { status: 204 });
    }
    if (path === '/api/v1/access/users') {
      return json({ items: [reem, newcomer], total: 2, page: 1, pageSize: 20 });
    }
    if (path === '/api/v1/access/users/summary') return json(KPIS);
    if (path === '/api/v1/access/users/role-options') return json({ items: ROLES });
    if (path === '/api/v1/access/users/scope-options') return json(SCOPE_OPTIONS);
    if (path === '/api/v1/integration/sync-runs/latest') {
      return json({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000301',
            adapter: 'sap',
            trigger: 'scheduled',
            triggeredBy: null,
            status: 'succeeded',
            startedAt: '2026-10-12T21:00:00Z',
            finishedAt: '2026-10-12T21:01:00Z',
            counts: { created: 1, updated: 3, left: 0, errors: 0 },
            error: null,
          },
        ],
      });
    }
    if (path.endsWith('/history')) {
      return json({
        items: [
          {
            id: '00000000-0000-4000-8000-000000000601',
            occurredAt: '2026-10-13T06:00:00Z',
            module: 'administration',
            actionType: 'access.assigned',
            actionLabel: 'User access assigned · Master Data Power User',
            reason: null,
            referenceId: 'RITM0001',
            outcome: 'success',
            record: { type: 'user', id: reem.id, ref: reem.personnelNo, label: reem.displayName },
            actor: { userId: null, role: null, label: 'Admin User', onBehalfOf: null },
            before: null,
            after: { role: 'Master Data Power User' },
            source: { ip: null, device: null, userAgent: null },
            correlationId: null,
            highRisk: false,
          },
        ],
        nextCursor: null,
      });
    }
    const id = /^\/api\/v1\/access\/users\/([^/]+)$/.exec(path)?.[1];
    if (id && details[id]) return json(details[id]);
    return undefined;
  });
  return { fetchMock, sent };
}

const ADMIN: Right[] = ['view', 'edit', 'deactivate', 'export'];

afterEach(() => vi.unstubAllGlobals());

describe('BRD-D.2.1.1-MST the Users page (spec 10 §2.1)', () => {
  it('BRD-D.2.1.1-MST lists users with KPI cards, sync status, and no "New user"', async () => {
    stubUsers();
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByText('Reem Al Kindi')).toBeInTheDocument();
    expect(screen.getByText('31 Mar 2027')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Users' })).getByText('No role'),
    ).toBeInTheDocument();
    expect(await screen.findByText('52')).toBeInTheDocument();
    expect(screen.getByText('5 invited · 1 without a role')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now: SAP' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new user/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    await expectAccessible();
  });

  it('PROMPT-2.16 filters by role through filter[role]', async () => {
    const { fetchMock } = stubUsers();
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    await screen.findByText('Reem Al Kindi');
    await screen.findByRole('option', { name: 'Helideck Inspector' });
    await userEvent.setup().selectOptions(screen.getByLabelText('Role'), 'helideck-inspector');
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        decodeURIComponent(input instanceof Request ? input.url : String(input)),
      );
      expect(urls.some((u) => u.includes('filter[role]=helideck-inspector'))).toBe(true);
    });
  });

  it('PROMPT-2.7 a viewer sees the directory without change controls', async () => {
    stubUsers({ [reem.id]: detail(reem) });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ['view'] }) });
    await userEvent.setup().click(await screen.findByText('Reem Al Kindi'));
    const drawer = await screen.findByRole('dialog', { name: 'Reem Al Kindi' });
    expect(await within(drawer).findByText('Master Data Power User')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Add role' })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync now: SAP' })).not.toBeInTheDocument();
  });

  it('BRD-D.2.1.1-MST assigns a role with its scope and the reference ID', async () => {
    const { sent } = stubUsers({ [newcomer.id]: detail(newcomer) });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    const user = userEvent.setup();
    await user.click(await screen.findByText('Omar Haddad'));
    const drawer = await screen.findByRole('dialog', { name: 'Omar Haddad' });
    await user.click(await within(drawer).findByRole('button', { name: 'Add role' }));
    const form = await screen.findByRole('dialog', { name: 'Add a role for Omar Haddad' });
    // Staff are offered staff roles only.
    expect(
      within(form).queryByRole('option', { name: 'Service Provider' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(await within(form).findByLabelText('Role'), 'helideck-inspector');
    await user.click(within(form).getByLabelText('Das Island (DAS)'));
    await user.click(within(form).getByRole('button', { name: 'Save role' }));
    expect(within(form).getByText('Enter the reference ID')).toBeInTheDocument();
    await user.type(within(form).getByLabelText('Access-request reference ID'), 'RITM0012345');
    await user.click(within(form).getByRole('button', { name: 'Save role' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: `/api/v1/access/users/${newcomer.id}/assignments`,
          body: expect.objectContaining({
            roleCode: 'helideck-inspector',
            scope: { zoneIds: [ZONE.id] },
            referenceId: 'RITM0012345',
            validUntil: null,
          }) as unknown,
        }),
      );
    });
  });

  it('BRD-D.2.1.1-MST deactivates with a reason, the reference ID and the version', async () => {
    const { sent } = stubUsers({ [reem.id]: detail(reem) });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    const user = userEvent.setup();
    await user.click(await screen.findByText('Reem Al Kindi'));
    const drawer = await screen.findByRole('dialog', { name: 'Reem Al Kindi' });
    await user.click(await within(drawer).findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Reem Al Kindi?' });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(
      await within(dialog).findByText('Enter a reason (at least 3 characters)'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Contract paused');
    await user.type(within(dialog).getByLabelText('Access-request reference ID'), 'RITM0099');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/access/users/${reem.id}/deactivate`,
        body: { reason: 'Contract paused', referenceId: 'RITM0099' },
        ifMatch: '3',
      });
    });
  });

  it('ADR-0042 a user’s own record has no change controls', async () => {
    stubUsers({ [reem.id]: detail(reem, { isSelf: true }) });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    await userEvent.setup().click(await screen.findByText('Reem Al Kindi'));
    const drawer = await screen.findByRole('dialog', { name: 'Reem Al Kindi' });
    expect(
      await within(drawer).findByText(
        'This is you. Another administrator changes your access (segregation of duties).',
      ),
    ).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Add role' })).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', { name: 'Revoke Master Data Power User' }),
    ).not.toBeInTheDocument();
  });

  it('BRD-D.2.1.1-MST shows usage analytics', async () => {
    stubFetch((path) => {
      if (path === '/api/v1/access/users/analytics') {
        return json({
          signInsPerDay: Array.from({ length: 30 }, (_, i) => ({
            day: `2026-09-${String(i + 1).padStart(2, '0')}`,
            signIns: i % 3,
          })),
          activeUsers: 41,
          lastSignIn: { never: 5, within7Days: 30, within30Days: 11, within90Days: 4, older: 2 },
          expiring: [
            {
              userId: reem.id,
              displayName: 'Reem Al Kindi',
              role: 'Master Data Power User',
              validUntil: '2026-11-01',
            },
          ],
        });
      }
      if (path === '/api/v1/access/users')
        return json({ items: [], total: 0, page: 1, pageSize: 20 });
      if (path === '/api/v1/access/users/summary') return json(KPIS);
      if (path.startsWith('/api/v1/access/users/') || path.startsWith('/api/v1/integration/')) {
        return json({ items: [] });
      }
      return undefined;
    });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ['view'] }) });
    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Usage analytics' }));
    expect(await screen.findByText('41')).toBeInTheDocument();
    expect(screen.getByText('Reem Al Kindi · Master Data Power User')).toBeInTheDocument();
    expect(screen.getByText('until 1 Nov 2026')).toBeInTheDocument();
  });

  it('ADR-0030 sends an invited external user their invitation, with the reference ID', async () => {
    const external = detail(
      {
        ...newcomer,
        isExternal: true,
        signIn: 'password_otp',
        source: 'external_contact',
        status: 'invited',
      },
      { invitedAt: null },
    );
    const { sent } = stubUsers({ [newcomer.id]: external });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    const user = userEvent.setup();
    await user.click(await screen.findByText('Omar Haddad'));
    const drawer = await screen.findByRole('dialog', { name: 'Omar Haddad' });
    expect(within(drawer).getByText('VIA CONTACTS LIST')).toBeInTheDocument();
    await user.click(await within(drawer).findByRole('button', { name: 'Send invitation' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Send the invitation to Omar Haddad?',
    });
    expect(within(dialog).queryByLabelText('Reason')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Access-request reference ID'), 'RITM-INV');
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'POST',
        path: `/api/v1/access/users/${newcomer.id}/invitation`,
        body: { referenceId: 'RITM-INV' },
        ifMatch: null,
      });
    });
  });

  it('ADR-0041 a leaver’s record says why it can’t be reactivated yet; reactivation sends the version', async () => {
    const leaver = detail(
      { ...reem, status: 'deactivated' },
      {
        deactivatedReason: 'Left — source system',
        person: { ...detail(reem).person, sourceStatus: 'left' },
      },
    );
    const { sent } = stubUsers({ [reem.id]: leaver });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    const user = userEvent.setup();
    await user.click(await screen.findByText('Reem Al Kindi'));
    const drawer = await screen.findByRole('dialog', { name: 'Reem Al Kindi' });
    expect(
      await within(drawer).findByText(/SAP reports that this person has left/),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('Deactivated: Left — source system')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Add role' })).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Reactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reactivate Reem Al Kindi?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Rejoined');
    await user.type(within(dialog).getByLabelText('Access-request reference ID'), 'R-1');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          path: `/api/v1/access/users/${reem.id}/reactivate`,
          ifMatch: '3',
        }),
      );
    });
  });

  it('BRD-D.2.1.1-MST changes and revokes an assignment with its version, and sets the approval tier', async () => {
    const { sent } = stubUsers({ [reem.id]: detail(reem) });
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    const user = userEvent.setup();
    await user.click(await screen.findByText('Reem Al Kindi'));
    const drawer = await screen.findByRole('dialog', { name: 'Reem Al Kindi' });

    await user.click(
      await within(drawer).findByRole('button', { name: 'Edit Master Data Power User' }),
    );
    const form = await screen.findByRole('dialog', {
      name: 'Change Master Data Power User for Reem Al Kindi',
    });
    await user.clear(within(form).getByLabelText('Access until'));
    await user.type(within(form).getByLabelText('Access-request reference ID'), 'R-2');
    await user.click(within(form).getByRole('button', { name: 'Save role' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'PATCH',
        path: `/api/v1/access/assignments/${assignment.id}`,
        body: {
          scope: { allLocations: true },
          validFrom: '2026-01-01',
          validUntil: null,
          referenceId: 'R-2',
        },
        ifMatch: '2',
      });
    });

    await user.click(within(drawer).getByRole('button', { name: 'Revoke Master Data Power User' }));
    const revoke = await screen.findByRole('dialog', { name: 'Revoke Master Data Power User?' });
    await user.type(within(revoke).getByLabelText('Reason'), 'Moved team');
    await user.type(within(revoke).getByLabelText('Access-request reference ID'), 'R-3');
    await user.click(within(revoke).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          path: `/api/v1/access/assignments/${assignment.id}/revoke`,
          ifMatch: '2',
        }),
      );
    });

    await user.click(within(drawer).getByRole('button', { name: 'Set approval tier' }));
    const tier = await screen.findByRole('dialog', { name: 'Approval tier for Reem Al Kindi' });
    await user.selectOptions(within(tier).getByLabelText('Tier'), '2');
    await user.type(within(tier).getByLabelText('Access-request reference ID'), 'R-4');
    await user.click(within(tier).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(sent).toContainEqual({
        method: 'PATCH',
        path: `/api/v1/access/users/${reem.id}`,
        body: { approvalTier: 2, referenceId: 'R-4' },
        ifMatch: '3',
      });
    });

    await user.click(within(drawer).getByRole('button', { name: 'Show what has happened' }));
    expect(
      await within(drawer).findByText('User access assigned · Master Data Power User'),
    ).toBeInTheDocument();
  });

  it('PROMPT-2.9 starts a sync from the source systems panel', async () => {
    const { sent } = stubUsers();
    renderApp('/admin/users', { access: accessWith({ 'admin.users': ADMIN }) });
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Sync now: Fieldglass' }));
    await waitFor(() => {
      expect(sent).toContainEqual(
        expect.objectContaining({
          path: '/api/v1/integration/sync-runs',
          body: { adapter: 'fieldglass' },
        }),
      );
    });
  });
});
