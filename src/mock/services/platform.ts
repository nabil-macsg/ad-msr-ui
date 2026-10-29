import type { components } from '../../api/schema';
import { CAPABILITIES, MODULES, type ModuleKey, type Right } from '../../api/registry.generated';
import { audit, trail } from '../core/audit';
import {
  bodyOf,
  json,
  MockError,
  type MockRequest,
  noContent,
  notFound,
  required,
} from '../core/http';
import { listRows } from '../core/list';
import { masterCrud } from '../core/masters';
import { route } from '../core/router';
import { all, find, insert, newId, now, removeRow, replace, seed } from '../core/store';
import { currentPersona } from '../demo-auth';
import {
  ADMIN_TIER_RIGHTS,
  type AssignmentRow,
  type AuditEvent,
  assignmentSeeds,
  auditSeeds,
  CAPABILITY_TEXT,
  DEPARTMENTS,
  defaultPreferences,
  type DelegationRow,
  delegationSeeds,
  type DeviceRow,
  deviceSeeds,
  EMPTY_SCOPE,
  type GrantRow,
  grantSeeds,
  gstAt,
  INSTALLATION_SEEDS,
  LOCATION_SEEDS,
  LOCATIONS,
  MATRIX_PAGES,
  MODULE_OPTIONS,
  type MatrixVersionRow,
  matrixVersionSeeds,
  type NotificationRow,
  notificationSeeds,
  OPEN_RIGHTS,
  PREFERENCE_CATEGORIES,
  type PreferenceRow,
  PROVIDERS,
  type Role,
  ROUTE_SEEDS,
  roleSeeds,
  SCHEDULE_SEEDS,
  type ScopeSummary,
  type SupportArticle,
  supportArticleSeeds,
  SYNC_LABEL,
  type SyncRunRow,
  syncRunSeeds,
  type UserRow,
  userSeeds,
  ZONES,
} from '../data/platform';
import { gstDate } from '../data/ids';

type S = components['schemas'];
type Delegation = S['Delegation'];

const DAY = 86_400_000;
const T = {
  users: 'users',
  assignments: 'role-assignments',
  roles: 'roles',
  grants: 'access-grants',
  versions: 'matrix-versions',
  delegations: 'delegations',
  devices: 'devices',
  syncRuns: 'sync-runs',
  audit: 'audit',
  notifications: 'notifications',
  preferences: 'notification-preferences',
  articles: 'support-articles',
} as const;

// ---------------------------------------------------------------- shared helpers

const me = () => {
  const persona = currentPersona();
  if (!persona) throw new MockError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return persona.me;
};
const can = (page: string, right: Right = 'view') =>
  currentPersona()?.access.pages[page]?.includes(right) ?? false;
function requireRight(page: string, right: Right): void {
  me();
  if (!can(page, right)) {
    throw new MockError(403, 'FORBIDDEN', 'Your role does not allow this action.');
  }
}
const invalid = (fields: Record<string, string>): never => {
  throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fields });
};
function checkVersion(req: MockRequest, current: { version: number }): void {
  const ifMatch = req.headers.get('If-Match');
  if (ifMatch !== null && Number(ifMatch) !== current.version) {
    throw new MockError(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this record. Reload and try again.',
    );
  }
}
function must<T extends { id: string }>(
  rows: readonly T[],
  id: string | undefined,
  noun: string,
): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new MockError(404, 'NOT_FOUND', `The ${noun} was not found.`);
  return row;
}
const instant = (value: unknown, field: string): string => {
  const text = typeof value === 'string' ? value : '';
  return Number.isNaN(Date.parse(text))
    ? invalid({ [field]: 'Enter a valid date and time' })
    : new Date(text).toISOString();
};

/** A copy of a stored row without its storage-only fields. */
function omit<R extends object, K extends keyof R>(row: R, keys: readonly K[]): Omit<R, K> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !(keys as readonly PropertyKey[]).includes(key)),
  ) as Omit<R, K>;
}

/** Records an audit event, with the change's access-request reference and risk flag. */
function record(
  type: string,
  rec: { id: string; ref: string; label: string },
  action: string,
  label: string,
  detail: {
    reason?: string | null;
    before?: unknown;
    after?: unknown;
    referenceId?: string;
    highRisk?: boolean;
  } = {},
): void {
  const { referenceId, highRisk, ...rest } = detail;
  audit(type, rec, action, label, rest);
  const latest = all<AuditEvent>(T.audit)[0];
  if (latest && (referenceId !== undefined || highRisk)) {
    replace<AuditEvent>(T.audit, {
      ...latest,
      referenceId: referenceId ?? null,
      highRisk: highRisk ?? false,
    });
  }
}

/** A CSV download, the shape exports have in the demo (Excel requests get CSV too). */
function csv(name: string, rows: readonly Record<string, unknown>[]): Response {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    const text =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : v === null || v === undefined
          ? ''
          : JSON.stringify(v);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const body = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => cell(r[h])).join(',')),
  ].join('\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="${name}-${gstDate()}.csv"`,
    },
  });
}
const withoutPaging = (query: URLSearchParams) => {
  const copy = new URLSearchParams(query);
  copy.delete('page');
  copy.delete('pageSize');
  return copy;
};

// ---------------------------------------------------------------- users and roles

const roles = () => all<Role>(T.roles);
const roleByCode = (code: string) => roles().find((r) => r.code === code);

function stateOf(a: AssignmentRow): S['RoleAssignment']['state'] {
  const t = Date.now();
  if (Date.parse(a.validFrom) > t) return 'scheduled';
  if (a.validUntil && Date.parse(a.validUntil) < t) return 'expired';
  return 'active';
}
const assignmentView = (a: AssignmentRow): S['RoleAssignment'] => {
  return { ...omit(a, ['userId']), state: stateOf(a) };
};
const assignmentsOf = (userId: string) =>
  all<AssignmentRow>(T.assignments).filter((a) => a.userId === userId);
const liveAssignments = (userId: string) =>
  assignmentsOf(userId).filter((a) => stateOf(a) !== 'expired');

function holders(code: string): number {
  const users = new Set(
    all<AssignmentRow>(T.assignments)
      .filter((a) => a.role.code === code && stateOf(a) === 'active')
      .map((a) => a.userId),
  );
  return all<UserRow>(T.users).filter((u) => users.has(u.id) && u.status !== 'deactivated').length;
}
const roleView = (r: Role): Role => ({ ...r, holders: holders(r.code) });

function summaryOf(u: UserRow): S['UserSummary'] {
  const live = liveAssignments(u.id);
  const ends = live.map((a) => a.validUntil);
  return {
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    personnelNo: u.personnelNo,
    organisation: u.organisation,
    source: u.source,
    signIn: u.signIn,
    isExternal: u.isExternal,
    status: u.status,
    roles: live.map((a) => ({
      assignmentId: a.id,
      code: a.role.code,
      name: a.role.name,
      isAdminTier: a.role.isAdminTier,
      validUntil: a.validUntil,
      scope: a.scope,
    })),
    accessUntil:
      ends.length > 0 && ends.every((e) => e !== null)
        ? (ends
            .flatMap((e) => (e ? [e] : []))
            .sort()
            .at(-1) ?? null)
        : null,
    lastSignInAt: u.lastSignInAt,
    version: u.version,
  };
}
function detailOf(u: UserRow): S['UserDetail'] {
  return {
    ...summaryOf(u),
    person: u.person,
    approvalTier: u.approvalTier,
    invitedAt: u.invitedAt,
    activatedAt: u.activatedAt,
    deactivatedAt: u.deactivatedAt,
    deactivatedReason: u.deactivatedReason,
    assignments: assignmentsOf(u.id).map(assignmentView),
    isSelf: u.id === currentPersona()?.me.id,
  };
}
const userRef = (u: UserRow) => ({ id: u.id, ref: u.personnelNo, label: u.displayName });
const expiresSoon = (until: string | null) =>
  until !== null && Date.parse(until) - Date.now() <= 30 * DAY && Date.parse(until) > Date.now();

const scopeLabel = (s: ScopeSummary) =>
  s.allLocations
    ? 'All locations'
    : [
        ...s.zones.map((z) => z.name),
        ...s.locations.map((l) => l.name),
        ...(s.serviceProvider ? [s.serviceProvider.name] : []),
        ...s.departments.map((d) => d.name),
        ...(s.self ? ['Self'] : []),
        ...(s.lineManagerOf ? ['Their own people'] : []),
      ].join(', ');

/** A scope sent with ids, checked against the role's level, as the summary the API returns. */
function scopeFrom(raw: unknown, level: Role['scopeLevel']): ScopeSummary {
  const scope = (raw ?? {}) as Record<string, unknown>;
  const ids = (name: string) =>
    Array.isArray(scope[name]) ? (scope[name] as unknown[]).map(String) : [];
  const resolve = (
    list: readonly { id: string; code: string; name: string }[],
    values: string[],
    field: string,
  ) =>
    values.map((id) => {
      const found = list.find((r) => r.id === id);
      return found
        ? { id: found.id, code: found.code, name: found.name }
        : invalid({ [`scope.${field}`]: 'Unknown value' });
    });
  const provider =
    typeof scope.serviceProviderId === 'string'
      ? resolve(PROVIDERS, [scope.serviceProviderId], 'serviceProviderId')[0]
      : undefined;
  const moduleKeys = ids('moduleKeys').filter((k): k is ModuleKey =>
    MODULES.some((m) => m.key === k),
  );
  const out: ScopeSummary = {
    ...EMPTY_SCOPE,
    allLocations: scope.allLocations === true,
    zones: resolve(ZONES, ids('zoneIds'), 'zoneIds'),
    locations: resolve(LOCATIONS, ids('locationIds'), 'locationIds'),
    serviceProvider: provider ?? null,
    departments: resolve(DEPARTMENTS, ids('departmentIds'), 'departmentIds'),
    moduleKeys: moduleKeys.length > 0 ? moduleKeys : null,
    self: scope.self === true,
    lineManagerOf: scope.lineManagerOf === true,
  };
  const places = out.allLocations || out.zones.length > 0 || out.locations.length > 0;
  const ok: Record<Role['scopeLevel'], boolean> = {
    platform: out.allLocations,
    module: out.moduleKeys !== null,
    zone: out.allLocations || out.zones.length > 0,
    site: places,
    provider: out.serviceProvider !== null,
    department: out.departments.length > 0,
    self: out.self || out.lineManagerOf,
  };
  const need: Record<Role['scopeLevel'], string> = {
    platform: 'This role applies to all locations',
    module: 'Choose at least one module',
    zone: 'Choose at least one zone',
    site: 'Choose at least one location or zone',
    provider: 'Choose the service provider',
    department: 'Choose at least one department',
    self: 'Choose self or their own people',
  };
  if (!ok[level]) invalid({ scope: need[level] });
  return out;
}

function validity(body: Record<string, unknown>, from: string, until: string | null) {
  const validFrom = body.validFrom === undefined ? from : instant(body.validFrom, 'validFrom');
  const validUntil =
    body.validUntil === undefined
      ? until
      : body.validUntil === null
        ? null
        : instant(body.validUntil, 'validUntil');
  if (validUntil !== null && Date.parse(validUntil) <= Date.parse(validFrom)) {
    invalid({ validUntil: 'Must be after the start' });
  }
  return { validFrom, validUntil };
}

function changeableUser(id: string | undefined): UserRow {
  const user = must(all<UserRow>(T.users), id, 'user');
  if (user.id === me().id) {
    throw new MockError(
      403,
      'OWN_ACCESS',
      'You cannot change your own access. Ask another administrator.',
    );
  }
  return user;
}
const touchUser = (u: UserRow) => replace<UserRow>(T.users, { ...u, version: u.version + 1 });

function registerUsers(): void {
  route('GET', '/api/v1/access/users/:id', (req) =>
    json(detailOf(must(all<UserRow>(T.users), req.params.id, 'user'))),
  );
  route('GET', '/api/v1/access/users/:id/history', (req) => json(trail(req.params.id ?? '')));

  const listUsers = (query: URLSearchParams) =>
    listRows(all<UserRow>(T.users).map(summaryOf), query, {
      hasActive: false,
      search: (u) => [u.displayName, u.email, u.personnelNo, u.organisation],
      filters: {
        role: (u, v) => u.roles.some((r) => r.code === v),
        zone: (u, v) =>
          u.roles.some(
            (r) =>
              r.scope.allLocations ||
              r.scope.zones.some((z) => z.id === v) ||
              r.scope.locations.some((l) => LOCATIONS.find((x) => x.id === l.id)?.zoneId === v),
          ),
        access: (u, v) =>
          v === 'none' ? u.roles.length === 0 : u.roles.some((r) => expiresSoon(r.validUntil)),
      },
      sorts: { name: (u) => u.displayName, lastSignIn: (u) => u.lastSignInAt },
      defaultSort: 'name:asc',
    });
  route('GET', '/api/v1/access/users', (req) => json(listUsers(req.query)));
  route('GET', '/api/v1/access/users/export', (req) =>
    csv(
      'users',
      listUsers(withoutPaging(req.query)).items.map((u) => ({
        name: u.displayName,
        email: u.email,
        personnelNo: u.personnelNo,
        organisation: u.organisation,
        source: u.source,
        status: u.status,
        roles: u.roles.map((r) => r.name).join('; '),
        accessUntil: u.accessUntil,
        lastSignInAt: u.lastSignInAt,
      })),
    ),
  );

  route('GET', '/api/v1/access/users/summary', () => {
    const users = all<UserRow>(T.users).filter((u) => u.status !== 'deactivated');
    const summaries = users.map(summaryOf);
    const overLimit = roles()
      .map(roleView)
      .filter((r) => r.maxHolders !== null && r.holders > r.maxHolders)
      .map((r) => ({
        code: r.code,
        name: r.name,
        holders: r.holders,
        maxHolders: r.maxHolders ?? 0,
      }));
    const body: S['UserKpis'] = {
      registered: users.length,
      active: users.filter((u) => u.status === 'active').length,
      invited: users.filter((u) => u.status === 'invited').length,
      expiringIn30Days: summaries.filter((u) => u.roles.some((r) => expiresSoon(r.validUntil)))
        .length,
      external: users.filter((u) => u.isExternal).length,
      withoutRoles: summaries.filter((u) => u.roles.length === 0).length,
      adminTierHolders: summaries.filter((u) => u.roles.some((r) => r.isAdminTier)).length,
      overLimit,
    };
    return json(body);
  });

  route('GET', '/api/v1/access/users/analytics', () => {
    const users = all<UserRow>(T.users).filter((u) => u.status !== 'deactivated');
    const age = (u: UserRow) =>
      u.lastSignInAt ? (Date.now() - Date.parse(u.lastSignInAt)) / DAY : null;
    const between = (lo: number, hi: number) =>
      users.filter((u) => (age(u) ?? Infinity) > lo && (age(u) ?? Infinity) <= hi).length;
    const signInsPerDay = Array.from({ length: 30 }, (_, i) => {
      const day = gstDate(i - 29);
      const weekday = new Date(`${day}T12:00:00+04:00`).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      return { day, signIns: (weekend ? 14 : 38) + ((i * 7 + 3) % 11) };
    });
    const expiring = all<AssignmentRow>(T.assignments)
      .filter((a) => stateOf(a) === 'active' && expiresSoon(a.validUntil))
      .flatMap((a) => {
        const u = find<UserRow>(T.users, a.userId);
        return u && u.status !== 'deactivated'
          ? [
              {
                userId: u.id,
                displayName: u.displayName,
                role: a.role.name,
                validUntil: a.validUntil ?? '',
              },
            ]
          : [];
      })
      .sort((a, b) => a.validUntil.localeCompare(b.validUntil));
    const body: S['UserAnalytics'] = {
      signInsPerDay,
      activeUsers: between(-1, 30),
      lastSignIn: {
        never: users.filter((u) => u.lastSignInAt === null).length,
        within7Days: between(-1, 7),
        within30Days: between(7, 30),
        within90Days: between(30, 90),
        older: between(90, Infinity),
      },
      expiring,
    };
    return json(body);
  });

  route('GET', '/api/v1/access/users/role-options', () =>
    json({
      items: roles()
        .filter((r) => r.isActive)
        .map((r) => ({
          code: r.code,
          name: r.name,
          description: r.description,
          scopeLevel: r.scopeLevel,
          isExternal: r.isExternal,
          isAdminTier: r.isAdminTier,
          maxHolders: r.maxHolders,
          holders: holders(r.code),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    } satisfies S['RoleOptions']),
  );
  route('GET', '/api/v1/access/users/scope-options', () =>
    json({
      zones: ZONES,
      locations: LOCATIONS,
      serviceProviders: PROVIDERS,
      departments: DEPARTMENTS,
      modules: MODULE_OPTIONS,
    } satisfies S['ScopeOptions']),
  );

  route('PATCH', '/api/v1/access/users/:id', (req) => {
    requireRight('admin.users', 'edit');
    const user = changeableUser(req.params.id);
    checkVersion(req, user);
    const body = bodyOf(req);
    const referenceId = required(body.referenceId, 'referenceId');
    const tier = body.approvalTier;
    if (
      tier !== null &&
      !(typeof tier === 'number' && Number.isInteger(tier) && tier >= 1 && tier <= 5)
    ) {
      invalid({ approvalTier: 'Choose a tier from 1 to 5, or none' });
    }
    const next = touchUser({ ...user, approvalTier: tier as number | null });
    record('user', userRef(next), 'changed', 'Approval tier changed', {
      before: { approvalTier: user.approvalTier },
      after: { approvalTier: next.approvalTier },
      referenceId,
    });
    return noContent();
  });

  route('POST', '/api/v1/access/users/:id/assignments', (req) => {
    requireRight('admin.users', 'edit');
    const user = changeableUser(req.params.id);
    const body = bodyOf(req);
    const referenceId = required(body.referenceId, 'referenceId');
    const role = roleByCode(required(body.roleCode, 'roleCode'));
    if (!role?.isActive) return invalid({ roleCode: 'Choose an active role' });
    if (user.status === 'deactivated') {
      throw new MockError(409, 'USER_DEACTIVATED', 'Reactivate this user before assigning a role.');
    }
    if (role.isExternal !== user.isExternal) {
      invalid({
        roleCode: role.isExternal
          ? 'This role is for people outside ADNOC'
          : 'This role is for ADNOC staff',
      });
    }
    if (liveAssignments(user.id).some((a) => a.role.code === role.code)) {
      throw new MockError(
        409,
        'ALREADY_ASSIGNED',
        `${user.displayName} already holds ${role.name}.`,
      );
    }
    if (role.maxHolders !== null && holders(role.code) >= role.maxHolders) {
      throw new MockError(
        409,
        'ROLE_FULL',
        `${role.name} already has its maximum of ${role.maxHolders} holders.`,
      );
    }
    const scope = scopeFrom(body.scope, role.scopeLevel);
    const at = now();
    const row = insert<AssignmentRow>(T.assignments, {
      id: newId(),
      userId: user.id,
      role: {
        code: role.code,
        name: role.name,
        scopeLevel: role.scopeLevel,
        isExternal: role.isExternal,
        isAdminTier: role.isAdminTier,
      },
      scope,
      ...validity(body, at, null),
      accessRequestRef: referenceId,
      assignedBy: me().displayName,
      assignedAt: at,
      version: 1,
    });
    touchUser(user);
    record('user', userRef(user), 'role-assigned', 'Role assigned', {
      after: { role: role.name, scope: scopeLabel(scope), validUntil: row.validUntil },
      referenceId,
      highRisk: role.isAdminTier,
    });
    return json(assignmentView(row), 201);
  });

  route('PATCH', '/api/v1/access/assignments/:id', (req) => {
    requireRight('admin.users', 'edit');
    const current = must(all<AssignmentRow>(T.assignments), req.params.id, 'role assignment');
    const user = changeableUser(current.userId);
    checkVersion(req, current);
    const body = bodyOf(req);
    const referenceId = required(body.referenceId, 'referenceId');
    const scope =
      body.scope === undefined ? current.scope : scopeFrom(body.scope, current.role.scopeLevel);
    const row = replace<AssignmentRow>(T.assignments, {
      ...current,
      scope,
      ...validity(body, current.validFrom, current.validUntil),
      version: current.version + 1,
    });
    touchUser(user);
    record('user', userRef(user), 'assignment-changed', 'Role assignment changed', {
      before: {
        role: current.role.name,
        scope: scopeLabel(current.scope),
        validUntil: current.validUntil,
      },
      after: { role: row.role.name, scope: scopeLabel(row.scope), validUntil: row.validUntil },
      referenceId,
    });
    return json(assignmentView(row));
  });

  route('POST', '/api/v1/access/assignments/:id/revoke', (req) => {
    requireRight('admin.users', 'edit');
    const current = must(all<AssignmentRow>(T.assignments), req.params.id, 'role assignment');
    const user = changeableUser(current.userId);
    checkVersion(req, current);
    const body = bodyOf(req);
    const reason = required(body.reason, 'reason');
    const referenceId = required(body.referenceId, 'referenceId');
    removeRow(T.assignments, current.id);
    touchUser(user);
    record('user', userRef(user), 'role-revoked', 'Role revoked', {
      reason,
      before: { role: current.role.name, scope: scopeLabel(current.scope) },
      referenceId,
      highRisk: current.role.isAdminTier,
    });
    return noContent();
  });

  for (const [action, status] of [
    ['deactivate', 'deactivated'],
    ['reactivate', 'active'],
  ] as const) {
    route('POST', `/api/v1/access/users/:id/${action}`, (req) => {
      requireRight('admin.users', 'edit');
      const user = changeableUser(req.params.id);
      checkVersion(req, user);
      const body = bodyOf(req);
      const reason = required(body.reason, 'reason');
      const referenceId = required(body.referenceId, 'referenceId');
      if ((status === 'deactivated') === (user.status === 'deactivated')) {
        throw new MockError(
          409,
          'ALREADY_IN_STATE',
          `${user.displayName} is already ${user.status}.`,
        );
      }
      const next = touchUser({
        ...user,
        status,
        deactivatedAt: status === 'deactivated' ? now() : null,
        deactivatedReason: status === 'deactivated' ? reason : null,
      });
      record(
        'user',
        userRef(next),
        status,
        status === 'active' ? 'User reactivated' : 'User deactivated',
        {
          reason,
          before: { status: user.status },
          after: { status: next.status },
          referenceId,
        },
      );
      return noContent();
    });
  }

  route('POST', '/api/v1/access/users/:id/invitation', (req) => {
    requireRight('admin.users', 'edit');
    const user = must(all<UserRow>(T.users), req.params.id, 'user');
    const referenceId = required(bodyOf(req).referenceId, 'referenceId');
    if (!user.isExternal || user.status !== 'invited') {
      throw new MockError(
        409,
        'NOT_INVITABLE',
        'Only invited external users can be sent a new invitation.',
      );
    }
    touchUser({ ...user, invitedAt: now() });
    record('user', userRef(user), 'invited', 'Invitation re-sent', { referenceId });
    return new Response(null, { status: 202 });
  });
}

// ---------------------------------------------------------------- sync runs

/** Finishes demo sync runs a few seconds after they start. */
function settleSyncRuns(): void {
  for (const run of all<SyncRunRow>(T.syncRuns)) {
    if (run.status !== 'running' || Date.now() - Date.parse(run.startedAt) < 6_000) continue;
    const fetched = { sap: 1846, fieldglass: 415, hse_passport: 2214 }[run.adapter];
    replace<SyncRunRow>(T.syncRuns, {
      ...run,
      status: 'succeeded',
      finishedAt: new Date(Date.parse(run.startedAt) + 6_000).toISOString(),
      counts: { fetched, created: 1, updated: 12, unchanged: fetched - 13, errors: 0 },
    });
  }
}
const syncRunView = (r: SyncRunRow): S['SyncRun'] => {
  return omit(r, ['errors']);
};

function registerSync(): void {
  route('GET', '/api/v1/integration/sync-runs', (req) => {
    settleSyncRuns();
    const page = listRows(all<SyncRunRow>(T.syncRuns), req.query, {
      hasActive: false,
      defaultSort: 'startedAt:desc',
    });
    return json({ ...page, items: page.items.map(syncRunView) });
  });
  route('GET', '/api/v1/integration/sync-runs/:id/errors', (req) =>
    json({ items: must(all<SyncRunRow>(T.syncRuns), req.params.id, 'sync run').errors }),
  );
  route('GET', '/api/v1/integration/sync-runs/latest', () => {
    settleSyncRuns();
    return json({ items: latestRuns().map(syncRunView) });
  });
  route('POST', '/api/v1/integration/sync-runs', (req) => {
    requireRight('admin.users', 'edit');
    const adapter = bodyOf(req).adapter;
    if (adapter !== 'sap' && adapter !== 'fieldglass' && adapter !== 'hse_passport') {
      return invalid({ adapter: 'Choose SAP, Fieldglass or HSE Passport' });
    }
    settleSyncRuns();
    if (all<SyncRunRow>(T.syncRuns).some((r) => r.adapter === adapter && r.status === 'running')) {
      throw new MockError(409, 'SYNC_RUNNING', `A ${SYNC_LABEL[adapter]} sync is already running.`);
    }
    const run = insert<SyncRunRow>(T.syncRuns, {
      id: newId(),
      adapter,
      trigger: 'manual',
      triggeredBy: me().displayName,
      status: 'running',
      startedAt: now(),
      finishedAt: null,
      counts: {},
      error: null,
      errors: [],
    });
    record(
      'sync-run',
      { id: run.id, ref: SYNC_LABEL[adapter], label: `${SYNC_LABEL[adapter]} sync` },
      'requested',
      'Sync requested',
    );
    return json({ id: run.id }, 202);
  });
}
function latestRuns(): SyncRunRow[] {
  const runs = [...all<SyncRunRow>(T.syncRuns)].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  return (['sap', 'fieldglass', 'hse_passport'] as const).flatMap((adapter) => {
    const run = runs.find((r) => r.adapter === adapter);
    return run ? [run] : [];
  });
}

// ---------------------------------------------------------------- roles and the access matrix

function registerRoles(): void {
  const types = ['system', 'module', 'end_user'];
  const levels = ['platform', 'module', 'zone', 'site', 'provider', 'department', 'self'];
  const fields = (body: Record<string, unknown>, current?: Role) => {
    const errors: Record<string, string> = {};
    const name = typeof body.name === 'string' ? body.name.trim() : (current?.name ?? '');
    const description =
      typeof body.description === 'string' ? body.description.trim() : (current?.description ?? '');
    const type = (body.type ?? current?.type) as Role['type'];
    const scopeLevel = (body.scopeLevel ?? current?.scopeLevel) as Role['scopeLevel'];
    const channels: unknown[] = Array.isArray(body.channels)
      ? body.channels
      : (current?.channels ?? []);
    const maxHolders =
      body.maxHolders === undefined ? (current?.maxHolders ?? null) : body.maxHolders;
    if (!name) errors.name = 'Required';
    if (!description) errors.description = 'Required';
    if (!types.includes(type)) errors.type = 'Choose a type';
    if (!levels.includes(scopeLevel)) errors.scopeLevel = 'Choose a scope level';
    if (channels.length === 0 || channels.some((c) => c !== 'web' && c !== 'app'))
      errors.channels = 'Choose web, app or both';
    if (
      maxHolders !== null &&
      !(typeof maxHolders === 'number' && Number.isInteger(maxHolders) && maxHolders >= 1)
    ) {
      errors.maxHolders = 'Enter a whole number from 1, or leave empty';
    } else if (current && maxHolders !== null && maxHolders < holders(current.code)) {
      errors.maxHolders = `${holders(current.code)} people already hold this role`;
    }
    if (Object.keys(errors).length > 0) invalid(errors);
    return {
      name,
      description,
      type,
      scopeLevel,
      channels: [...new Set(channels)] as Role['channels'],
      maxHolders: maxHolders as number | null,
      isLocked: typeof body.isLocked === 'boolean' ? body.isLocked : (current?.isLocked ?? false),
      isExternal:
        typeof body.isExternal === 'boolean' ? body.isExternal : (current?.isExternal ?? false),
    };
  };
  const guardLocked = (role: Role) => {
    if (role.isLocked && !currentPersona()?.me.roles.some((r) => r.code === 'super-admin')) {
      throw new MockError(403, 'ROLE_LOCKED', 'Only a Super Admin can change a locked role.');
    }
  };

  masterCrud<Role>('/api/v1/access/roles', T.roles, 'role', {
    search: (r) => [r.code, r.name, r.description],
    sorts: { name: (r) => r.name },
    defaultSort: 'name:asc',
    view: roleView,
    describe: (r) => ({ ref: r.code, label: r.name }),
    create: (body) => {
      requireRight('admin.roles', 'create');
      const code = required(body.code, 'code').toLowerCase();
      if (!/^[a-z][a-z0-9-]{1,39}$/.test(code))
        invalid({ code: 'Use lower-case letters, digits and hyphens' });
      return { code, ...fields(body), holders: 0, isAdminTier: false, deactivatedReason: null };
    },
    update: (current, body) => {
      requireRight('admin.roles', 'edit');
      guardLocked(current);
      return { ...current, ...fields(body, current) };
    },
  });
  route('GET', '/api/v1/access/roles/export', (req) =>
    csv(
      'roles',
      listRows(roles().map(roleView), withoutPaging(req.query), {
        search: (r) => [r.code, r.name],
      }).items.map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        scopeLevel: r.scopeLevel,
        holders: r.holders,
        maxHolders: r.maxHolders,
        channels: r.channels.join('; '),
        active: r.isActive,
      })),
    ),
  );
  route('POST', '/api/v1/access/roles/:id/deactivate', (req) => {
    requireRight('admin.roles', 'deactivate');
    const role = must(all<Role>(T.roles), req.params.id, 'role');
    checkVersion(req, role);
    const reason = required(bodyOf(req).reason, 'reason');
    guardLocked(role);
    if (!role.isActive)
      throw new MockError(409, 'ALREADY_IN_STATE', 'The role is already deactivated.');
    if (holders(role.code) > 0) {
      throw new MockError(
        409,
        'ROLE_IN_USE',
        `${holders(role.code)} people hold this role. Revoke it from them first.`,
      );
    }
    const next = replace<Role>(T.roles, {
      ...role,
      isActive: false,
      deactivatedReason: reason,
      version: role.version + 1,
      updatedAt: now(),
    });
    record(
      'role',
      { id: role.id, ref: role.code, label: role.name },
      'deactivated',
      'Role deactivated',
      { reason },
    );
    return json(roleView(next));
  });
  route('DELETE', '/api/v1/access/roles/:id', (req) => {
    requireRight('admin.roles', 'delete');
    const role = must(all<Role>(T.roles), req.params.id, 'role');
    checkVersion(req, role);
    const reason = required(bodyOf(req).reason, 'reason');
    if (role.isLocked || role.type === 'system') {
      throw new MockError(409, 'ROLE_LOCKED', 'System and locked roles cannot be deleted.');
    }
    if (all<AssignmentRow>(T.assignments).some((a) => a.role.code === role.code)) {
      throw new MockError(
        409,
        'ROLE_IN_USE',
        'This role has been assigned. Deactivate it instead.',
      );
    }
    removeRow(T.roles, role.id);
    removeRow(T.grants, role.id);
    record('role', { id: role.id, ref: role.code, label: role.name }, 'deleted', 'Role deleted', {
      reason,
      highRisk: true,
    });
    return noContent();
  });
}

const RIGHT_LABEL: Record<Right, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  deactivate: 'Deactivate',
  delete: 'Delete',
  export: 'Export',
  reopen: 'Reopen',
};
const RIGHT_ORDER = Object.keys(RIGHT_LABEL) as Right[];

function grantOf(roleId: string): GrantRow {
  const existing = find<GrantRow>(T.grants, roleId);
  if (existing) return existing;
  return insert<GrantRow>(T.grants, {
    id: roleId,
    version: 1,
    modules: {},
    pages: {},
    capabilities: [],
  });
}

function readOnlyReason(role: Role): S['RoleMatrix']['readOnlyReason'] {
  if (role.code === 'super-admin') return 'super-admin';
  const persona = currentPersona();
  if (persona?.me.roles.some((r) => r.code === role.code)) return 'own-role';
  if (!can('admin.access-rights', 'edit')) return 'view-only';
  if (role.isLocked && !persona?.me.roles.some((r) => r.code === 'super-admin')) return 'locked';
  return null;
}

function matrixOf(role: Role): S['RoleMatrix'] {
  const grant = grantOf(role.id);
  const granted = (key: string) => grant.pages[key] ?? [];
  const pages = MATRIX_PAGES.map((p) => granted(p.key));
  const reason = readOnlyReason(role);
  const modules = MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    enabled: grant.modules[m.key] ?? false,
    pages: MATRIX_PAGES.filter((p) => p.module === m.key).map((p) => ({
      key: p.key,
      label: p.label,
      area: p.area,
      channel: p.channel,
      available: [...p.rights],
      openRights: [...(OPEN_RIGHTS[p.key] ?? [])],
      granted: [...granted(p.key)],
    })),
  }));
  return {
    role: {
      id: role.id,
      code: role.code,
      name: role.name,
      isAdminTier: role.isAdminTier,
      isLocked: role.isLocked,
      isActive: role.isActive,
    },
    version: grant.version,
    modules,
    capabilities: CAPABILITIES.map((c) => {
      const held = grant.capabilities.find((g) => g.key === c.key);
      return {
        key: c.key,
        module: c.module,
        label: c.label,
        description: CAPABILITY_TEXT[c.key] ?? c.label,
        locationScoped: c.locationScoped,
        granted: held !== undefined,
        locationIds: held?.locationIds ?? null,
      };
    }),
    kpis: {
      modulesHeld: modules.filter((m) => m.enabled).length,
      modulesTotal: modules.length,
      view: pages.filter((r) => r.includes('view')).length,
      edit: pages.filter((r) => r.includes('edit')).length,
      export: pages.filter((r) => r.includes('export')).length,
    },
    editable: reason === null,
    readOnlyReason: reason,
  };
}

/** The changes a save makes, worded for the matrix history. */
function diffGrants(
  role: Role,
  before: GrantRow,
  after: Omit<GrantRow, 'id' | 'version'>,
): S['MatrixChanges']['changes'] {
  const changes: S['MatrixChanges']['changes'] = [];
  const rights = (list: readonly Right[] | undefined) =>
    list && list.length > 0 ? list.map((r) => RIGHT_LABEL[r]).join(', ') : 'None';
  for (const m of MODULES) {
    const was = before.modules[m.key] ?? false;
    const is = after.modules[m.key] ?? false;
    if (was !== is)
      changes.push({
        role: role.name,
        kind: 'module',
        key: m.key,
        label: m.label,
        before: was ? 'On' : 'Off',
        after: is ? 'On' : 'Off',
      });
  }
  for (const p of MATRIX_PAGES) {
    const was = rights(before.pages[p.key]);
    const is = rights(after.pages[p.key]);
    if (was !== is)
      changes.push({
        role: role.name,
        kind: 'page',
        key: p.key,
        label: p.label,
        before: was,
        after: is,
      });
  }
  const capText = (g: GrantRow['capabilities'][number] | undefined) =>
    !g
      ? 'Not granted'
      : g.locationIds === null
        ? 'Granted'
        : `Granted at ${g.locationIds.map((id) => LOCATIONS.find((l) => l.id === id)?.code ?? id).join(', ')}`;
  for (const c of CAPABILITIES) {
    const was = capText(before.capabilities.find((g) => g.key === c.key));
    const is = capText(after.capabilities.find((g) => g.key === c.key));
    if (was !== is)
      changes.push({
        role: role.name,
        kind: 'capability',
        key: c.key,
        label: c.label,
        before: was,
        after: is,
      });
  }
  return changes;
}

function registerMatrix(): void {
  const roleOf = (id: string | undefined) => must(all<Role>(T.roles), id, 'role');
  route('GET', '/api/v1/access/access-rights/:roleId', (req) =>
    json(matrixOf(roleOf(req.params.roleId))),
  );

  route('PUT', '/api/v1/access/access-rights/:roleId', (req) => {
    requireRight('admin.access-rights', 'edit');
    const role = roleOf(req.params.roleId);
    const reason = readOnlyReason(role);
    if (reason !== null)
      throw new MockError(
        403,
        'MATRIX_READ_ONLY',
        'This role’s access rights cannot be changed by you.',
      );
    const current = grantOf(role.id);
    checkVersion(req, current);
    const body = bodyOf(req);
    const errors: Record<string, string> = {};

    const modules: GrantRow['modules'] = {};
    const sentModules = (body.modules ?? {}) as Record<string, unknown>;
    for (const m of MODULES)
      modules[m.key] =
        sentModules[m.key] === undefined
          ? (current.modules[m.key] ?? false)
          : sentModules[m.key] === true;

    const pages: GrantRow['pages'] = {};
    for (const [key, value] of Object.entries((body.pages ?? {}) as Record<string, unknown>)) {
      const page = MATRIX_PAGES.find((p) => p.key === key);
      if (!page) {
        errors[`pages.${key}`] = 'Unknown page';
        continue;
      }
      const sent = new Set((Array.isArray(value) ? value : []) as Right[]);
      if (sent.size > 0) sent.add('view');
      const bad = [...sent].find(
        (r) =>
          !(page.rights as readonly Right[]).includes(r) ||
          (!role.isAdminTier &&
            ADMIN_TIER_RIGHTS.includes(r) &&
            !(OPEN_RIGHTS[key] ?? []).includes(r)),
      );
      if (bad)
        errors[`pages.${key}`] =
          `${RIGHT_LABEL[bad]} cannot be granted on ${page.label} to this role`;
      const list = RIGHT_ORDER.filter((r) => sent.has(r));
      if (list.length > 0) pages[key] = list;
    }

    const capabilities: GrantRow['capabilities'] = [];
    for (const raw of (Array.isArray(body.capabilities) ? body.capabilities : []) as {
      key?: unknown;
      locationIds?: unknown;
    }[]) {
      const cap = CAPABILITIES.find((c) => c.key === raw.key);
      if (!cap) {
        errors.capabilities = `Unknown capability ${String(raw.key)}`;
        continue;
      }
      const ids = Array.isArray(raw.locationIds) ? raw.locationIds.map(String) : null;
      if (ids && !cap.locationScoped)
        errors[`capabilities.${cap.key}`] = 'This capability is not set per location';
      if (ids?.some((id) => !LOCATIONS.some((l) => l.id === id)))
        errors[`capabilities.${cap.key}`] = 'Unknown location';
      if (ids?.length === 0) errors[`capabilities.${cap.key}`] = 'Choose at least one location';
      capabilities.push({ key: cap.key, locationIds: ids });
    }
    if (Object.keys(errors).length > 0) invalid(errors);

    const changes = diffGrants(role, current, { modules, pages, capabilities });
    if (changes.length === 0) return json(matrixOf(role));
    replace<GrantRow>(T.grants, {
      id: role.id,
      version: current.version + 1,
      modules,
      pages,
      capabilities,
    });
    const versionNo = Math.max(0, ...all<MatrixVersionRow>(T.versions).map((v) => v.versionNo)) + 1;
    const first = changes[0];
    const summary =
      changes.length === 1 && first
        ? `${first.label}: ${first.before} → ${first.after}`
        : `${changes.length} changes (${[...new Set(changes.map((c) => c.label))].slice(0, 3).join(', ')}${changes.length > 3 ? ', …' : ''})`;
    insert<MatrixVersionRow>(T.versions, {
      id: newId(),
      versionNo,
      roleId: role.id,
      roleName: role.name,
      summary,
      changedBy: me().displayName,
      changedAt: now(),
      changes,
    });
    record(
      'access-rights',
      { id: role.id, ref: role.code, label: role.name },
      'changed',
      'Access rights changed',
      {
        before: Object.fromEntries(changes.map((c) => [c.label, c.before])),
        after: Object.fromEntries(changes.map((c) => [c.label, c.after])),
        highRisk: true,
      },
    );
    return json(matrixOf(role));
  });

  route('GET', '/api/v1/access/access-rights/options', () =>
    json({
      roles: roles()
        .map((r) => ({ id: r.id, code: r.code, name: r.name, isActive: r.isActive }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      locations: LOCATIONS.map(({ id, code, name }) => ({ id, code, name })),
    } satisfies S['MatrixOptions']),
  );
  route('GET', '/api/v1/access/access-rights/versions', (req) => {
    const page = listRows(all<MatrixVersionRow>(T.versions), req.query, {
      hasActive: false,
      filters: { role: (v, id) => v.roleId === id || v.roleId === null },
      defaultSort: 'versionNo:desc',
    });
    return json({
      ...page,
      items: page.items.map((v) => ({
        versionNo: v.versionNo,
        role: v.roleId ? { id: v.roleId, name: v.roleName ?? '' } : null,
        summary: v.summary,
        changedBy: v.changedBy,
        changedAt: v.changedAt,
      })),
    } satisfies S['MatrixVersionPage']);
  });
  route('GET', '/api/v1/access/access-rights/versions/:versionNo/changes', (req) => {
    const versionNo = Number(req.params.versionNo);
    const version = all<MatrixVersionRow>(T.versions).find((v) => v.versionNo === versionNo);
    if (!version) return notFound('matrix version');
    const roleId = req.query.get('role');
    const earlier = all<MatrixVersionRow>(T.versions)
      .filter((v) => v.versionNo < versionNo && (v.roleId === version.roleId || v.roleId === null))
      .sort((a, b) => b.versionNo - a.versionNo)[0];
    return json({
      from: earlier?.versionNo ?? versionNo - 1,
      to: versionNo,
      changes:
        roleId && version.roleId !== null && version.roleId !== roleId ? [] : version.changes,
    } satisfies S['MatrixChanges']);
  });
  route('GET', '/api/v1/access/access-rights/export', () =>
    csv(
      'access-rights',
      roles().flatMap((role) => {
        const grant = grantOf(role.id);
        return Object.entries(grant.pages).map(([key, list]) => ({
          role: role.name,
          page: MATRIX_PAGES.find((p) => p.key === key)?.label ?? key,
          rights: list.map((r) => RIGHT_LABEL[r]).join('; '),
        }));
      }),
    ),
  );
}

// ---------------------------------------------------------------- delegations and devices

function statusOf(d: DelegationRow): Delegation['status'] {
  if (d.revokedAt) return 'revoked';
  if (Date.parse(d.startsAt) > Date.now()) return 'scheduled';
  if (Date.parse(d.endsAt) < Date.now()) return 'expired';
  return 'active';
}
const delegationView = (d: DelegationRow): Delegation => {
  return { ...omit(d, ['revokedAt']), status: statusOf(d) };
};
const delegationRef = (d: DelegationRow) => ({
  id: d.id,
  ref: d.moduleKeys
    ? d.moduleKeys.map((k) => MODULES.find((m) => m.key === k)?.label ?? k).join(', ')
    : 'All modules',
  label: `${d.delegator.name} → ${d.delegate.name}`,
});

function people(q: string | null, exclude?: string): S['PeopleMatches'] {
  const text = (q ?? '').trim().toLowerCase();
  const items = all<UserRow>(T.users)
    .filter((u) => u.status === 'active' && u.id !== exclude)
    .filter(
      (u) =>
        !text ||
        [u.displayName, u.email, u.personnelNo].some((v) => v.toLowerCase().includes(text)),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 10)
    .map((u) => ({
      userId: u.id,
      name: u.displayName,
      email: u.email,
      organisation: u.organisation,
    }));
  return { items };
}

function createDelegation(delegatorId: string, body: Record<string, unknown>): DelegationRow {
  const delegator = must(all<UserRow>(T.users), delegatorId, 'person');
  const delegateId = required(body.delegateUserId, 'delegateUserId');
  const delegate = find<UserRow>(T.users, delegateId);
  if (!delegate || delegate.status !== 'active')
    return invalid({ delegateUserId: 'Choose an active person' });
  if (delegate.id === delegator.id)
    invalid({ delegateUserId: 'Choose someone other than the delegator' });
  const reason = required(body.reason, 'reason');
  const startsAt = instant(body.startsAt, 'startsAt');
  const endsAt = instant(body.endsAt, 'endsAt');
  if (Date.parse(endsAt) <= Date.parse(startsAt)) invalid({ endsAt: 'Must be after the start' });
  if (Date.parse(endsAt) <= Date.now()) invalid({ endsAt: 'Must be in the future' });
  const moduleKeys = moduleKeysOf(body.moduleKeys);
  const overlap = all<DelegationRow>(T.delegations).some(
    (d) =>
      d.delegator.userId === delegator.id &&
      d.delegate.userId === delegate.id &&
      ['active', 'scheduled'].includes(statusOf(d)) &&
      Date.parse(d.startsAt) < Date.parse(endsAt) &&
      Date.parse(d.endsAt) > Date.parse(startsAt),
  );
  if (overlap)
    throw new MockError(
      409,
      'DELEGATION_OVERLAP',
      `${delegate.displayName} already acts for ${delegator.displayName} in those dates.`,
    );
  const row = insert<DelegationRow>(T.delegations, {
    id: newId(),
    delegator: { userId: delegator.id, name: delegator.displayName },
    delegate: { userId: delegate.id, name: delegate.displayName },
    moduleKeys,
    startsAt,
    endsAt,
    reason,
    revokedReason: null,
    revokedAt: null,
    version: 1,
  });
  record('delegation', delegationRef(row), 'created', 'Delegation created', {
    reason,
    after: delegationView(row),
  });
  return row;
}
function moduleKeysOf(value: unknown): ModuleKey[] | null {
  if (value === null || value === undefined) return null;
  const keys = Array.isArray(value) ? value.map(String) : [];
  if (keys.length === 0 || keys.some((k) => !MODULES.some((m) => m.key === k))) {
    return invalid({ moduleKeys: 'Choose at least one module, or all modules' });
  }
  return keys as ModuleKey[];
}
function revokeDelegation(current: DelegationRow, reason: string): void {
  if (['expired', 'revoked'].includes(statusOf(current))) {
    throw new MockError(409, 'DELEGATION_ENDED', 'This delegation has already ended.');
  }
  const row = replace<DelegationRow>(T.delegations, {
    ...current,
    revokedAt: now(),
    revokedReason: reason,
    version: current.version + 1,
  });
  record('delegation', delegationRef(row), 'revoked', 'Delegation revoked', { reason });
}

const deviceView = (d: DeviceRow): S['AdminDevice'] => {
  return omit(d, ['deviceId', 'revokedAt']);
};
const deviceRef = (d: DeviceRow) => ({
  id: d.id,
  ref: d.platform,
  label: `${d.model ?? d.platform} · ${d.user.name}`,
});

function registerDelegationsAndDevices(): void {
  const list = (query: URLSearchParams) =>
    listRows(all<DelegationRow>(T.delegations).map(delegationView), query, {
      hasActive: false,
      search: (d) => [d.delegator.name, d.delegate.name, d.reason],
      filters: {
        delegator: (d, v) => d.delegator.userId === v,
        delegate: (d, v) => d.delegate.userId === v,
      },
      sorts: { delegator: (d) => d.delegator.name, delegate: (d) => d.delegate.name },
      defaultSort: 'startsAt:desc',
    });
  route('GET', '/api/v1/access/delegations', (req) => json(list(req.query)));
  route('GET', '/api/v1/access/delegations/:id/history', (req) => json(trail(req.params.id ?? '')));
  route('GET', '/api/v1/access/delegations/export', (req) =>
    csv(
      'delegations',
      list(withoutPaging(req.query)).items.map((d) => ({
        delegator: d.delegator.name,
        delegate: d.delegate.name,
        modules: d.moduleKeys?.join('; ') ?? 'All',
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        status: d.status,
        reason: d.reason,
      })),
    ),
  );
  route('GET', '/api/v1/access/delegations/people', (req) => json(people(req.query.get('q'))));
  route('POST', '/api/v1/access/delegations', (req) => {
    requireRight('admin.delegations', 'create');
    const body = bodyOf(req);
    return json(
      delegationView(createDelegation(required(body.delegatorUserId, 'delegatorUserId'), body)),
      201,
    );
  });
  route('PATCH', '/api/v1/access/delegations/:id', (req) => {
    requireRight('admin.delegations', 'edit');
    const current = must(all<DelegationRow>(T.delegations), req.params.id, 'delegation');
    checkVersion(req, current);
    const body = bodyOf(req);
    const reason = required(body.reason, 'reason');
    if (['expired', 'revoked'].includes(statusOf(current))) {
      throw new MockError(409, 'DELEGATION_ENDED', 'This delegation has already ended.');
    }
    const startsAt =
      body.startsAt === undefined ? current.startsAt : instant(body.startsAt, 'startsAt');
    const endsAt = body.endsAt === undefined ? current.endsAt : instant(body.endsAt, 'endsAt');
    if (Date.parse(endsAt) <= Date.parse(startsAt)) invalid({ endsAt: 'Must be after the start' });
    const row = replace<DelegationRow>(T.delegations, {
      ...current,
      moduleKeys:
        body.moduleKeys === undefined ? current.moduleKeys : moduleKeysOf(body.moduleKeys),
      startsAt,
      endsAt,
      version: current.version + 1,
    });
    record('delegation', delegationRef(row), 'changed', 'Delegation changed', {
      reason,
      before: delegationView(current),
      after: delegationView(row),
    });
    return json(delegationView(row));
  });
  route('POST', '/api/v1/access/delegations/:id/revoke', (req) => {
    requireRight('admin.delegations', 'edit');
    const current = must(all<DelegationRow>(T.delegations), req.params.id, 'delegation');
    checkVersion(req, current);
    revokeDelegation(current, required(bodyOf(req).reason, 'reason'));
    return noContent();
  });

  const devices = (query: URLSearchParams) =>
    listRows(all<DeviceRow>(T.devices).map(deviceView), query, {
      hasActive: false,
      search: (d) => [d.user.name, d.user.email, d.model, d.appVersion],
      sorts: { user: (d) => d.user.name, lastSeen: (d) => d.lastSeenAt },
      defaultSort: 'lastSeen:desc',
    });
  route('GET', '/api/v1/access/devices', (req) => json(devices(req.query)));
  route('GET', '/api/v1/access/devices/:id/history', (req) => json(trail(req.params.id ?? '')));
  route('GET', '/api/v1/access/devices/export', (req) =>
    csv(
      'devices',
      devices(withoutPaging(req.query)).items.map((d) => ({
        user: d.user.name,
        email: d.user.email,
        platform: d.platform,
        model: d.model,
        osVersion: d.osVersion,
        appVersion: d.appVersion,
        status: d.status,
        lastSeenAt: d.lastSeenAt,
      })),
    ),
  );
  for (const [action, status] of [
    ['block', 'blocked'],
    ['unblock', 'active'],
  ] as const) {
    route('POST', `/api/v1/access/devices/:id/${action}`, (req) => {
      requireRight('admin.devices', 'edit');
      const current = must(all<DeviceRow>(T.devices), req.params.id, 'device');
      checkVersion(req, current);
      const reason = required(bodyOf(req).reason, 'reason');
      if ((current.status === 'blocked') === (status === 'blocked')) {
        throw new MockError(
          409,
          'ALREADY_IN_STATE',
          `The device is ${current.status === 'blocked' ? 'already blocked' : 'not blocked'}.`,
        );
      }
      const row = replace<DeviceRow>(T.devices, {
        ...current,
        status: status === 'blocked' ? 'blocked' : current.revokedAt ? 'revoked' : 'active',
        blockedReason: status === 'blocked' ? reason : null,
        pushEnabled: status === 'blocked' ? false : current.pushEnabled,
        version: current.version + 1,
      });
      record(
        'device',
        deviceRef(row),
        status === 'blocked' ? 'blocked' : 'unblocked',
        status === 'blocked' ? 'Device blocked' : 'Device unblocked',
        { reason },
      );
      return json(deviceView(row));
    });
  }
}

// ---------------------------------------------------------------- my account

function registerAccount(): void {
  route('GET', '/api/v1/me/delegations', () => {
    const id = me().id;
    const rows = all<DelegationRow>(T.delegations).map(delegationView);
    return json({
      given: rows.filter((d) => d.delegator.userId === id),
      received: rows.filter((d) => d.delegate.userId === id),
    } satisfies S['MyDelegations']);
  });
  route('POST', '/api/v1/me/delegations', (req) =>
    json(delegationView(createDelegation(me().id, bodyOf(req))), 201),
  );
  route('DELETE', '/api/v1/me/delegations/:id', (req) => {
    const current = must(all<DelegationRow>(T.delegations), req.params.id, 'delegation');
    if (current.delegator.userId !== me().id) return notFound('delegation');
    revokeDelegation(current, 'Cancelled by the delegator');
    return noContent();
  });
  route('GET', '/api/v1/me/people', (req) => json(people(req.query.get('q'), me().id)));

  route('GET', '/api/v1/me/devices', () => {
    const id = me().id;
    const items: S['Device'][] = all<DeviceRow>(T.devices)
      .filter((d) => d.user.id === id && d.status !== 'blocked')
      .map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        platform: d.platform,
        model: d.model,
        osVersion: d.osVersion,
        appVersion: d.appVersion,
        pushEnabled: d.pushEnabled,
        registeredAt: d.registeredAt,
        lastSeenAt: d.lastSeenAt,
        revokedAt: d.revokedAt,
        revokedReason: d.revokedReason,
        current: false,
      }));
    return json({ items });
  });
  route('DELETE', '/api/v1/me/devices/:id', (req) => {
    const current = must(all<DeviceRow>(T.devices), req.params.id, 'device');
    if (current.user.id !== me().id) return notFound('device');
    if (current.status !== 'active')
      throw new MockError(409, 'ALREADY_IN_STATE', 'This device is already signed out.');
    const row = replace<DeviceRow>(T.devices, {
      ...current,
      status: 'revoked',
      revokedAt: now(),
      revokedReason: 'Signed out by the user',
      pushEnabled: false,
      version: current.version + 1,
    });
    record('device', deviceRef(row), 'revoked', 'Device signed out', {
      reason: 'Signed out by the user',
    });
    return noContent();
  });

  const prefsOf = (userId: string) =>
    find<PreferenceRow>(T.preferences, userId) ?? defaultPreferences(userId);
  route('GET', '/api/v1/me/notification-preferences', () =>
    json({ categories: prefsOf(me().id).categories }),
  );
  route('PUT', '/api/v1/me/notification-preferences', (req) => {
    const user = me();
    const current = prefsOf(user.id);
    const sent = bodyOf(req).categories;
    if (!Array.isArray(sent)) return invalid({ categories: 'Required' });
    const errors: Record<string, string> = {};
    const categories = current.categories.map((c) => {
      const change = (sent as { key?: unknown; channels?: Record<string, unknown> }[]).find(
        (s) => s.key === c.key,
      );
      if (!change) return c;
      const pickBool = (name: 'email' | 'sms' | 'push') =>
        typeof change.channels?.[name] === 'boolean' ? change.channels[name] : c.channels[name];
      const channels = { email: pickBool('email'), sms: pickBool('sms'), push: pickBool('push') };
      if (c.mandatory && !channels.email)
        errors[`categories.${c.key}`] = `${c.label} emails cannot be turned off`;
      return { ...c, channels };
    });
    for (const s of sent as { key?: unknown }[]) {
      if (!PREFERENCE_CATEGORIES.some((c) => c.key === s.key))
        errors.categories = `Unknown category ${String(s.key)}`;
    }
    if (Object.keys(errors).length > 0) invalid(errors);
    const row: PreferenceRow = { id: user.id, categories };
    if (find<PreferenceRow>(T.preferences, user.id)) replace<PreferenceRow>(T.preferences, row);
    else insert<PreferenceRow>(T.preferences, row);
    record(
      'notification-preferences',
      { id: user.id, ref: user.personnelNo, label: user.displayName },
      'changed',
      'Notification preferences changed',
      {
        before: current.categories.map((c) => ({ [c.key]: c.channels })),
        after: categories.map((c) => ({ [c.key]: c.channels })),
      },
    );
    return json({ categories });
  });
}

// ---------------------------------------------------------------- notifications

function registerNotifications(): void {
  const mine = () => {
    const id = me().id;
    return all<NotificationRow>(T.notifications)
      .filter((n) => n.userId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };
  const view = (n: NotificationRow): S['NotificationItem'] => {
    return omit(n, ['userId']);
  };
  route('GET', '/api/v1/notifications', (req) => {
    const q = req.query;
    const kind = q.get('tab') === 'emails' ? 'email' : q.get('tab') === 'alerts' ? 'alert' : null;
    const ofTab = mine().filter((n) => kind === null || n.kind === kind);
    const rows = ofTab
      .filter((n) => !q.get('category') || n.category === q.get('category'))
      .filter((n) => q.get('unread') !== 'true' || !n.read);
    const start = Number(q.get('cursor') ?? 0) || 0;
    const limit = Math.min(Number(q.get('limit') ?? 20) || 20, 100);
    const next = start + limit < rows.length ? String(start + limit) : null;
    return json({
      items: rows.slice(start, start + limit).map(view),
      nextCursor: next,
      unreadCount: ofTab.filter((n) => !n.read).length,
    } satisfies S['NotificationPage']);
  });
  route('PATCH', '/api/v1/notifications/:id', (req) => {
    const row = mine().find((n) => n.id === req.params.id);
    if (!row) return notFound('notification');
    if (bodyOf(req).read !== true) return invalid({ read: 'Only marking as read is supported' });
    replace<NotificationRow>(T.notifications, { ...row, read: true });
    return noContent();
  });
  route('POST', '/api/v1/notifications/read-all', () => {
    for (const row of mine().filter((n) => !n.read))
      replace<NotificationRow>(T.notifications, { ...row, read: true });
    return noContent();
  });
}

// ---------------------------------------------------------------- audit log

interface AuditFilter {
  q?: string | null;
  module?: string | null;
  actionType?: string | null;
  actorUserId?: string | null;
  referenceId?: string | null;
  outcome?: string | null;
  from?: string | null;
  to?: string | null;
}
function auditRows(f: AuditFilter): AuditEvent[] {
  const text = f.q?.trim().toLowerCase();
  const from = f.from ? Date.parse(f.from) : null;
  const to = f.to ? Date.parse(f.to) : null;
  return [...all<AuditEvent>(T.audit)]
    .filter((e) => !f.module || e.module === f.module)
    .filter((e) => !f.actionType || e.actionType === f.actionType)
    .filter(
      (e) =>
        !f.actorUserId ||
        e.actor.userId === f.actorUserId ||
        e.actor.onBehalfOf?.userId === f.actorUserId,
    )
    .filter(
      (e) =>
        !f.referenceId || (e.referenceId ?? '').toLowerCase().includes(f.referenceId.toLowerCase()),
    )
    .filter((e) => !f.outcome || e.outcome === f.outcome)
    .filter((e) => from === null || Date.parse(e.occurredAt) >= from)
    .filter((e) => to === null || Date.parse(e.occurredAt) <= to)
    .filter(
      (e) =>
        !text ||
        [
          e.actionLabel,
          e.actionType,
          e.record.ref,
          e.record.label,
          e.actor.label,
          e.referenceId,
          e.reason,
        ].some((v) => v?.toLowerCase().includes(text)),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
const auditFilter = (q: URLSearchParams): AuditFilter => ({
  q: q.get('q'),
  module: q.get('module'),
  actionType: q.get('actionType'),
  actorUserId: q.get('actorUserId'),
  referenceId: q.get('referenceId'),
  outcome: q.get('outcome'),
  from: q.get('from'),
  to: q.get('to'),
});

function registerAuditLog(): void {
  route('GET', '/api/v1/audit-log', (req) => {
    requireRight('admin.audit-log', 'view');
    const rows = auditRows(auditFilter(req.query));
    const start = Number(req.query.get('cursor') ?? 0) || 0;
    const limit = Math.min(Number(req.query.get('limit') ?? 100) || 100, 500);
    return json({
      items: rows.slice(start, start + limit),
      nextCursor: start + limit < rows.length ? String(start + limit) : null,
    } satisfies S['AuditPage']);
  });
  route('GET', '/api/v1/audit-log/summary', (req) => {
    const rows = auditRows(auditFilter(req.query));
    return json({
      entries: rows.length,
      held: all<AuditEvent>(T.audit).length,
      people: new Set(rows.map((e) => e.actor.userId ?? e.actor.label)).size,
      modules: new Set(rows.map((e) => e.module)).size,
      withChange: rows.filter((e) => e.before !== undefined || e.after !== undefined).length,
      retentionYears: 7,
    } satisfies S['AuditSummary']);
  });
  route('GET', '/api/v1/audit-log/facets', () => {
    const events = all<AuditEvent>(T.audit);
    const actionTypes = new Map<string, { key: string; label: string; module: string }>();
    for (const e of events) {
      if (!actionTypes.has(e.actionType))
        actionTypes.set(e.actionType, {
          key: e.actionType,
          label: e.actionLabel,
          module: e.module,
        });
    }
    const present = new Set(events.map((e) => e.module));
    return json({
      modules: MODULES.map((m) => m.key as string).filter((k) => present.has(k)),
      actionTypes: [...actionTypes.values()].sort((a, b) => a.label.localeCompare(b.label)),
    } satisfies S['AuditFacets']);
  });
  route('GET', '/api/v1/audit-log/retention', () =>
    json({
      auditYears: 7,
      recordsKept: true,
      outboxDays: 90,
      syncKeyDays: 400,
    } satisfies S['AuditRetention']),
  );
  route('GET', '/api/v1/audit-log/export', (req) =>
    csv(
      'audit-log',
      auditRows(auditFilter(req.query)).map((e) => ({
        occurredAt: e.occurredAt,
        module: e.module,
        action: e.actionLabel,
        record: [e.record.ref, e.record.label].filter(Boolean).join(' · '),
        who: e.actor.label,
        onBehalfOf: e.actor.onBehalfOf?.label ?? '',
        outcome: e.outcome,
        reason: e.reason,
        referenceId: e.referenceId,
      })),
    ),
  );
}

// ---------------------------------------------------------------- support

function registerSupport(): void {
  const articleFields = (body: Record<string, unknown>) => {
    const sent = body.kind;
    const kind: SupportArticle['kind'] =
      sent === 'faq' || sent === 'guide' ? sent : invalid({ kind: 'Choose FAQ or guide' });
    const sortOrder = body.sortOrder;
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0) {
      return invalid({ sortOrder: 'Enter a whole number' });
    }
    return {
      kind,
      title: required(body.title, 'title'),
      body: required(body.body, 'body'),
      sortOrder,
    };
  };
  masterCrud<SupportArticle>('/api/v1/support-articles', T.articles, 'support article', {
    search: (a) => [a.code, a.title, a.body],
    sorts: { title: (a) => a.title },
    defaultSort: 'sortOrder:asc',
    describe: (a) => ({ ref: a.code, label: a.title }),
    create: (body) => {
      requireRight('admin.support-articles', 'create');
      return {
        code: required(body.code, 'code').toUpperCase(),
        ...articleFields(body),
        deactivatedReason: null,
      };
    },
    update: (current, body) => ({ ...current, ...articleFields(body) }),
  });
  route('PUT', '/api/v1/support-articles/:id', (req) => {
    requireRight('admin.support-articles', 'edit');
    const current = must(all<SupportArticle>(T.articles), req.params.id, 'support article');
    checkVersion(req, current);
    const row = replace<SupportArticle>(T.articles, {
      ...current,
      ...articleFields(bodyOf(req)),
      version: current.version + 1,
      updatedAt: now(),
    });
    record(
      'support-article',
      { id: row.id, ref: row.code, label: row.title },
      'changed',
      'Support article changed',
      {
        before: current,
        after: row,
      },
    );
    return json(row);
  });
  route('GET', '/api/v1/support-articles/export', (req) =>
    csv(
      'support-articles',
      listRows(all<SupportArticle>(T.articles), withoutPaging(req.query), {
        search: (a) => [a.code, a.title],
      }).items.map((a) => ({
        code: a.code,
        kind: a.kind,
        title: a.title,
        sortOrder: a.sortOrder,
        active: a.isActive,
      })),
    ),
  );

  route('GET', '/api/v1/support', () => {
    const articles = all<SupportArticle>(T.articles)
      .filter((a) => a.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const pickArticles = (kind: SupportArticle['kind']) =>
      articles
        .filter((a) => a.kind === kind)
        .map((a) => ({ id: a.id, title: a.title, body: a.body }));
    return json({
      portalUrl: 'https://servicedesk.masar.example/masar',
      contacts: LOCATION_SEEDS.flatMap((l) =>
        l.focalPoint
          ? [{ code: l.code, location: l.name, name: l.focalPoint.name, email: l.focalPoint.email }]
          : [],
      ),
      faqs: pickArticles('faq'),
      guides: pickArticles('guide'),
    } satisfies S['Support']);
  });
}

// ---------------------------------------------------------------- home and search

const MODE_LABEL: Record<string, string> = {
  'fixed-wing': 'Fixed wing',
  'rotary-wing': 'Helicopter',
  ferry: 'Ferry',
  'crew-boat': 'Crew boat',
};
const placeName = (code: string) => LOCATION_SEEDS.find((l) => l.code === code)?.name ?? code;

/** Today's flights and voyages, from the recurring schedules that run on this GST weekday. */
function todaysJourneys() {
  const today = gstDate();
  const weekday = new Date(`${today}T12:00:00+04:00`).getUTCDay() || 7;
  return SCHEDULE_SEEDS.filter(
    (s) => s.days.includes(weekday) && s.validFromDays <= 0 && (s.validToDays ?? 0) >= 0,
  )
    .map((s) => {
      const r = ROUTE_SEEDS.find((x) => x.code === s.route);
      const path = (r?.points ?? []).map(placeName).join(' → ');
      const [h, m] = (s.departureTime ?? '').split(':').map(Number);
      const at = s.departureTime ? gstAt(0, h ?? 0, m ?? 0) : null;
      const minutes = at ? (Date.now() - Date.parse(at)) / 60_000 : -Infinity;
      const duration = r?.durationMinutes ?? 60;
      const status =
        minutes > duration
          ? 'arrived'
          : minutes >= 0
            ? 'departed'
            : minutes >= -45
              ? 'boarding'
              : 'scheduled';
      return { s, path, at, status, id: `${s.flightNumber}-${today}` };
    })
    .sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'));
}

const TONE: Record<string, S['HomeWidget']['tone']> = {
  scheduled: 'neutral',
  boarding: 'warning',
  departed: 'info',
  arrived: 'success',
  succeeded: 'success',
  partial: 'warning',
  failed: 'danger',
  running: 'info',
};

function approvalsWidget(personaKey: string): S['HomeWidget'] {
  const item = (
    id: string,
    title: string,
    detail: string,
    at: string,
    overdue: boolean,
    link: string | null,
  ) => ({
    id: id,
    title,
    detail,
    at,
    tone: overdue ? ('danger' as const) : null,
    status: overdue ? 'overdue' : null,
    link,
  });
  const byPersona: Record<string, S['HomeWidget']['items']> = {
    admin: [
      item(
        'apr-1',
        'RC-REQ-0031 · Weather hold – fog',
        'Reason code request · Dispatch Power User',
        gstAt(-1, 17),
        true,
        '/admin/reason-codes',
      ),
      item(
        'apr-2',
        'LB-DAS-04 · Lifeboat capacity change',
        'POB master change · Latifa Al Mazrouei',
        gstAt(1, 12),
        false,
        '/admin/pending-changes',
      ),
      item(
        'apr-3',
        'ASP-2026-04 · Falcon Aviation annual audit',
        'ASP audit sign-off · Sara Al Hashemi · for Majid Al Falasi',
        gstAt(2, 17),
        false,
        null,
      ),
    ],
    planner: [
      item(
        'apr-4',
        'BK-2026-018361 · Rahul Menon · AUH → DAS',
        'Booking approval · Saeed Al Kaabi',
        gstAt(0, 9),
        true,
        '/booking/approvals',
      ),
      item(
        'apr-5',
        'BK-2026-018355 · Hessa Al Ketbi · AUH → UZ',
        'Booking approval · Saeed Al Kaabi',
        gstAt(0, 18),
        false,
        '/booking/approvals',
      ),
      item(
        'apr-6',
        'QO-2026-0088 · Das Island contractor quota',
        'Quota override · Aisha Al Qubaisi',
        gstAt(1, 10),
        false,
        '/booking/approvals',
      ),
    ],
  };
  const items = byPersona[personaKey] ?? [];
  const overdue = items.filter((i) => i.status === 'overdue').length;
  return {
    key: 'approvals.waiting',
    kind: 'list',
    value: items.length,
    params: { overdue },
    tone: overdue > 0 ? 'danger' : items.length > 0 ? 'warning' : 'success',
    link: null,
    items,
    failed: false,
  };
}

function homeWidgets(): S['HomeWidget'][] {
  const persona = currentPersona();
  if (!persona) throw new MockError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const widgets: S['HomeWidget'][] = [approvalsWidget(persona.key)];

  if (can('scheduling.dashboard')) {
    const journeys = todaysJourneys();
    widgets.push({
      key: 'scheduling.today',
      kind: 'list',
      value: journeys.length,
      params: { withoutTime: journeys.filter((j) => j.at === null).length },
      tone: journeys.some((j) => j.at === null) ? 'warning' : 'info',
      link: '/scheduling',
      items: journeys.slice(0, 6).map((j) => ({
        id: j.id,
        title: `${j.s.flightNumber} · ${j.path}`,
        detail: `${MODE_LABEL[j.s.mode] ?? j.s.mode} · ${j.s.fleet}`,
        at: j.at,
        tone: TONE[j.status] ?? 'neutral',
        status: j.status,
        link: '/scheduling',
      })),
      failed: false,
    });
  }

  const mine = all<DelegationRow>(T.delegations).map(delegationView);
  const live = (list: Delegation[]) => list.filter((d) => d.status === 'active').length;
  const given = mine.filter((d) => d.delegator.userId === persona.me.id);
  const received = mine.filter((d) => d.delegate.userId === persona.me.id);
  widgets.push({
    key: 'delegations.mine',
    kind: 'stat',
    value: live(received),
    params: {
      given: live(given),
      scheduled: [...given, ...received].filter((d) => d.status === 'scheduled').length,
    },
    tone: live(received) > 0 ? 'info' : null,
    link: '/account',
    items: [],
    failed: false,
  });

  if (can('admin.users')) {
    const summaries = all<UserRow>(T.users)
      .filter((u) => u.status !== 'deactivated')
      .map(summaryOf);
    const expiring = summaries.filter((u) => u.roles.some((r) => expiresSoon(r.validUntil))).length;
    widgets.push({
      key: 'access.expiring',
      kind: 'stat',
      value: expiring,
      params: { withoutRoles: summaries.filter((u) => u.roles.length === 0).length },
      tone: expiring > 0 ? 'warning' : 'success',
      link: '/admin/users?filter[access]=expiring',
      items: [],
      failed: false,
    });
    settleSyncRuns();
    const runs = latestRuns();
    const items = (['sap', 'fieldglass', 'hse_passport'] as const).map((adapter) => {
      const run = runs.find((r) => r.adapter === adapter);
      return {
        id: adapter,
        title: SYNC_LABEL[adapter],
        detail: run?.error ?? null,
        at: run?.finishedAt ?? run?.startedAt ?? null,
        tone: run ? (TONE[run.status] ?? 'neutral') : ('neutral' as const),
        status: run?.status ?? 'never',
        link: '/admin/users',
      };
    });
    const failing = items.filter((i) => i.status === 'failed' || i.status === 'partial').length;
    widgets.push({
      key: 'sync.health',
      kind: 'list',
      value: failing,
      params: {},
      tone: items.some((i) => i.status === 'failed')
        ? 'danger'
        : failing > 0
          ? 'warning'
          : 'success',
      link: '/admin/users',
      items,
      failed: false,
    });
  }
  return widgets;
}

function search(q: string): S['SearchResults'] {
  const text = q.trim().toLowerCase();
  const groups: S['SearchResults']['groups'] = [];
  const add = (key: string, link: string, hits: S['SearchResults']['groups'][number]['items']) => {
    if (hits.length > 0) groups.push({ key, items: hits.slice(0, 5), more: hits.length > 5, link });
  };
  const has = (...values: (string | null | undefined)[]) =>
    values.some((v) => v?.toLowerCase().includes(text));
  const enc = encodeURIComponent;

  if (can('admin.users')) {
    add(
      'people',
      `/admin/users?q=${enc(q)}`,
      all<UserRow>(T.users)
        .filter((u) => has(u.displayName, u.email, u.personnelNo, u.person.hsePassportNo))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((u) => ({
          id: u.id,
          title: u.displayName,
          detail: [u.personnelNo, u.person.designation, u.organisation].filter(Boolean).join(' · '),
          link: `/admin/users?q=${enc(u.email)}`,
        })),
    );
  }
  if (can('admin.locations')) {
    add(
      'locations',
      `/admin/locations?q=${enc(q)}`,
      LOCATION_SEEDS.filter((l) => has(l.code, l.name)).map((l) => ({
        id: LOCATIONS.find((x) => x.code === l.code)?.id ?? l.code,
        title: `${l.code} · ${l.name}`,
        detail: `${l.type.charAt(0)}${l.type.slice(1).toLowerCase()} · ${ZONES.find((z) => z.code === l.zone)?.name ?? l.zone}`,
        link: `/admin/locations?q=${enc(l.code)}&includeDeactivated=true`,
      })),
    );
  }
  if (can('admin.installations')) {
    add(
      'installations',
      `/admin/installations?q=${enc(q)}`,
      INSTALLATION_SEEDS.filter((i) => has(i.code, i.name)).map((i) => ({
        id: i.code,
        title: `${i.code} · ${i.name}`,
        detail: `${i.type.charAt(0)}${i.type.slice(1).toLowerCase()} · ${placeName(i.location)}`,
        link: `/admin/installations?q=${enc(i.code)}&includeDeactivated=true`,
      })),
    );
  }
  if (can('scheduling.dashboard')) {
    add(
      'journeys',
      `/scheduling?q=${enc(q)}`,
      todaysJourneys()
        .filter((j) => has(j.s.flightNumber, j.s.name))
        .map((j) => ({
          id: j.id,
          title: `${j.s.flightNumber} · ${j.path}`,
          detail: [gstDate(), j.s.departureTime, MODE_LABEL[j.s.mode]].filter(Boolean).join(' · '),
          link: '/scheduling',
        })),
    );
  }
  return { q, groups };
}

function registerShell(): void {
  route('GET', '/api/v1/home', () =>
    json({ today: gstDate(), widgets: homeWidgets() } satisfies S['Home']),
  );
  route('GET', '/api/v1/search', (req) => {
    me();
    const q = (req.query.get('q') ?? '').trim();
    if (q.length < 2) return invalid({ q: 'Type at least two characters' });
    return json(search(q));
  });
}

/** Access control, governance, the shell (home, search, notifications), support and my account. */
export function registerPlatform(): void {
  seed(T.users, userSeeds);
  seed(T.assignments, assignmentSeeds);
  seed(T.roles, roleSeeds);
  seed(T.grants, grantSeeds);
  seed(T.versions, matrixVersionSeeds);
  seed(T.delegations, delegationSeeds);
  seed(T.devices, deviceSeeds);
  seed(T.syncRuns, syncRunSeeds);
  seed(T.audit, auditSeeds);
  seed(T.notifications, notificationSeeds);
  seed(T.articles, supportArticleSeeds);

  registerUsers();
  registerSync();
  registerRoles();
  registerMatrix();
  registerDelegationsAndDevices();
  registerAccount();
  registerNotifications();
  registerAuditLog();
  registerSupport();
  registerShell();
}
