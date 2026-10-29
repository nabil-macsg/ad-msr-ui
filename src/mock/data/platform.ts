/**
 * Seed data for the platform area: users and their roles, the role catalogue and its default
 * access rights, delegations, devices, source-system sync runs, the audit history,
 * notifications and support articles. Dates are relative to the demo's first load, so the
 * screens stay current.
 */
import type { components } from '../../api/schema';
import {
  CAPABILITIES,
  MODULES,
  PAGES,
  type ModuleKey,
  type Right,
} from '../../api/registry.generated';
import { PERSONAS } from '../demo-auth';
import { gstDate, idFor, SEEDED_AT } from './ids';
import companySeeds from './seeds/companies.json';
import departmentSeeds from './seeds/departments.json';
import installationSeeds from './seeds/installations.json';
import locationSeeds from './seeds/locations.json';
import personaSeeds from './seeds/personas.json';
import scheduleSeeds from './seeds/recurring-schedules.json';
import routeSeeds from './seeds/routes.json';
import providerSeeds from './seeds/service-providers.json';
import zoneSeeds from './seeds/zones.json';

type S = components['schemas'];
export type Role = S['Role'];
export type ScopeSummary = S['ScopeSummary'];
export type RoleScopeLevel = Role['scopeLevel'];
export type AuditEvent = S['AuditEvent'];
export type SupportArticle = S['SupportArticle'];
export type NotificationCategory = S['NotificationPreferences']['categories'][number]['key'];

/** A user as stored; roles, access-until and assignments are derived from `role-assignments`. */
export type UserRow = Omit<S['UserDetail'], 'roles' | 'accessUntil' | 'assignments' | 'isSelf'>;
/** A role assignment as stored; its state is worked out from its dates when read. */
export type AssignmentRow = Omit<S['RoleAssignment'], 'state'> & { userId: string };
/** One role's grants on the Access Rights Matrix (id = role id). */
export interface GrantRow {
  id: string;
  version: number;
  modules: Partial<Record<ModuleKey, boolean>>;
  pages: Record<string, Right[]>;
  capabilities: { key: string; locationIds: string[] | null }[];
}
export interface MatrixVersionRow {
  id: string;
  versionNo: number;
  roleId: string | null;
  roleName: string | null;
  summary: string;
  changedBy: string | null;
  changedAt: string;
  changes: S['MatrixChanges']['changes'];
}
/** A delegation as stored; its status is worked out from its dates unless revoked. */
export type DelegationRow = Omit<S['Delegation'], 'status'> & { revokedAt: string | null };
export type DeviceRow = S['AdminDevice'] & { deviceId: string; revokedAt: string | null };
export type NotificationRow = S['NotificationItem'] & { userId: string };
export interface PreferenceRow {
  id: string;
  categories: S['NotificationPreferences']['categories'];
}
export type SyncRunRow = S['SyncRun'] & { errors: S['SyncRunErrors']['items'] };

// ---------------------------------------------------------------- time helpers

const HOUR = 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');
/** A GST wall-clock time `offsetDays` from today, as an instant. */
export const gstAt = (offsetDays: number, hour: number, minute = 0): string =>
  new Date(`${gstDate(offsetDays)}T${pad(hour)}:${pad(minute)}:00+04:00`).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

/** A small stable number from text, for spreading seeded values. */
function spread(text: string, mod: number): number {
  let h = 7;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % mod;
}

// ---------------------------------------------------------------- reference lists

type Ref = { id: string; code: string; name: string };
export const ZONES: Ref[] = zoneSeeds.map((z) => ({
  id: idFor('zone', z.code),
  code: z.code,
  name: z.name,
}));
export const LOCATIONS: (Ref & { zoneId: string })[] = locationSeeds.map((l) => ({
  id: idFor('location', l.code),
  code: l.code,
  name: l.name,
  zoneId: idFor('zone', l.zone),
}));
export const PROVIDERS: Ref[] = providerSeeds.map((p) => ({
  id: idFor('service-provider', p.code),
  code: p.code,
  name: p.legalName,
}));
export const DEPARTMENTS: Ref[] = departmentSeeds.map((d) => ({
  id: idFor('department', d.code),
  code: d.code,
  name: d.name,
}));
export const MODULE_OPTIONS = MODULES.map((m) => ({ key: m.key, label: m.label }));
export const LOCATION_SEEDS = locationSeeds;
export const INSTALLATION_SEEDS = installationSeeds;
export const SCHEDULE_SEEDS = scheduleSeeds;
export const ROUTE_SEEDS = routeSeeds;

const companyName = (code: string | null) =>
  companySeeds.find((c) => c.code === code)?.name ?? code;
const departmentName = (code: string | null) =>
  departmentSeeds.find((d) => d.code === code)?.name ?? code;
const pick = (list: Ref[], codes: readonly string[] | undefined) =>
  (codes ?? []).flatMap((code) => {
    const found = list.find((r) => r.code === code);
    return found ? [{ id: found.id, code: found.code, name: found.name }] : [];
  });

export const EMPTY_SCOPE: ScopeSummary = {
  allLocations: false,
  zones: [],
  locations: [],
  serviceProvider: null,
  departments: [],
  moduleKeys: null,
  self: false,
  lineManagerOf: false,
};

interface SeedScope {
  allLocations?: boolean;
  zoneIds?: string[];
  locationIds?: string[];
  serviceProviderId?: string;
  departmentIds?: string[];
  self?: boolean;
  lineManagerOf?: boolean;
}

/** A persona's scope (written with codes) as the API's scope summary. */
function scopeOf(scope: SeedScope): ScopeSummary {
  const provider = scope.serviceProviderId
    ? pick(PROVIDERS, [scope.serviceProviderId])[0]
    : undefined;
  return {
    ...EMPTY_SCOPE,
    allLocations: scope.allLocations === true,
    zones: pick(ZONES, scope.zoneIds),
    locations: pick(LOCATIONS, scope.locationIds),
    serviceProvider: provider ?? null,
    departments: pick(DEPARTMENTS, scope.departmentIds),
    self: scope.self === true,
    lineManagerOf: scope.lineManagerOf === true,
  };
}

// ---------------------------------------------------------------- roles

type Channels = 'web' | 'app' | 'both';
type RoleFlags = { max?: number; locked?: boolean; adminTier?: boolean; external?: boolean };
type RoleSpec = [string, string, string, Role['type'], RoleScopeLevel, Channels, RoleFlags?];

/** The role catalogue (BRD D.2.1.2); codes are permanent. */
const ROLE_SPECS: RoleSpec[] = [
  [
    'super-admin',
    'Super Admin',
    'Administers the platform, its masters and its access. Admin tier.',
    'system',
    'platform',
    'web',
    { max: 5, locked: true, adminTier: true },
  ],
  [
    'master-data-power-user',
    'Master Data Power User',
    'Keeps the shared masters correct.',
    'system',
    'platform',
    'web',
    { locked: true },
  ],
  [
    'admin-user',
    'Admin User',
    'Administers the platform alongside the Super Admin, with the rights set on the matrix.',
    'system',
    'platform',
    'web',
    { locked: true },
  ],
  [
    'module-power-user',
    'Module Power User',
    'Runs a module for their own area.',
    'module',
    'zone',
    'web',
    { locked: true },
  ],
  [
    'module-admin',
    'Module Admin',
    "Administers a module's own setup.",
    'module',
    'platform',
    'web',
    { locked: true },
  ],
  [
    'end-user',
    'End User',
    'Uses MASAR for their own work.',
    'end_user',
    'self',
    'both',
    { locked: true },
  ],
  [
    'external-user',
    'External User',
    'Someone outside ADNOC using MASAR for their own organisation. External.',
    'end_user',
    'provider',
    'web',
    { locked: true, external: true },
  ],
  [
    'viewer',
    'Master Data Viewer',
    'Sees every screen and master for reference, without changing anything.',
    'end_user',
    'platform',
    'web',
  ],
  [
    'pl-power-user',
    'People Logistics Power User',
    'Runs the daily operation across booking and dispatch.',
    'module',
    'zone',
    'web',
  ],
  [
    'aviation-team',
    'Aviation Team',
    'Plans air and marine movement, builds and confirms manifests, overrides quotas.',
    'module',
    'platform',
    'web',
  ],
  [
    'line-manager',
    'Line Manager',
    'Approves travel raised by their own people (Level 1).',
    'end_user',
    'self',
    'both',
  ],
  [
    'site-in-charge',
    'Site In-charge',
    'Holds a destination site; second-level approver for travel and accommodation; signs off muster reconciliation.',
    'end_user',
    'site',
    'both',
  ],
  [
    'focal-point',
    'Focal Point',
    "Holds a site's logistics: freight approvals, HEMS, people on board, manual entries.",
    'end_user',
    'site',
    'web',
  ],
  [
    'dispatch-team',
    'Dispatch Team',
    'Opens and runs departures at a terminal or hub. Offload and reopen as granted per location.',
    'end_user',
    'site',
    'web',
  ],
  [
    'checkin-staff',
    'Check-in Staff',
    'Works the check-in kiosk and counter: seat, weight, bags, tags, boarding card.',
    'end_user',
    'site',
    'web',
  ],
  ['passenger', 'Passenger', 'Raises and follows their own travel.', 'end_user', 'self', 'both'],
  [
    'service-provider',
    'Service Provider',
    'An operator, seeing only their own resources and journeys: status, delays, load sheets. External.',
    'end_user',
    'provider',
    'web',
    { external: true },
  ],
  [
    'flight-crew',
    'Flight Crew',
    "A provider's pilot or crew, completing the digital flight log. External.",
    'end_user',
    'provider',
    'app',
    { external: true },
  ],
  [
    'fuel-operator',
    'Fuel Operator',
    'Records fuel receipts and fuelings at a station.',
    'end_user',
    'site',
    'web',
  ],
  [
    'vessel-focal-point',
    'Vessel Focal Point',
    "Keeps a vessel's crew list and who is aboard.",
    'end_user',
    'site',
    'web',
  ],
  [
    'muster-coordinator',
    'Muster Coordinator',
    'Records headcounts and ticks people off at a muster point.',
    'end_user',
    'site',
    'both',
  ],
  [
    'pob-master-data-power-user',
    'POB Master Data Power User',
    'Maintains designation-to-site essential mapping, muster points and lifeboats (with a second approver).',
    'module',
    'site',
    'web',
  ],
  [
    'executive',
    'Executive',
    'Oversees the operation through dashboards and reports.',
    'end_user',
    'platform',
    'web',
  ],
  [
    'site-focal-point-helideck',
    'Site Focal Point (Helideck)',
    'Raises helideck requests, confirms readiness, requests dispensation, keeps the document library.',
    'end_user',
    'site',
    'web',
  ],
  [
    'site-team',
    'Site Team',
    'Closes the corrective actions raised against their own installation, with evidence.',
    'end_user',
    'site',
    'web',
  ],
  [
    'inspection-team-poc',
    'Inspection Team POC',
    'Aviation Technical point of contact for a zone. Validates requests, assigns inspectors, reviews closures.',
    'end_user',
    'zone',
    'web',
  ],
  [
    'helideck-inspector',
    'Helideck Inspector',
    'Carries out inspections, tests and crew assessments.',
    'end_user',
    'zone',
    'both',
  ],
  [
    'helideck-inspector-lead',
    'Helideck Inspector Lead',
    'Quality-checks inspections and tests before they go to the POC.',
    'end_user',
    'platform',
    'web',
  ],
  [
    'tl-ats',
    'TL ATS',
    'Team Leader, Aviation Technical. Second approval on helideck requests.',
    'end_user',
    'platform',
    'both',
    { max: 2 },
  ],
  [
    'mosa',
    'MOSA',
    'Manager, Aviation Technical. Final approval on helideck requests.',
    'end_user',
    'platform',
    'both',
    { max: 1 },
  ],
  [
    'aviation-technical-team',
    'Aviation Technical Team',
    'Owns the annual plan, the HLL and helideck master data, and initiates letters in E-Correspondence.',
    'module',
    'platform',
    'web',
  ],
  [
    'third-party-inspector',
    'Third-party Inspector',
    'An external test provider submitting friction or drop test results. External.',
    'end_user',
    'provider',
    'web',
    { external: true },
  ],
  [
    'compliance-admin',
    'Compliance Admin',
    'Owns the ASP annual audit master plan and compiles audit reports.',
    'module',
    'platform',
    'web',
  ],
  [
    'department-focal-point',
    'Department Focal Point',
    "Leads a department's part of an ASP audit (HSE, Operations, Maintenance, Quality).",
    'end_user',
    'department',
    'web',
  ],
  [
    'auditor',
    'Auditor',
    "Completes a department's audit checklist, or an internal GCAA audit.",
    'end_user',
    'department',
    'both',
  ],
  [
    'logistics-vp',
    'Logistics VP',
    'Final sign-off on ASP audit results.',
    'end_user',
    'platform',
    'web',
    { max: 1 },
  ],
  [
    'asp-team',
    'ASP Team',
    "An air service provider's own staff: proposes and closes corrective actions. External.",
    'end_user',
    'provider',
    'web',
    { external: true },
  ],
  [
    'aviation-compliance-team',
    'Aviation Compliance Team',
    'Keeps the GCAA PAO audit tracker and runs internal GCAA audits.',
    'module',
    'platform',
    'web',
  ],
];

const CHANNELS: Record<Channels, Role['channels']> = {
  web: ['web'],
  app: ['app'],
  both: ['web', 'app'],
};

export function roleSeeds(): Role[] {
  return ROLE_SPECS.map(([code, name, description, type, scopeLevel, channels, flags = {}]) => ({
    id: idFor('role', code),
    code,
    name,
    description,
    type,
    scopeLevel,
    maxHolders: flags.max ?? null,
    holders: 0,
    isLocked: flags.locked ?? false,
    isAdminTier: flags.adminTier ?? false,
    isExternal: flags.external ?? false,
    channels: [...CHANNELS[channels]],
    isActive: true,
    deactivatedReason: null,
    version: 1,
    updatedAt: SEEDED_AT,
  }));
}

export const roleName = (code: string) => ROLE_SPECS.find((r) => r[0] === code)?.[1] ?? code;

// ---------------------------------------------------------------- default access rights

/** Capabilities' "what it allows" text on the matrix. */
export const CAPABILITY_TEXT: Readonly<Record<string, string>> = {
  'dispatch.offload': 'Remove a checked-in or booked passenger from a departure, with a reason.',
  'dispatch.reallocate-seat':
    "Give a no-show's seat to a waitlisted passenger, or shift a passenger, during check-in.",
  'dispatch.switch-resource': 'Change the aircraft or vessel of a departure.',
  'dispatch.reopen': 'Reopen a departed, arrived or closed journey, with a mandatory reason.',
  'dispatch.freeze-override':
    'Create, change or cancel bookings on a journey already open for dispatch.',
  'booking.quota-override': 'Approve a booking held because its fixed-wing category quota is full.',
  'booking.vip-reserve': 'Reserve seats before the passenger is known, with a reason.',
  'booking.reserve-waitlist': 'Hold seats on a pre-manifest for no-show backfill.',
  'booking.after-cutoff-cancel': 'Cancel a booking after the cancellation cut-off, with a reason.',
  'booking.raise-on-behalf': 'Raise booking requests for other people.',
  'booking.manual-passenger-exception':
    'Add a passenger record when source systems are unavailable, with a reason and reference.',
  'booking.charge-code-correction': 'Correct the charge code on a booking after the fact.',
  'pob.essential-departure-override':
    'Let two essential people leave one site on the same schedule, with a reason.',
  'muster.reconcile-signoff': 'Sign off the evacuation reconciliation that closes a muster.',
  'masters.pob.approve':
    'Approve a change to muster points, lifeboats or essential positions as the second person.',
  'hll.edit': 'Propose changes to the Helideck Limitations List.',
  'hll.review-publish': 'Review and publish HLL changes as the second person.',
  'findings.override-target': "Change a finding's target date, with a reason.",
  'gcaa.reopen-closed-audit': 'Reopen a closed GCAA PAO audit, with a reason.',
  'internal-audit.reopen': 'Reopen a closed internal GCAA audit, with a reason.',
  'records.reopen': 'Reopen any closed record, with a reason (admin tier).',
  'sync.force-release': 'Release a record checked out to a device, with a reason.',
  'demo-data.manage': 'Generate or reset demo data (DEV and UAT only).',
};

/** Pages a role may hold delete on although it is outside the admin tier. */
export const OPEN_RIGHTS: Readonly<Record<string, Right[]>> = {
  'admin.resource-categories': ['delete'],
};
export const ADMIN_TIER_RIGHTS: readonly Right[] = ['delete', 'reopen'];

const LETTERS: Readonly<Record<string, Right>> = {
  V: 'view',
  C: 'create',
  E: 'edit',
  D: 'deactivate',
  L: 'delete',
  X: 'export',
  R: 'reopen',
};
export const MATRIX_PAGES = PAGES.filter((p) => p.module !== 'shared');
const keysWhere = (test: (key: string, module: string, area: string) => boolean) =>
  MATRIX_PAGES.filter((p) => test(p.key, p.module, p.area)).map((p) => p.key);
const prefixed = (...prefixes: string[]) => keysWhere((k) => prefixes.some((p) => k.startsWith(p)));
const all = (keys: string[], letters: string) => Object.fromEntries(keys.map((k) => [k, letters]));
const reports = (...areas: string[]) =>
  keysWhere((_k, m, a) => m === 'reporting' && areas.includes(a));
const adminArea = (area: string) => keysWhere((_k, m, a) => m === 'administration' && a === area);

/** Default grants (spec 10 §6): page key → rights letters, plus capabilities. */
const DEFAULT_GRANTS: Readonly<
  Record<string, { pages: Record<string, string>; capabilities?: string[] }>
> = {
  'super-admin': {
    pages: all(
      keysWhere(() => true),
      'VCEDLXR',
    ),
    capabilities: CAPABILITIES.map((c) => c.key),
  },
  'master-data-power-user': {
    pages: {
      ...all(adminArea('SHARED MASTERS'), 'VCEDX'),
      'admin.zones': 'V',
      'admin.resource-categories': 'V',
      'admin.resource-types': 'VCEX',
      'admin.quotas': 'V',
      'admin.reason-codes': 'VCEX',
      'admin.routes': 'VCEX',
      'admin.access-rights': 'V',
    },
  },
  'pl-power-user': {
    pages: {
      'admin.reason-codes': 'V',
      ...all(
        prefixed(
          'scheduling.',
          'booking.',
          'freight.',
          'dispatch.',
          'terminal.',
          'hems.',
          'flight-log.',
          'fuel.',
        ),
        'VCEDX',
      ),
      ...all(adminArea('PEOPLE LOGISTICS'), 'VCEDX'),
      'admin.routes': 'VCEX',
      'admin.resource-types': 'VCEX',
      'admin.quotas': 'VCEX',
      'admin.approval-engine': 'VE',
      'admin.business-rules': 'VE',
      'admin.notification-engine': 'VE',
      'admin.audit-log': 'V',
      'admin.access-rights': 'V',
      'admin.resource-categories': 'V',
      ...all(reports('PEOPLE LOGISTICS', 'EXECUTIVE'), 'VX'),
    },
    capabilities: [
      'dispatch.offload',
      'dispatch.reallocate-seat',
      'dispatch.switch-resource',
      'dispatch.reopen',
      'dispatch.freeze-override',
      'booking.after-cutoff-cancel',
      'booking.raise-on-behalf',
      'booking.charge-code-correction',
    ],
  },
  'aviation-team': {
    pages: {
      ...all(prefixed('scheduling.', 'booking.', 'freight.'), 'VCEDX'),
      ...all(prefixed('dispatch.', 'hems.', 'fuel.'), 'VX'),
      'dispatch.manifest': 'VE',
      'flight-log.entries': 'VEX',
      ...all(reports('PEOPLE LOGISTICS'), 'VX'),
    },
    capabilities: [
      'booking.quota-override',
      'booking.vip-reserve',
      'booking.reserve-waitlist',
      'booking.raise-on-behalf',
      'dispatch.reallocate-seat',
    ],
  },
  'line-manager': {
    pages: {
      'booking.approvals': 'VE',
      'booking.bookings': 'V',
      'booking.detail': 'V',
      'mobile.approvals': 'VE',
    },
  },
  'site-in-charge': {
    pages: {
      'booking.approvals': 'VE',
      'booking.bookings': 'V',
      'booking.detail': 'V',
      'pob.dashboard': 'V',
      'pob.asset': 'V',
      'pob.checkin': 'V',
      'pob.emergency': 'VE',
      'mobile.approvals': 'VE',
    },
    capabilities: ['muster.reconcile-signoff'],
  },
  'focal-point': {
    pages: {
      'pob.dashboard': 'VX',
      'pob.map': 'V',
      'pob.asset': 'VX',
      'pob.overstay': 'VEX',
      'pob.checkin': 'VCEX',
      'pob.vessel-checkin': 'VCEX',
      'pob.crew': 'VCEX',
      'pob.location-override': 'VCEX',
      'pob.emergency': 'VCEX',
      'pob.muster-console': 'V',
      'pob.report': 'VX',
      'pob.residence': 'VX',
      'booking.approvals': 'VE',
      'freight.requests': 'VX',
      'hems.flights': 'VCEX',
      'mobile.offshore-checkin': 'VCE',
    },
  },
  'dispatch-team': {
    pages: {
      ...all(prefixed('dispatch.', 'terminal.'), 'VCEX'),
      'freight.requests': 'VX',
      'hems.flights': 'V',
      'flight-log.entries': 'V',
    },
    capabilities: [
      'dispatch.offload',
      'dispatch.reallocate-seat',
      'dispatch.switch-resource',
      'dispatch.freeze-override',
    ],
  },
  'checkin-staff': {
    pages: {
      'terminal.kiosk-portal': 'V',
      'terminal.kiosk': 'VCE',
      'terminal.fids': 'V',
      'terminal.boarding-pass': 'V',
      'dispatch.flight': 'V',
    },
  },
  passenger: {
    pages: {
      'booking.create': 'VC',
      'booking.bookings': 'V',
      'booking.detail': 'VE',
      'ai.assistant': 'V',
      'mobile.bookings': 'VCE',
      'mobile.ai-assistant': 'V',
    },
  },
  'service-provider': {
    pages: {
      'provider.journeys': 'VX',
      'dispatch.status': 'VE',
      'provider.load-sheets': 'VCE',
      'provider.fleet': 'VX',
      'provider.flight-logs': 'VX',
    },
  },
  'flight-crew': { pages: { 'mobile.flight-log': 'VCE', 'flight-log.entries': 'VCE' } },
  'fuel-operator': { pages: { 'fuel.stock': 'VCEX', 'fuel.log': 'VCEX' } },
  'vessel-focal-point': {
    pages: {
      'pob.dashboard': 'V',
      'pob.crew': 'VCEX',
      'pob.vessel-checkin': 'VCEX',
      'mobile.offshore-checkin': 'VCE',
    },
  },
  'muster-coordinator': {
    pages: { 'pob.emergency': 'V', 'pob.muster-console': 'VCE', 'mobile.muster-console': 'VCE' },
  },
  'pob-master-data-power-user': {
    pages: {
      'admin.reason-codes': 'V',
      'admin.access-rights': 'V',
      'admin.resource-categories': 'V',
      'admin.muster-points': 'VCEDX',
      'admin.lifeboats': 'VCEDX',
      'admin.essential-positions': 'VCEDX',
      'admin.pending-changes': 'VE',
      'admin.resource-types': 'V',
      'admin.quotas': 'V',
      'pob.dashboard': 'V',
    },
    capabilities: ['masters.pob.approve'],
  },
  executive: {
    pages: {
      ...all(
        keysWhere((_k, m) => m === 'reporting'),
        'VX',
      ),
      ...all(
        [
          'scheduling.dashboard',
          'booking.dashboard',
          'dispatch.dashboard',
          'pob.dashboard',
          'helideck.dashboard',
        ],
        'VX',
      ),
      'pob.report': 'VX',
      'pob.residence': 'VX',
    },
  },
  'site-focal-point-helideck': {
    pages: {
      'helideck.dashboard': 'V',
      'helideck.hll': 'V',
      'helideck.calendar': 'V',
      'helideck.request': 'VC',
      'helideck.approvals': 'VE',
      'helideck.confirmation': 'VE',
      'helideck.acceptance': 'VC',
      'helideck.documents': 'VCEX',
      'helideck.findings': 'V',
      'helideck.corrective-actions': 'V',
    },
  },
  'site-team': {
    pages: {
      'helideck.dashboard': 'V',
      'helideck.findings': 'V',
      'helideck.corrective-actions': 'VE',
    },
  },
  'inspection-team-poc': {
    pages: {
      'helideck.dashboard': 'VX',
      'helideck.hll': 'V',
      'helideck.map': 'V',
      'helideck.calendar': 'VX',
      'helideck.annual-plan': 'V',
      'helideck.request': 'VC',
      'helideck.approvals': 'VEX',
      'helideck.confirmation': 'VE',
      'helideck.assignment': 'VCE',
      'helideck.checklist': 'V',
      'helideck.test-review': 'VEX',
      'helideck.findings': 'VEX',
      'helideck.corrective-actions': 'VEX',
      'helideck.acceptance': 'VEX',
      'helideck.documents': 'VX',
      'helideck.crew-assessment': 'VX',
    },
    capabilities: ['findings.override-target'],
  },
  'helideck-inspector': {
    pages: {
      'helideck.dashboard': 'V',
      'helideck.calendar': 'V',
      'helideck.checklist': 'VE',
      'helideck.test-recording': 'VCE',
      'helideck.crew-assessment': 'VCE',
      'helideck.findings': 'VC',
      'helideck.documents': 'V',
      'mobile.inspections': 'VE',
      'mobile.crew-assessment': 'VCE',
    },
  },
  'helideck-inspector-lead': {
    pages: {
      'helideck.dashboard': 'V',
      'helideck.calendar': 'V',
      'helideck.checklist': 'VE',
      'helideck.test-review': 'VEX',
      'helideck.findings': 'VEX',
      'helideck.crew-assessment': 'VX',
    },
  },
  'tl-ats': {
    pages: {
      'helideck.dashboard': 'V',
      'helideck.calendar': 'V',
      'helideck.hll': 'V',
      'helideck.approvals': 'VEX',
      'mobile.approvals': 'VE',
    },
  },
  mosa: {
    pages: {
      'helideck.dashboard': 'V',
      'helideck.calendar': 'V',
      'helideck.hll': 'V',
      'helideck.approvals': 'VEX',
      'mobile.approvals': 'VE',
    },
  },
  'aviation-technical-team': {
    pages: {
      'admin.reason-codes': 'V',
      ...all(prefixed('helideck.'), 'VX'),
      'helideck.annual-plan': 'VCEX',
      'helideck.hll': 'VCEX',
      'helideck.request': 'VC',
      'helideck.acceptance': 'VCEX',
      'helideck.documents': 'VCEDX',
      'helideck.checklist-builder': 'VCEDX',
      'helideck.question-bank': 'VCEDX',
      'admin.installations': 'VCEX',
      'admin.inspection-types': 'VCEDX',
      'admin.documentation-matrix': 'VCEDX',
      'admin.limitation-codes': 'VCEDX',
      'admin.aircraft-models': 'VCEX',
      'admin.resource-categories': 'V',
      ...all(reports('HELIDECK & AVIATION TECHNICAL'), 'VX'),
    },
    capabilities: ['hll.edit', 'hll.review-publish'],
  },
  'third-party-inspector': { pages: { 'helideck.test-recording': 'VCE' } },
  'compliance-admin': {
    pages: {
      'admin.reason-codes': 'V',
      ...all(prefixed('asp.'), 'VCEX'),
      'admin.department-focal-points': 'VCEDX',
      'admin.asp-scoring': 'VCEDX',
      'admin.audit-checklist-library': 'VCEDX',
      'admin.resource-categories': 'V',
      ...all(reports('COMPLIANCE'), 'VX'),
    },
  },
  'department-focal-point': {
    pages: {
      'asp.audits': 'V',
      'asp.calendar': 'V',
      'asp.departments': 'VE',
      'asp.checklist': 'V',
      'asp.review': 'VE',
      'asp.findings': 'VX',
      'asp.corrective-actions': 'VEX',
    },
  },
  auditor: {
    pages: {
      'asp.audits': 'V',
      'asp.checklist': 'VE',
      'gcaa.internal-audits': 'VE',
      'mobile.asp-audits': 'VE',
      'mobile.internal-audits': 'VE',
    },
  },
  'logistics-vp': {
    pages: {
      'asp.audits': 'VX',
      'asp.review': 'VE',
      'asp.findings': 'VX',
      'reports.asp-compliance': 'VX',
      'reports.asp-findings-closeout': 'VX',
    },
  },
  'asp-team': { pages: { 'asp.findings': 'V', 'asp.corrective-actions': 'VCE' } },
  'admin-user': { pages: { 'admin.roles': 'VCEDX', 'admin.resource-categories': 'VCEDLX' } },
  'aviation-compliance-team': {
    pages: {
      'gcaa.tracker': 'VCEX',
      'gcaa.internal-audits': 'VCEX',
      ...all(reports('COMPLIANCE'), 'VX'),
    },
  },
  viewer: {
    pages: all(
      keysWhere(() => true),
      'V',
    ),
  },
};

/** A grant cut to the rights the page supports; delete and reopen only for the admin tier. */
function rightsFor(pageKey: string, letters: string, adminTier: boolean): Right[] {
  const page = MATRIX_PAGES.find((p) => p.key === pageKey);
  if (!page) return [];
  const open = OPEN_RIGHTS[pageKey] ?? [];
  return Array.from(letters)
    .map((l) => LETTERS[l])
    .filter((r): r is Right => r !== undefined && (page.rights as readonly Right[]).includes(r))
    .filter((r) => adminTier || !ADMIN_TIER_RIGHTS.includes(r) || open.includes(r));
}

export function grantSeeds(): GrantRow[] {
  return roleSeeds().map((role) => {
    const defaults = DEFAULT_GRANTS[role.code] ?? { pages: {} };
    const pages: Record<string, Right[]> = {};
    for (const [key, letters] of Object.entries(defaults.pages)) {
      const rights = rightsFor(key, letters, role.isAdminTier);
      if (rights.length > 0) pages[key] = rights;
    }
    const held = new Set(
      Object.keys(pages).map((k) => MATRIX_PAGES.find((p) => p.key === k)?.module),
    );
    const modules = Object.fromEntries(
      MODULES.map((m) => [m.key, held.has(m.key)]),
    ) as GrantRow['modules'];
    const capabilities = (defaults.capabilities ?? []).map((key) => ({ key, locationIds: null }));
    return { id: role.id, version: 1, modules, pages, capabilities };
  });
}

export function matrixVersionSeeds(): MatrixVersionRow[] {
  const by = 'Mariam Al Hammadi';
  const change = (
    roleCode: string,
    kind: 'page' | 'module' | 'capability',
    key: string,
    label: string,
    before: string,
    after: string,
  ) => ({
    role: roleName(roleCode),
    kind,
    key,
    label,
    before,
    after,
  });
  const version = (
    versionNo: number,
    roleCode: string | null,
    summary: string,
    changedAt: string,
    changes: S['MatrixChanges']['changes'],
    changedBy: string | null = by,
  ): MatrixVersionRow => ({
    id: idFor('matrix-version', String(versionNo)),
    versionNo,
    roleId: roleCode ? idFor('role', roleCode) : null,
    roleName: roleCode ? roleName(roleCode) : null,
    summary,
    changedBy,
    changedAt,
    changes,
  });
  return [
    version(6, 'dispatch-team', 'Granted Change a frozen departure', gstAt(-3, 11, 20), [
      change(
        'dispatch-team',
        'capability',
        'dispatch.freeze-override',
        'Change a frozen departure',
        'Not granted',
        'Granted',
      ),
    ]),
    version(5, 'pl-power-user', 'Quotas: added Export', gstAt(-9, 9, 5), [
      change(
        'pl-power-user',
        'page',
        'admin.quotas',
        'Quotas',
        'View, Create, Edit',
        'View, Create, Edit, Export',
      ),
    ]),
    version(4, 'master-data-power-user', 'Routes: added Create and Edit', gstAt(-16, 14, 40), [
      change(
        'master-data-power-user',
        'page',
        'admin.routes',
        'Routes',
        'View, Export',
        'View, Create, Edit, Export',
      ),
      change(
        'master-data-power-user',
        'page',
        'admin.reason-codes',
        'Reason Codes',
        'View',
        'View, Create, Edit, Export',
      ),
    ]),
    version(3, 'executive', 'Reports & Insights enabled', gstAt(-27, 10, 0), [
      change('executive', 'module', 'reporting', 'Reports & Insights', 'Off', 'On'),
    ]),
    version(
      2,
      'pob-master-data-power-user',
      'Granted Approve POB master changes',
      gstAt(-41, 8, 30),
      [
        change(
          'pob-master-data-power-user',
          'capability',
          'masters.pob.approve',
          'Approve POB master changes',
          'Not granted',
          'Granted',
        ),
      ],
    ),
    version(1, null, 'Default access rights loaded', SEEDED_AT.replace('10-20', '06-01'), [], null),
  ];
}

// ---------------------------------------------------------------- users and assignments

type PersonaSeed = (typeof personaSeeds)[number];
interface SeedUser {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly personnelNo: string;
  readonly hsePassportNo: string | null;
  readonly source: UserRow['source'];
  readonly company: string | null;
  readonly department: string | null;
  readonly designation: string;
  readonly external: boolean;
  readonly approvalTier: number | null;
  readonly lineManager: string | null;
  readonly roles: readonly { role: string; scope: SeedScope; validUntilDays?: number }[];
  readonly status?: UserRow['status'];
}

/** The demo sign-in personas, as Users rows. */
const DEMO_USERS: SeedUser[] = PERSONAS.map((p, i) => ({
  key: `demo-${p.key}`,
  id: p.me.id,
  name: p.me.displayName,
  email: p.me.email,
  personnelNo: `OPT-1000${i + 1}`,
  hsePassportNo: `HSE-10000${i + 1}`,
  source: 'sap',
  company: 'ADNOC-OFF',
  department: ['AVL', 'AVL', 'HSE'][i] ?? 'AVL',
  designation: p.me.designation ?? p.me.roles[0]?.name ?? 'Employee',
  external: false,
  approvalTier: p.me.approvalTier,
  lineManager: null,
  roles: p.me.roles.map((r) => ({ role: r.code, scope: { allLocations: true } })),
}));

/** Fixed-term contractors and visitors, whose access ends soon (KPI "expiring"). */
const VALID_UNTIL: Readonly<Record<string, number>> = {
  'capt-hughes': 9,
  ravi: 18,
  imran: 26,
  joel: 64,
  'gulf-deck': 120,
};

const PERSONA_USERS: SeedUser[] = personaSeeds.map((p: PersonaSeed) => ({
  key: p.key,
  id: idFor('user', p.email),
  name: p.name,
  email: p.email,
  personnelNo: p.personnelNo,
  hsePassportNo: p.hsePassportNo,
  source: p.source as UserRow['source'],
  company: p.company,
  department: p.department,
  designation: p.designation,
  external: p.external,
  approvalTier: p.approvalTier,
  lineManager: p.lineManager,
  roles: p.roles.map((r) => ({
    role: r.role,
    scope: r.scope,
    ...(VALID_UNTIL[p.key] === undefined ? {} : { validUntilDays: VALID_UNTIL[p.key] }),
  })),
  ...(p.key === 'gulf-deck' ? { status: 'invited' as const } : {}),
}));

/** People synced from the source systems who hold no role yet, plus a leaver and an invitee. */
const EXTRA_USERS: SeedUser[] = [
  {
    key: 'aisha',
    id: idFor('user', 'a.alqubaisi@masar.example'),
    name: 'Aisha Al Qubaisi',
    email: 'a.alqubaisi@masar.example',
    personnelNo: 'OPT-90061',
    hsePassportNo: 'HSE-090061',
    source: 'sap',
    company: 'ADNOC-OFF',
    department: 'AVL',
    designation: 'Terminal Supervisor',
    external: false,
    approvalTier: null,
    lineManager: 'majid',
    roles: [
      { role: 'focal-point', scope: { locationIds: ['AUH'] } },
      { role: 'dispatch-team', scope: { locationIds: ['AUH'] } },
    ],
  },
  {
    key: 'hessa',
    id: idFor('user', 'h.alketbi@masar.example'),
    name: 'Hessa Al Ketbi',
    email: 'h.alketbi@masar.example',
    personnelNo: 'OPT-90062',
    hsePassportNo: 'HSE-090062',
    source: 'sap',
    company: 'ADNOC-OFF',
    department: 'OPS',
    designation: 'Production Engineer',
    external: false,
    approvalTier: null,
    lineManager: 'saeed',
    roles: [],
  },
  {
    key: 'mohammed',
    id: idFor('user', 'm.alhosani@masar.example'),
    name: 'Mohammed Al Hosani',
    email: 'm.alhosani@masar.example',
    personnelNo: 'OPT-90063',
    hsePassportNo: 'HSE-090063',
    source: 'sap',
    company: 'ADNOC-OFF',
    department: 'MNT',
    designation: 'Mechanical Technician',
    external: false,
    approvalTier: null,
    lineManager: 'saeed',
    roles: [],
  },
  {
    key: 'rahul',
    id: idFor('user', 'r.menon@masar.example'),
    name: 'Rahul Menon',
    email: 'r.menon@masar.example',
    personnelNo: 'FG-204417',
    hsePassportNo: 'HSE-204417',
    source: 'fieldglass',
    company: 'GOE',
    department: 'MNT',
    designation: 'Instrument Technician',
    external: false,
    approvalTier: null,
    lineManager: null,
    roles: [{ role: 'passenger', scope: { self: true }, validUntilDays: 21 }],
  },
  {
    key: 'abdulla',
    id: idFor('user', 'a.alzaabi@masar.example'),
    name: 'Abdulla Al Zaabi',
    email: 'a.alzaabi@masar.example',
    personnelNo: 'OPT-88412',
    hsePassportNo: 'HSE-088412',
    source: 'sap',
    company: 'ADNOC-OFF',
    department: 'AVL',
    designation: 'Logistics Coordinator',
    external: false,
    approvalTier: null,
    lineManager: 'majid',
    roles: [],
    status: 'deactivated',
  },
  {
    key: 'sophie',
    id: idFor('user', 's.turner@ada.masar.example'),
    name: 'Sophie Turner',
    email: 's.turner@ada.masar.example',
    personnelNo: 'EXT-ADA-0142',
    hsePassportNo: null,
    source: 'external_contact',
    company: 'ADA',
    department: null,
    designation: 'Operations Controller',
    external: true,
    approvalTier: null,
    lineManager: null,
    roles: [{ role: 'service-provider', scope: { serviceProviderId: 'ADA' } }],
    status: 'invited',
  },
];

const SEED_USERS: SeedUser[] = [...DEMO_USERS, ...PERSONA_USERS, ...EXTRA_USERS];
const ASSIGNED_BY = 'Mariam Al Hammadi';

export function userSeeds(): UserRow[] {
  return SEED_USERS.map((u, i) => {
    const status = u.status ?? 'active';
    const signedIn = status === 'active' ? hoursAgo(1 + spread(u.email, 24 * 45)) : null;
    const manager = SEED_USERS.find((m) => m.key === u.lineManager);
    const invitedAt = u.external ? gstAt(-(3 + spread(u.email, 90)), 9) : null;
    return {
      id: u.id,
      displayName: u.name,
      email: u.email,
      personnelNo: u.personnelNo,
      organisation: companyName(u.company),
      source: u.source,
      signIn: u.external ? 'password_otp' : 'sso',
      isExternal: u.external,
      status,
      lastSignInAt: i < DEMO_USERS.length ? hoursAgo(1 + i) : signedIn,
      version: 1,
      person: {
        designation: u.designation,
        company: companyName(u.company),
        department: departmentName(u.department),
        lineManager: manager?.name ?? null,
        hsePassportNo: u.hsePassportNo,
        sourceStatus: status === 'deactivated' ? 'left' : 'active',
        syncedAt: u.source === 'external_contact' ? null : hoursAgo(2),
      },
      approvalTier: u.approvalTier,
      invitedAt,
      activatedAt: status === 'active' ? gstAt(-(120 + spread(u.email, 200)), 8) : null,
      deactivatedAt: status === 'deactivated' ? gstAt(-12, 10, 15) : null,
      deactivatedReason: status === 'deactivated' ? 'Left the company (SAP leaver record)' : null,
    };
  });
}

export function assignmentSeeds(): AssignmentRow[] {
  const roles = roleSeeds();
  return SEED_USERS.flatMap((u) =>
    u.roles.flatMap((r, j) => {
      const role = roles.find((x) => x.code === r.role);
      if (!role) return [];
      const assignedAt = gstAt(-(90 + spread(u.email + r.role, 240)), 9, 30);
      return [
        {
          id: idFor('assignment', `${u.email}:${r.role}`),
          userId: u.id,
          role: {
            code: role.code,
            name: role.name,
            scopeLevel: role.scopeLevel,
            isExternal: role.isExternal,
            isAdminTier: role.isAdminTier,
          },
          scope: scopeOf(r.scope),
          validFrom: assignedAt,
          validUntil: r.validUntilDays === undefined ? null : gstAt(r.validUntilDays, 23, 59),
          accessRequestRef: `RITM00${String(41_200 + spread(u.email, 8_000) + j).padStart(5, '0')}`,
          assignedBy: ASSIGNED_BY,
          assignedAt,
          version: 1,
        },
      ];
    }),
  );
}

export const userIdOf = (key: string) =>
  SEED_USERS.find((u) => u.key === key)?.id ?? idFor('user', key);
const nameOf = (key: string) => SEED_USERS.find((u) => u.key === key)?.name ?? key;

// ---------------------------------------------------------------- delegations

export function delegationSeeds(): DelegationRow[] {
  const d = (
    n: number,
    from: string,
    to: string,
    modules: ModuleKey[] | null,
    start: number,
    end: number,
    reason: string,
    revoked?: string,
  ): DelegationRow => ({
    id: idFor('delegation', String(n)),
    delegator: { userId: userIdOf(from), name: nameOf(from) },
    delegate: { userId: userIdOf(to), name: nameOf(to) },
    moduleKeys: modules,
    startsAt: gstAt(start, 0),
    endsAt: gstAt(end, 23, 59),
    reason,
    revokedReason: revoked ?? null,
    revokedAt: revoked ? gstAt(start, 12) : null,
    version: 1,
  });
  return [
    d(
      1,
      'demo-admin',
      'reem',
      ['administration'],
      -2,
      5,
      'Annual leave; master data approvals continue',
    ),
    d(
      2,
      'demo-planner',
      'power-user',
      ['people-logistics'],
      3,
      10,
      'Attending the Aviation Safety Conference in Dubai',
    ),
    d(3, 'saeed', 'hassan', null, -4, 2, 'Offshore rotation at Upper Zakum'),
    d(4, 'ali', 'capt-khalid', ['helideck'], -20, -13, 'Annual leave'),
    d(
      5,
      'majid',
      'demo-admin',
      ['aviation-compliance'],
      -1,
      6,
      'Business travel; ASP sign-off delegated',
    ),
    d(6, 'hamad', 'faisal', ['pob'], -9, -2, 'Medical leave'),
    d(7, 'noura', 'omar', ['helideck'], 1, 14, 'Training course abroad', undefined),
    d(
      8,
      'yousuf',
      'site-team-zirku',
      ['people-logistics'],
      -6,
      4,
      'Emergency leave',
      'Returned to site early',
    ),
    d(9, 'demo-viewer', 'hse-audit', ['reporting'], 7, 12, 'Planned leave'),
  ];
}

// ---------------------------------------------------------------- devices

export function deviceSeeds(): DeviceRow[] {
  const dev = (
    n: number,
    userKey: string,
    platform: DeviceRow['platform'],
    model: string,
    os: string,
    app: string,
    registered: number,
    seenHours: number,
    status: DeviceRow['status'] = 'active',
    reason: string | null = null,
  ): DeviceRow => {
    const u = SEED_USERS.find((x) => x.key === userKey);
    return {
      id: idFor('device', String(n)),
      deviceId: idFor('device-install', String(n)),
      user: { id: u?.id ?? '', name: u?.name ?? userKey, email: u?.email ?? '' },
      platform,
      model,
      osVersion: os,
      appVersion: app,
      pushEnabled: status === 'active' && n % 4 !== 3,
      registeredAt: gstAt(-registered, 8, 15),
      lastSeenAt: hoursAgo(seenHours),
      status,
      revokedReason: status === 'revoked' ? reason : null,
      blockedReason: status === 'blocked' ? reason : null,
      revokedAt: status === 'revoked' ? gstAt(-5, 9) : null,
      version: 1,
    };
  };
  return [
    dev(1, 'demo-admin', 'ios', 'iPhone 15 Pro', '18.1', '1.4.2', 140, 2),
    dev(2, 'demo-planner', 'android', 'Samsung Galaxy S24', '15', '1.4.2', 96, 5),
    dev(3, 'demo-planner', 'ipados', 'iPad Air (M2)', '18.0', '1.4.1', 60, 30),
    dev(4, 'demo-viewer', 'ios', 'iPhone 14', '17.6', '1.3.9', 200, 70),
    dev(5, 'omar', 'ipados', 'iPad Pro 11"', '18.1', '1.4.2', 180, 4),
    dev(6, 'ravi', 'android', 'Samsung Galaxy Tab Active5', '14', '1.4.0', 75, 20),
    dev(7, 'capt-hughes', 'ipados', 'iPad mini (A17 Pro)', '18.1', '1.4.2', 40, 9),
    dev(8, 'faisal', 'android', 'Zebra TC58', '13', '1.4.2', 110, 1),
    dev(9, 'saeed', 'ios', 'iPhone 13', '18.0', '1.4.1', 300, 26),
    dev(
      10,
      'ahmed',
      'android',
      'Huawei P40',
      '10',
      '1.2.7',
      400,
      24 * 33,
      'blocked',
      'Reported lost by the owner; blocked pending replacement',
    ),
    dev(
      11,
      'joel',
      'android',
      'Samsung Galaxy A54',
      '14',
      '1.3.5',
      210,
      24 * 12,
      'revoked',
      'Signed out by the user',
    ),
    dev(12, 'hamad', 'ios', 'iPhone 15', '18.1', '1.4.2', 88, 3),
    dev(13, 'fatima', 'ipados', 'iPad (10th generation)', '17.7', '1.4.0', 150, 48),
    dev(14, 'noura', 'ios', 'iPhone 16', '18.1', '1.4.2', 25, 6),
  ];
}

// ---------------------------------------------------------------- sync runs

export const SYNC_LABEL = {
  sap: 'SAP',
  fieldglass: 'Fieldglass',
  hse_passport: 'HSE Passport',
} as const;

export function syncRunSeeds(): SyncRunRow[] {
  const run = (
    n: number,
    adapter: SyncRunRow['adapter'],
    startedHoursAgo: number,
    minutes: number,
    status: SyncRunRow['status'],
    counts: SyncRunRow['counts'],
    extra: Partial<SyncRunRow> = {},
  ): SyncRunRow => {
    const started = Date.now() - startedHoursAgo * HOUR;
    return {
      id: idFor('sync-run', String(n)),
      adapter,
      trigger: 'scheduled',
      triggeredBy: null,
      status,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(started + minutes * 60_000).toISOString(),
      counts,
      error: null,
      errors: [],
      ...extra,
    };
  };
  const fgErrors = [
    {
      sourceId: 'WO-7781042',
      message: 'Worker has no cost centre on the work order; skipped.',
      at: hoursAgo(3),
    },
    {
      sourceId: 'WO-7781107',
      message: 'Supplier code GOE-04 is not mapped to a company.',
      at: hoursAgo(3),
    },
    { sourceId: 'WO-7781230', message: 'End date is before start date; skipped.', at: hoursAgo(3) },
  ];
  return [
    run(1, 'sap', 1.5, 6, 'succeeded', {
      fetched: 1843,
      created: 4,
      updated: 37,
      unchanged: 1798,
      left: 4,
      errors: 0,
    }),
    run(
      2,
      'fieldglass',
      3,
      4,
      'partial',
      { fetched: 412, created: 9, updated: 22, unchanged: 378, skipped: 3, errors: 3 },
      { error: '3 work orders could not be read; see the errors.', errors: fgErrors },
    ),
    run(3, 'hse_passport', 5, 2, 'succeeded', {
      fetched: 2210,
      updated: 61,
      unchanged: 2149,
      stale: 12,
      errors: 0,
    }),
    run(4, 'sap', 25.5, 7, 'succeeded', {
      fetched: 1840,
      created: 2,
      updated: 51,
      unchanged: 1786,
      left: 1,
      errors: 0,
    }),
    run(
      5,
      'fieldglass',
      27,
      1,
      'failed',
      { fetched: 0, errors: 1 },
      {
        error: 'Fieldglass did not answer within 60 seconds.',
        errors: [
          {
            sourceId: null,
            message: 'Fieldglass did not answer within 60 seconds.',
            at: hoursAgo(27),
          },
        ],
      },
    ),
    run(6, 'hse_passport', 29, 2, 'succeeded', {
      fetched: 2204,
      updated: 44,
      unchanged: 2160,
      stale: 9,
      errors: 0,
    }),
    run(
      7,
      'sap',
      49.5,
      6,
      'succeeded',
      { fetched: 1838, created: 6, updated: 29, unchanged: 1803, errors: 0 },
      { trigger: 'manual', triggeredBy: 'Mariam Al Hammadi' },
    ),
  ];
}

// ---------------------------------------------------------------- audit history

export function auditSeeds(): AuditEvent[] {
  const users = SEED_USERS;
  const actor = (key: string | null, onBehalfOf?: string) => {
    const u = key ? users.find((x) => x.key === key) : undefined;
    return {
      userId: u?.id ?? null,
      role: u ? roleName(u.roles[0]?.role ?? '') : null,
      label: u?.name ?? 'MASAR (system)',
      onBehalfOf: onBehalfOf ? { userId: userIdOf(onBehalfOf), label: nameOf(onBehalfOf) } : null,
    };
  };
  const userRecord = (key: string) => {
    const u = users.find((x) => x.key === key);
    return { type: 'user', id: u?.id ?? null, ref: u?.personnelNo ?? null, label: u?.name ?? null };
  };
  const source = (key: string | null, n: number) =>
    key
      ? {
          ip: `10.42.${8 + (n % 6)}.${20 + ((n * 37) % 200)}`,
          device: n % 3 === 0 ? 'MASAR app (iOS)' : 'Edge 129 on Windows 11',
          userAgent: null,
        }
      : { ip: null, device: 'Scheduled job', userAgent: null };
  type Seed = [
    number,
    string,
    string,
    string,
    string | null,
    AuditEvent['record'],
    string | null,
    {
      reason?: string;
      ref?: string;
      outcome?: AuditEvent['outcome'];
      before?: unknown;
      after?: unknown;
      high?: boolean;
      behalf?: string;
    }?,
  ];
  const rows: Seed[] = [
    [
      0.4,
      'administration',
      'auth.signed-in',
      'Signed in',
      'demo-admin',
      userRecord('demo-admin'),
      null,
    ],
    [
      1.2,
      'administration',
      'user.role-assigned',
      'Role assigned',
      'demo-admin',
      userRecord('aisha'),
      null,
      { ref: 'RITM0048213', after: { role: 'Dispatch Team', scope: 'Abu Dhabi' } },
    ],
    [
      1.5,
      'administration',
      'sync-run.finished',
      'SAP sync finished',
      null,
      { type: 'sync-run', id: idFor('sync-run', '1'), ref: 'SAP', label: 'SAP people sync' },
      null,
    ],
    [
      2.1,
      'people-logistics',
      'booking.approved',
      'Booking approved',
      'saeed',
      {
        type: 'booking',
        id: idFor('booking', 'BK-2026-018342'),
        ref: 'BK-2026-018342',
        label: 'Ahmed Al Mansoori · AUH → DAS',
      },
      null,
    ],
    [
      3,
      'administration',
      'sync-run.partial',
      'Fieldglass sync partly failed',
      null,
      {
        type: 'sync-run',
        id: idFor('sync-run', '2'),
        ref: 'Fieldglass',
        label: 'Fieldglass contractor sync',
      },
      null,
      { outcome: 'failure' },
    ],
    [
      3.6,
      'administration',
      'access.denied',
      'Access refused',
      'ahmed',
      { type: 'page', id: null, ref: 'admin.users', label: 'Users' },
      null,
      { outcome: 'denied' },
    ],
    [
      4.2,
      'administration',
      'fleet-unit.changed',
      'Fleet unit changed',
      'reem',
      {
        type: 'fleet-unit',
        id: idFor('fleet', 'A6-ADA'),
        ref: 'A6-ADA',
        label: 'Dash 8 Q400 A6-ADA',
      },
      null,
      {
        before: { seats: 50 },
        after: { seats: 48 },
        reason: 'Two seats removed for the stretcher kit',
      },
    ],
    [
      5.5,
      'helideck',
      'inspection.submitted',
      'Inspection submitted',
      'omar',
      {
        type: 'inspection',
        id: idFor('inspection', 'HI-2026-0311'),
        ref: 'HI-2026-0311',
        label: 'Das Island helideck · annual inspection',
      },
      null,
    ],
    [
      7,
      'pob',
      'muster.closed',
      'Muster closed',
      'faisal',
      {
        type: 'muster',
        id: idFor('muster', 'MU-DAS-1027'),
        ref: 'MU-DAS-1027',
        label: 'Das Island drill muster',
      },
      null,
      { after: { accounted: 412, missing: 0 } },
    ],
    [
      9,
      'administration',
      'access-rights.changed',
      'Access rights changed',
      'demo-admin',
      {
        type: 'role',
        id: idFor('role', 'dispatch-team'),
        ref: 'dispatch-team',
        label: 'Dispatch Team',
      },
      null,
      {
        before: { 'dispatch.freeze-override': 'Not granted' },
        after: { 'dispatch.freeze-override': 'Granted' },
        high: true,
        ref: 'RITM0047920',
      },
    ],
    [
      12,
      'people-logistics',
      'journey.reopened',
      'Departure reopened',
      'rashed',
      {
        type: 'journey',
        id: idFor('journey', 'ADA101'),
        ref: 'ADA101',
        label: 'ADA101 · AUH → DAS',
      },
      null,
      { reason: 'Late passenger confirmed by Das Island focal point', high: true },
    ],
    [
      20,
      'administration',
      'user.deactivated',
      'User deactivated',
      null,
      userRecord('abdulla'),
      null,
      { reason: 'Left the company (SAP leaver record)' },
    ],
    [
      26,
      'administration',
      'delegation.created',
      'Delegation created',
      'demo-planner',
      {
        type: 'delegation',
        id: idFor('delegation', '2'),
        ref: 'People Logistics',
        label: 'Khalid Al Mazrouei → Dispatch Power User',
      },
      null,
      { reason: 'Attending the Aviation Safety Conference in Dubai' },
    ],
    [
      27,
      'administration',
      'sync-run.failed',
      'Fieldglass sync failed',
      null,
      {
        type: 'sync-run',
        id: idFor('sync-run', '5'),
        ref: 'Fieldglass',
        label: 'Fieldglass contractor sync',
      },
      null,
      { outcome: 'failure' },
    ],
    [
      31,
      'people-logistics',
      'booking.created',
      'Booking raised on behalf',
      'power-user',
      {
        type: 'booking',
        id: idFor('booking', 'BK-2026-018297'),
        ref: 'BK-2026-018297',
        label: 'Hessa Al Ketbi · AUH → UZ',
      },
      null,
      { behalf: 'saeed' },
    ],
    [
      44,
      'administration',
      'location.changed',
      'Location changed',
      'reem',
      { type: 'location', id: idFor('location', 'ZRK'), ref: 'ZRK', label: 'Zirku Island' },
      null,
      {
        before: { pobLimit: 300 },
        after: { pobLimit: 320 },
        reason: 'New accommodation module commissioned',
      },
    ],
    [
      52,
      'administration',
      'user.changed',
      'Approval tier changed',
      'demo-admin',
      userRecord('saeed'),
      'RITM0047511',
      { before: { approvalTier: null }, after: { approvalTier: 1 } },
    ],
    [
      70,
      'administration',
      'access.denied',
      'Sign-in refused',
      'abdulla',
      userRecord('abdulla'),
      null,
      { outcome: 'denied', reason: 'Account deactivated' },
    ],
    [
      75,
      'helideck',
      'hll.published',
      'HLL published',
      'helideck-team',
      {
        type: 'hll',
        id: idFor('hll', '2026-10'),
        ref: 'HLL-2026-10',
        label: 'Helideck Limitations List, October issue',
      },
      null,
      { high: true },
    ],
    [
      96,
      'administration',
      'user.role-revoked',
      'Role revoked',
      'demo-admin',
      userRecord('abdulla'),
      'RITM0047102',
      {
        reason: 'Moved to a role outside logistics',
        before: { role: 'Dispatch Team', scope: 'Abu Dhabi' },
      },
    ],
    [
      118,
      'aviation-compliance',
      'asp-audit.signed-off',
      'ASP audit signed off',
      'majid',
      {
        type: 'asp-audit',
        id: idFor('asp-audit', 'ASP-2026-04'),
        ref: 'ASP-2026-04',
        label: 'Falcon Aviation annual audit',
      },
      null,
    ],
    [
      150,
      'administration',
      'role.changed',
      'Role changed',
      'demo-admin',
      { type: 'role', id: idFor('role', 'mosa'), ref: 'mosa', label: 'MOSA' },
      null,
      {
        before: { maxHolders: null },
        after: { maxHolders: 1 },
        reason: 'Single accountable manager (GCAA)',
      },
    ],
    [
      190,
      'administration',
      'user.role-assigned',
      'Role assigned',
      'demo-admin',
      userRecord('capt-hughes'),
      'RITM0046318',
      { after: { role: 'Flight Crew', scope: 'Falcon Aviation', validUntil: gstDate(9) } },
    ],
    [
      240,
      'administration',
      'support-article.changed',
      'Support article changed',
      'demo-admin',
      {
        type: 'support-article',
        id: idFor('support-article', 'FAQ-BOOK-CUTOFF'),
        ref: 'FAQ-BOOK-CUTOFF',
        label: 'When is the booking cut-off?',
      },
      null,
      { before: { body: '24 hours' }, after: { body: '48 hours' } },
    ],
    [
      310,
      'people-logistics',
      'quota.changed',
      'Quota changed',
      'demo-planner',
      {
        type: 'quota',
        id: idFor('quota', 'DAS-CONTRACTOR'),
        ref: 'DAS-CONTRACTOR',
        label: 'Das Island · Contractor quota',
      },
      null,
      { before: { seats: 20 }, after: { seats: 24 } },
    ],
    [
      400,
      'administration',
      'user.role-assigned',
      'Role assigned',
      'demo-admin',
      userRecord('demo-admin'),
      'RITM0045001',
      { after: { role: 'Super Admin', scope: 'All locations' }, high: true },
    ],
    [
      520,
      'administration',
      'device.blocked',
      'Device blocked',
      'demo-admin',
      {
        type: 'device',
        id: idFor('device', '10'),
        ref: 'Android',
        label: 'Huawei P40 · Ahmed Al Mansoori',
      },
      null,
      { reason: 'Reported lost by the owner; blocked pending replacement' },
    ],
  ];
  return rows.map(
    ([hours, module, actionType, actionLabel, who, record, referenceId, o = {}], n) => ({
      id: idFor('audit', String(n)),
      occurredAt: hoursAgo(hours),
      module,
      actionType,
      actionLabel,
      reason: o.reason ?? null,
      referenceId: o.ref ?? referenceId,
      outcome: o.outcome ?? 'success',
      record,
      actor: actor(who, o.behalf),
      ...(o.before === undefined ? {} : { before: o.before }),
      ...(o.after === undefined ? {} : { after: o.after }),
      source: source(who, n),
      correlationId: idFor('correlation', String(n)),
      highRisk: o.high ?? false,
    }),
  );
}

// ---------------------------------------------------------------- notifications

export function notificationSeeds(): NotificationRow[] {
  type N = [
    NotificationRow['kind'],
    NotificationCategory,
    NotificationRow['severity'],
    string,
    string,
    string | null,
    number,
    boolean,
  ];
  const forPersona: Record<string, N[]> = {
    admin: [
      [
        'alert',
        'admin',
        'warning',
        'Fieldglass sync partly failed',
        '3 work orders could not be read. Check the errors on the Users page.',
        '/admin/users',
        3,
        false,
      ],
      [
        'alert',
        'access',
        'warning',
        'Access ending soon',
        "Capt. Daniel Hughes's Flight Crew access ends in 9 days.",
        '/admin/users?filter[access]=expiring',
        6,
        false,
      ],
      [
        'alert',
        'approvals',
        'info',
        'Change waiting for your approval',
        'Lifeboat LB-DAS-04 capacity change by Latifa Al Mazrouei.',
        '/admin/pending-changes',
        9,
        false,
      ],
      [
        'alert',
        'security',
        'critical',
        'New sign-in to your account',
        'Signed in from a new device: iPhone 15 Pro, Abu Dhabi.',
        '/account',
        26,
        true,
      ],
      [
        'alert',
        'admin',
        'info',
        'Delegation received',
        'Majid Al Falasi delegated Aviation Compliance to you until next week.',
        '/account',
        30,
        true,
      ],
      [
        'email',
        'access',
        'info',
        'Role assigned: Dispatch Team',
        'Sent to Aisha Al Qubaisi with your request RITM0048213.',
        null,
        1.2,
        true,
      ],
      [
        'email',
        'admin',
        'info',
        'Daily source-system report',
        'SAP, Fieldglass and HSE Passport sync results for yesterday.',
        '/admin/users',
        20,
        false,
      ],
      [
        'email',
        'security',
        'warning',
        'Device blocked',
        'Huawei P40 · Ahmed Al Mansoori was blocked.',
        '/admin/devices',
        520,
        true,
      ],
    ],
    planner: [
      [
        'alert',
        'booking',
        'warning',
        'Quota nearly full',
        'Das Island contractor quota is at 22 of 24 seats for tomorrow.',
        '/admin/quotas',
        2,
        false,
      ],
      [
        'alert',
        'travel',
        'info',
        'Departure delayed',
        'ADA101 Abu Dhabi – Das Island now departs at 07:40 (weather).',
        '/scheduling',
        4,
        false,
      ],
      [
        'alert',
        'approvals',
        'info',
        'Booking waiting for approval',
        'BK-2026-018355 · Hessa Al Ketbi · AUH → UZ.',
        '/booking/approvals',
        7,
        false,
      ],
      [
        'alert',
        'freight',
        'info',
        'Freight request received',
        'FR-2026-0932 · 1.2 t spares to Zirku Island.',
        null,
        22,
        true,
      ],
      [
        'email',
        'travel',
        'info',
        'Tomorrow’s manifest',
        'Pre-manifest for 14 departures is ready to review.',
        '/scheduling',
        12,
        true,
      ],
      [
        'email',
        'admin',
        'info',
        'Delegation starts in 3 days',
        'Dispatch Power User will act for you on People Logistics.',
        '/account',
        26,
        false,
      ],
    ],
    viewer: [
      [
        'alert',
        'muster',
        'info',
        'Muster drill completed',
        'Das Island drill muster closed: 412 accounted for, none missing.',
        null,
        7,
        false,
      ],
      [
        'alert',
        'compliance',
        'warning',
        'Audit finding due',
        'ASP-2026-04 finding F-07 is due in 5 days.',
        null,
        30,
        false,
      ],
      [
        'alert',
        'helideck',
        'info',
        'HLL published',
        'The October Helideck Limitations List is published.',
        null,
        75,
        true,
      ],
      [
        'email',
        'security',
        'info',
        'Welcome to MASAR',
        'Your access as Master Data Viewer is ready.',
        null,
        600,
        true,
      ],
    ],
  };
  return PERSONAS.flatMap((p) =>
    (forPersona[p.key] ?? []).map(
      ([kind, category, severity, title, body, link, hours, read], i) => ({
        id: idFor('notification', `${p.key}:${i}`),
        userId: p.me.id,
        kind,
        title,
        body,
        link,
        category,
        severity,
        createdAt: hoursAgo(hours),
        read,
      }),
    ),
  );
}

export const PREFERENCE_CATEGORIES: {
  key: NotificationCategory;
  label: string;
  mandatory: boolean;
}[] = [
  { key: 'security', label: 'Security and sign-in', mandatory: true },
  { key: 'access', label: 'Access and roles', mandatory: true },
  { key: 'approvals', label: 'Approvals waiting for me', mandatory: false },
  { key: 'booking', label: 'Bookings', mandatory: false },
  { key: 'travel', label: 'Travel and departures', mandatory: false },
  { key: 'muster', label: 'Muster and emergency', mandatory: true },
  { key: 'freight', label: 'Freight', mandatory: false },
  { key: 'helideck', label: 'Helideck inspections', mandatory: false },
  { key: 'compliance', label: 'Audits and compliance', mandatory: false },
  { key: 'admin', label: 'Administration', mandatory: false },
];

export const defaultPreferences = (userId: string): PreferenceRow => ({
  id: userId,
  categories: PREFERENCE_CATEGORIES.map((c) => ({
    ...c,
    channels: {
      email: true,
      sms: c.key === 'muster' || c.key === 'travel',
      push: c.key !== 'admin',
    },
  })),
});

// ---------------------------------------------------------------- support articles

export function supportArticleSeeds(): SupportArticle[] {
  const a = (
    code: string,
    kind: SupportArticle['kind'],
    sortOrder: number,
    title: string,
    body: string,
  ): SupportArticle => ({
    id: idFor('support-article', code),
    code,
    kind,
    title,
    body,
    sortOrder,
    isActive: true,
    deactivatedReason: null,
    version: 1,
    updatedAt: SEEDED_AT,
  });
  return [
    a(
      'FAQ-BOOK-CUTOFF',
      'faq',
      10,
      'When is the booking cut-off?',
      'Bookings for scheduled flights close 48 hours before departure. After the cut-off, ask your site focal point: late changes need the People Logistics team.',
    ),
    a(
      'FAQ-NO-ROLE',
      'faq',
      20,
      'I can sign in but see nothing. Why?',
      'MASAR shows only what your role allows. If you hold no role yet, raise an access request in the service portal; your line manager approves it and the MASAR administrators assign the role.',
    ),
    a(
      'FAQ-HSE-PASSPORT',
      'faq',
      30,
      'My HSE Passport shows as expired',
      'HSE Passport data comes from the HSE Passport system every night. Renew it there; MASAR shows the new expiry after the next sync.',
    ),
    a(
      'FAQ-BAGGAGE',
      'faq',
      40,
      'How much baggage can I take offshore?',
      'Fixed-wing flights allow 20 kg per passenger; helicopters allow 10 kg. Excess baggage goes as freight through your site focal point.',
    ),
    a(
      'FAQ-EXTERNAL',
      'faq',
      50,
      'I work for a service provider. How do I sign in?',
      'External users sign in with their email, a password and a one-time code. Your invitation email has the first step; ask your MASAR focal point to resend it if it has expired.',
    ),
    a(
      'FAQ-OLD-PROCESS',
      'faq',
      60,
      'Can I still email the logistics desk to book?',
      'No. Since MASAR went live, every booking is raised in MASAR so it can be approved and manifested.',
    ),
    a(
      'GUIDE-BOOK',
      'guide',
      10,
      'Book a seat to an offshore site',
      '1. Open Booking → Create booking.\n2. Choose the passenger, the route and the date.\n3. Add the charge code and the reason for travel.\n4. Submit: your line manager and the site in-charge approve it.',
    ),
    a(
      'GUIDE-DELEGATE',
      'guide',
      20,
      'Hand over your approvals while you are away',
      'Open My account → Delegations, choose who acts for you, the modules and the dates. They act for you only between those dates, and every action shows it was on your behalf.',
    ),
    a(
      'GUIDE-APP',
      'guide',
      30,
      'Set up the MASAR app',
      'Install MASAR from the company portal, sign in with your ADNOC account and allow notifications. Your device appears under My account → Devices.',
    ),
  ].map((row, i) =>
    i === 5 ? { ...row, isActive: false, deactivatedReason: 'Replaced by the booking guide' } : row,
  );
}
