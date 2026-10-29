/**
 * Places and organisations seed data (Administration → Shared Masters): zones, location types,
 * locations, installations, routes, departments, companies, service providers, charge codes,
 * passenger categories, external contacts and the POB masters. Built from MASAR's demo seeds;
 * pure, so other mock areas may import the arrays and helpers.
 */
import type { components } from '../../api/schema';
import { gstDate, idFor, ref, SEEDED_AT } from './ids';
import chargeCodesJson from './seeds/charge-codes.json';
import companiesJson from './seeds/companies.json';
import departmentsJson from './seeds/departments.json';
import essentialJson from './seeds/essential-positions.json';
import fleetJson from './seeds/fleet.json';
import installationsJson from './seeds/installations.json';
import lifeboatsJson from './seeds/lifeboats.json';
import locationTypesJson from './seeds/location-types.json';
import locationsJson from './seeds/locations.json';
import musterPointsJson from './seeds/muster-points.json';
import routesJson from './seeds/routes.json';
import serviceProvidersJson from './seeds/service-providers.json';
import zonesJson from './seeds/zones.json';

type S = components['schemas'];
export type Zone = S['Zone'];
export type LocationType = S['LocationType'];
export type InstallationType = S['InstallationType'];
export type Location = S['Location'];
export type Installation = S['Installation'];
export type Route = S['Route'];
export type Attachment = S['Attachment'];
export type Department = S['Department'];
export type Company = S['Company'];
export type ServiceProvider = S['ServiceProvider'];
export type ChargeCode = S['ChargeCode'];
export type PassengerCategory = S['PassengerCategory'];
export type ExternalContact = S['ExternalContact'];
export type MusterPoint = S['MusterPoint'];
export type Lifeboat = S['Lifeboat'];
export type EssentialPosition = S['EssentialPosition'];
export type PendingMasterChange = S['PendingMasterChange'];
export type PobMaster = PendingMasterChange['master'];
export type PobAction = PendingMasterChange['action'];
export type Coordinates = NonNullable<Location['coordinates']>;
export interface Point {
  readonly lat: number;
  readonly lng: number;
}
export interface Ref {
  id: string;
  code: string;
  name: string;
}

/** One stored revision of a route's path (`GET routes/:id/revisions`). */
export interface RouteRevisionRow {
  id: string;
  routeId: string;
  revision: number;
  createdAt: string;
  createdBy: string | null;
  points: Ref[];
}

/** An installation's attached file. */
export interface InstallationFileRow extends Attachment {
  installationId: string;
}

/** One past version of an essential-position mapping (its timeline). */
export interface EssentialVersionRow {
  id: string;
  positionId: string;
  classification: EssentialPosition['classification'];
  minCount: number | null;
  criticality: EssentialPosition['criticality'];
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

/** A POB master change waiting for (or decided by) a second person, with what applies it. */
export interface PendingChangeRow extends PendingMasterChange {
  taskId: string;
  payload: Record<string, unknown>;
}

// ── Seed shapes ───────────────────────────────────────────────────────────────

interface LocationSeed {
  code: string;
  name: string;
  zone: string;
  type: string;
  focalPoint?: { name: string; email: string };
  coordinates?: Point;
  pobLimit?: number;
  residencyReset?: boolean;
  hub?: boolean;
  complex?: boolean;
  accommodation?: boolean;
}
interface InstallationSeed {
  code: string;
  name: string;
  location: string;
  type: string;
  deckClass?: string;
  dValue?: number;
  tValue?: number;
  lastOpsSurveyOn?: string;
  minPerformanceClass?: string;
  radioFrequency?: string;
  material?: string;
  coordinates?: Point;
}
interface RouteSeed {
  code: string;
  name?: string;
  points: string[];
  category: string;
  durationMinutes?: number;
  owningTeam?: string;
  isExclusive?: boolean;
}
interface MusterSeed {
  code: string;
  name: string;
  location: string;
  role: string;
  evacuationModes: string[];
  capacity?: number;
  unavailable?: { reasonCode: string; reason: string };
}
interface LifeboatSeed {
  code: string;
  name: string;
  location: string;
  ratedCapacity: number;
  station?: string;
  outOfService?: string;
  certificateExpiresOn?: string;
}
interface EssentialSeed {
  effectiveFrom: string;
  essential: string[];
  nonEssential: string[];
  overrides: { designation: string; location: string; classification: string }[];
  unmapped: { location: string; designations: string[] }[];
}

const SEED_LOCATIONS = locationsJson as readonly LocationSeed[];
const SEED_INSTALLATIONS = installationsJson as readonly InstallationSeed[];
const SEED_ROUTES = routesJson as readonly RouteSeed[];
const SEED_MUSTER = musterPointsJson as readonly MusterSeed[];
const SEED_LIFEBOATS = lifeboatsJson as readonly LifeboatSeed[];
const SEED_ESSENTIAL: EssentialSeed = essentialJson;
const SYNCED_AT = '2026-10-19T22:00:00.000Z';

const master = { isActive: true, deactivatedReason: null, version: 1, updatedAt: SEEDED_AT };
/** A stable "n hours ago"-style timestamp relative to today (GST), for seeded events. */
const gstAt = (offsetDays: number, time = '06:00') =>
  new Date(`${gstDate(offsetDays)}T${time}:00+04:00`).toISOString();

// ── Geography ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points (haversine), in kilometres. */
export function greatCircleKm(from: Point, to: Point): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A path's legs and total, rounded to 0.1 km; a point without coordinates leaves them unknown. */
export function pathDistance(points: readonly (Point | null)[]): {
  legs: (number | null)[];
  totalKm: number | null;
} {
  const legs: (number | null)[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    legs.push(from && to ? Math.round(greatCircleKm(from, to) * 10) / 10 : null);
  }
  const known = legs.length > 0 && legs.every((leg) => leg !== null);
  const total = legs.reduce<number>((sum, leg) => sum + (leg ?? 0), 0);
  return { legs, totalKm: known ? Math.round(total * 10) / 10 : null };
}

/** A small, stable offset (±0.02°) so an installation sits near its location. */
const nudge = (code: string, part: number) =>
  (parseInt(idFor('installation', code).slice(part * 4, part * 4 + 4), 16) / 0xffff) * 0.04 - 0.02;

// ── Zones, types ──────────────────────────────────────────────────────────────

export const ZONES: Zone[] = (zonesJson as readonly { code: string; name: string }[]).map((z) => ({
  id: idFor('zone', z.code),
  code: z.code,
  name: z.name,
  ...master,
}));

const LOCATION_TYPE_SEEDS = [
  ...(locationTypesJson as readonly { code: string; name: string; offshore?: boolean }[]).map(
    (t) => ({ ...t, mobile: false }),
  ),
  { code: 'MOBILE-RIG', name: 'Mobile rig / barge', offshore: true, mobile: true },
];

export const LOCATION_TYPES: LocationType[] = LOCATION_TYPE_SEEDS.map((t) => ({
  id: idFor('location-type', t.code),
  code: t.code,
  name: t.name,
  isMobile: t.mobile,
  isOffshore: t.offshore === true,
  ...master,
}));

export const INSTALLATION_TYPES: InstallationType[] = [
  { code: 'HELIDECK', name: 'Helideck' },
  { code: 'HELIPAD', name: 'Helipad' },
].map((t) => ({ id: idFor('installation-type', t.code), ...t, ...master }));

// ── Locations ─────────────────────────────────────────────────────────────────

const PARENTS: Readonly<Record<string, string>> = { 'ZRK-Z1': 'ZRK', 'ZRK-Z2': 'ZRK' };
const nameOf = (code: string) => SEED_LOCATIONS.find((l) => l.code === code)?.name ?? code;

/** `{ id, code, name }` of a seeded location (the shared id convention). */
export const locationRef = (code: string): Ref => ref('location', code, nameOf(code));

/** Where GIS says a seeded location is (used by "VIA GIS"). */
export const locationGis = (code: string): Point | null =>
  SEED_LOCATIONS.find((l) => l.code === code)?.coordinates ?? null;

export const LOCATIONS: Location[] = SEED_LOCATIONS.map((l) => {
  const type = LOCATION_TYPES.find((t) => t.code === l.type);
  const zone = ZONES.find((z) => z.code === l.zone);
  const parent = PARENTS[l.code];
  const outOfService = l.code === 'SRB';
  return {
    id: idFor('location', l.code),
    code: l.code,
    name: l.name,
    locationType: {
      id: idFor('location-type', l.type),
      code: l.type,
      name: type?.name ?? l.type,
      isMobile: type?.isMobile ?? false,
      isOffshore: type?.isOffshore ?? false,
    },
    zone: ref('zone', l.zone, zone?.name ?? l.zone),
    parent: parent ? locationRef(parent) : null,
    subLocations: Object.values(PARENTS).filter((p) => p === l.code).length,
    coordinates: l.coordinates
      ? { ...l.coordinates, source: 'integration', syncedAt: SYNCED_AT }
      : null,
    pobLimit: l.pobLimit ?? null,
    isHub: l.hub === true,
    isResidencyReset: l.residencyReset === true,
    isComplex: l.complex === true,
    hasAccommodation: l.accommodation === true,
    focalPointName: l.focalPoint?.name ?? null,
    focalPointEmail: l.focalPoint?.email ?? null,
    isServiceable: !outOfService,
    unserviceableReasonCode: outOfService ? 'LOC-WEATHER' : null,
    unserviceableReason: outOfService
      ? 'Jetty and helipad damaged in the shamal; repairs under way'
      : null,
    unserviceableSince: outOfService ? gstAt(-2, '07:30') : null,
    ...master,
  };
});

// ── Installations ─────────────────────────────────────────────────────────────

const DRAFTS = new Set(['AL-GURM', 'UAD-CPC', 'AL-BZOOM']);
const DEMOBILISED = 'DLS-4200';
const OUT_OF_SERVICE = 'UZ-STP-HD';
const REFUELLING = new Set(['DAS-HD-A', 'ZRK-HD', 'UZ-HUB-HD', 'LZ-CPP-HD', 'US-SUHUB-HD']);
const OPERATORS: readonly [string, string][] = [
  ['ALLIANZ', 'Allianz Marine'],
  ['SAIPEM', 'Saipem'],
  ['AMS', 'Al Masaood Marine'],
  ['DLS', 'NMDC Energy'],
  ['OML', 'OML Marine'],
  ['CREST', 'Crest Energy'],
];
/** Where GIS has installations the register lacks a position for. */
const INSTALLATION_GIS: Readonly<Record<string, Point>> = {
  'UAD-CPC': { lat: 24.812, lng: 52.874 },
};

function installationPoint(i: InstallationSeed): Point | null {
  if (i.coordinates) return i.coordinates;
  const at = locationGis(i.location);
  if (!at) return null;
  return {
    lat: Math.round((at.lat + nudge(i.code, 0)) * 1e6) / 1e6,
    lng: Math.round((at.lng + nudge(i.code, 1)) * 1e6) / 1e6,
  };
}

/** Where GIS says a seeded installation is. */
export const installationGis = (code: string): Point | null => {
  const seeded = SEED_INSTALLATIONS.find((i) => i.code === code);
  if (!seeded) return null;
  return INSTALLATION_GIS[code] ?? installationPoint(seeded);
};

/** What an active installation must have (spec 10 §5.1). */
export function activationMissing(
  i: Pick<Installation, 'dValue' | 'tValue' | 'gcaaClassOfUse' | 'elevationM' | 'coordinates'>,
): Installation['activationMissing'] {
  const missing: Installation['activationMissing'] = [];
  if (i.dValue === null) missing.push('dValue');
  if (i.tValue === null) missing.push('tValue');
  if (i.gcaaClassOfUse === null) missing.push('gcaaClassOfUse');
  if (i.elevationM === null) missing.push('elevationM');
  if (i.coordinates === null) missing.push('coordinates');
  return missing;
}

export const INSTALLATION_FILES: InstallationFileRow[] = [
  ['GHWEIFAT', 'GHWEIFAT helideck survey 2026.pdf', '2026-05-12'],
  ['DAS-HD-A', 'Das Alpha helideck certificate.pdf', '2026-02-03'],
  ['DAS-HD-A', 'Das Alpha obstacle plate.png', '2026-02-03'],
  ['UZ-HUB-HD', 'UZ Hub helideck limitations list.pdf', '2026-06-21'],
  ['CHANANIZ', 'GOP Island helipad survey.pdf', '2025-12-15'],
].map(([code = '', fileName = '', on = ''], n) => ({
  id: idFor('file', `${code}:${n}`),
  installationId: idFor('installation', code),
  purpose: 'installation-document',
  fileName,
  mimeType: fileName.endsWith('.png') ? 'image/png' : 'application/pdf',
  sizeBytes: 182_000 + n * 47_313,
  sha256: idFor('sha', fileName).replace(/-/g, '').padEnd(64, '0'),
  scanStatus: 'clean',
  uploadedAt: `${on}T08:15:00.000Z`,
  attached: true,
  download: null,
}));

export const INSTALLATIONS: Installation[] = SEED_INSTALLATIONS.map((i, n) => {
  const location = SEED_LOCATIONS.find((l) => l.code === i.location);
  const type = INSTALLATION_TYPES.find((t) => t.code === i.type);
  const point = DRAFTS.has(i.code) ? null : installationPoint(i);
  const helipad = i.type === 'HELIPAD';
  const draft = DRAFTS.has(i.code);
  const unconfirmed = (i.lastOpsSurveyOn ?? '9999') < '2025-06-01';
  const record: Installation = {
    id: idFor('installation', i.code),
    code: i.code,
    name: i.name,
    callsign: null,
    installationType: ref('installation-type', i.type, type?.name ?? i.type),
    location: { ...locationRef(i.location), isMobile: false },
    material: i.material ?? (helipad ? 'Concrete' : 'Aluminium'),
    dValue: i.dValue ?? null,
    tValue: i.tValue ?? null,
    gcaaClassOfUse: i.code === 'AL-BZOOM' ? null : helipad ? 'Day only' : 'Day/Night',
    elevationM: helipad ? 4 + (n % 3) : 24 + ((n * 7) % 21),
    coordinates: point ? { ...point, source: 'integration', syncedAt: SYNCED_AT } : null,
    deckClass: i.deckClass ?? null,
    minPerformanceClass: i.minPerformanceClass ?? (location?.hub ? 'PC2WE' : null),
    radioFrequency: i.radioFrequency ?? null,
    deckHeightFt: helipad ? null : 80 + ((n * 13) % 70),
    ndb: null,
    heading: null,
    statusLights: !helipad,
    firefighting: helipad ? 'Portable extinguishers' : 'DIFFS foam monitors',
    fuelAvailable: REFUELLING.has(i.code),
    gpuAvailable: REFUELLING.has(i.code),
    operator: OPERATORS.find(([prefix]) => i.code.startsWith(prefix))?.[1] ?? 'ADNOC Offshore',
    riskLevel: (i.tValue ?? 12) < 6 ? 'high' : helipad ? 'medium' : 'low',
    lastOpsSurveyOn: i.lastOpsSurveyOn ?? null,
    unconfirmedFields: unconfirmed ? ['gcaaClassOfUse', 'elevationM'] : [],
    activationMissing: [],
    isServiceable: i.code !== OUT_OF_SERVICE,
    unserviceableReasonCode: i.code === OUT_OF_SERVICE ? 'INST-MAINT' : null,
    unserviceableReason:
      i.code === OUT_OF_SERVICE ? 'Deck net and tie-down replacement; NOTAM issued' : null,
    unserviceableSince: i.code === OUT_OF_SERVICE ? gstAt(-1, '09:00') : null,
    status: draft ? 'draft' : i.code === DEMOBILISED ? 'deactivated' : 'active',
    isActive: !draft && i.code !== DEMOBILISED,
    activatedAt: draft ? null : '2026-01-15T06:00:00.000Z',
    deactivatedReason: i.code === DEMOBILISED ? 'Vessel demobilised from Ghasha' : null,
    attachments: INSTALLATION_FILES.filter(
      (f) => f.installationId === idFor('installation', i.code),
    ).length,
    version: 1,
    updatedAt: SEEDED_AT,
  };
  return { ...record, activationMissing: activationMissing(record) };
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** A point on a route, as its location stands. */
export interface RoutePoint extends Ref {
  coordinates: Point | null;
}

/** A route's derived fields from its ordered points. */
export function routePath(name: string | null, points: readonly RoutePoint[]) {
  const path = points.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    hasCoordinates: p.coordinates !== null,
  }));
  const { legs, totalKm } = pathDistance(points.map((p) => p.coordinates));
  const first = path[0];
  const last = path.at(-1);
  return {
    name,
    displayName: name ?? path.map((p) => p.name).join(' → '),
    origin: { id: first?.id ?? '', code: first?.code ?? '', name: first?.name ?? '' },
    destination: { id: last?.id ?? '', code: last?.code ?? '', name: last?.name ?? '' },
    points: path,
    legs,
    distanceKm: totalKm,
  };
}

const seededPoint = (code: string): RoutePoint => ({
  ...locationRef(code),
  coordinates: locationGis(code),
});

const EXTRA_ROUTES: readonly (RouteSeed & { deactivated?: string })[] = [
  {
    code: 'DAS-ZAKUM-LOOP',
    name: 'Zakum Field Shuttle',
    points: ['DAS', 'UZ', 'LZ', 'ACPT', 'DAS'],
    category: 'ROTARY-WING',
    durationMinutes: 115,
    owningTeam: 'Das Island Logistics',
    isExclusive: true,
  },
  {
    code: 'ZRK-NASR-ABK-RW',
    points: ['ZRK', 'NASR', 'ABK'],
    category: 'ROTARY-WING',
    durationMinutes: 55,
    owningTeam: 'NASR Logistics',
    deactivated: 'Superseded by ZRK-NASR-RW and the ABK crew-change slot',
  },
];

/** Routes whose path was changed once: their first revision's path. */
const EARLIER_PATHS: Readonly<Record<string, string[]>> = {
  'AUH-ACPT-MAR': ['AUH', 'UZ', 'ACPT'],
  'ACPT-AUH-MAR': ['ACPT', 'UZ', 'AUH'],
  'DAS-ZAKUM-LOOP': ['DAS', 'UZ', 'LZ', 'DAS'],
};

const ALL_ROUTE_SEEDS: readonly (RouteSeed & { deactivated?: string })[] = [
  ...SEED_ROUTES,
  ...EXTRA_ROUTES,
];

export const ROUTES: Route[] = ALL_ROUTE_SEEDS.map((r) => {
  const deactivated = r.deactivated ?? null;
  return {
    id: idFor('route', r.code),
    code: r.code,
    ...routePath(r.name ?? null, r.points.map(seededPoint)),
    resourceCategory: r.category,
    durationMinutes: r.durationMinutes ?? null,
    isExclusive: r.isExclusive === true,
    owningTeam: r.owningTeam ?? null,
    revision: EARLIER_PATHS[r.code] ? 2 : 1,
    isActive: deactivated === null,
    deactivatedReason: deactivated,
    version: EARLIER_PATHS[r.code] ? 2 : 1,
    updatedAt: SEEDED_AT,
  };
});

export const ROUTE_REVISIONS: RouteRevisionRow[] = ROUTES.flatMap((r) => {
  const earlier = EARLIER_PATHS[r.code];
  const first: RouteRevisionRow = {
    id: idFor('route-revision', `${r.code}:1`),
    routeId: r.id,
    revision: 1,
    createdAt: '2026-01-10T05:00:00.000Z',
    createdBy: 'Admin User',
    points: earlier
      ? earlier.map(locationRef)
      : r.points.map(({ id, code, name }) => ({ id, code, name })),
  };
  if (!earlier) return [first];
  return [
    {
      id: idFor('route-revision', `${r.code}:2`),
      routeId: r.id,
      revision: 2,
      createdAt: gstAt(-21, '10:40'),
      createdBy: 'Aviation Control',
      points: r.points.map(({ id, code, name }) => ({ id, code, name })),
    },
    first,
  ];
});

/** The demo's resource categories, when the resources area has none stored. */
export const DEFAULT_CATEGORIES: S['ResourceCategoryOption'][] = [
  { code: 'FIXED-WING', name: 'Fixed wing', weightUnit: 'kg', baseMode: 'fixed-wing' },
  { code: 'ROTARY-WING', name: 'Rotary wing', weightUnit: 'lb', baseMode: 'rotary-wing' },
  { code: 'MARINE', name: 'Marine', weightUnit: 'kg', baseMode: 'marine' },
];

// ── Organisations ─────────────────────────────────────────────────────────────

const PROVIDER_CONTACTS: Readonly<Record<string, [string, string]>> = {
  ADA: ['Capt. Omar Haddad', '+971 2 575 8000'],
  FAL: ['Daniel Mercer', '+971 2 445 2020'],
  AML: ['Yusuf Rahman', '+971 2 602 7777'],
  GDS: ['Ahmed Karim', '+971 2 671 3344'],
};
const fleetOf = (provider: string) =>
  (fleetJson as readonly { provider: string }[]).filter((f) => f.provider === provider).length;

export const SERVICE_PROVIDERS: ServiceProvider[] = (
  serviceProvidersJson as readonly {
    code: string;
    legalName: string;
    type: ServiceProvider['providerType'];
    contactEmail?: string;
  }[]
).map((p) => ({
  id: idFor('service-provider', p.code),
  code: p.code,
  legalName: p.legalName,
  providerType: p.type,
  contactName: PROVIDER_CONTACTS[p.code]?.[0] ?? null,
  contactEmail: p.contactEmail ?? null,
  contactPhone: PROVIDER_CONTACTS[p.code]?.[1] ?? null,
  fleet: fleetOf(p.code),
  contacts: 0,
  ...master,
}));

const providerName = (code: string) =>
  SERVICE_PROVIDERS.find((p) => p.code === code)?.legalName ?? code;
/** `{ id, code, name }` of a service provider (the name is its legal name). */
export const providerRef = (code: string): Ref => ref('service-provider', code, providerName(code));

const DEPARTMENT_PARENTS: Readonly<Record<string, string>> = {
  AVT: 'AVL',
  AVC: 'AVL',
  SITE: 'OPS',
  MNT: 'OPS',
};
const DEPARTMENT_PEOPLE: Readonly<Record<string, number>> = {
  AVL: 42,
  OPS: 318,
  HSE: 27,
  MNT: 96,
  QA: 14,
  AVT: 18,
  AVC: 9,
  MGT: 12,
  SITE: 6,
};
const SEED_DEPARTMENTS = departmentsJson as readonly { code: string; name: string }[];
const departmentName = (code: string) =>
  SEED_DEPARTMENTS.find((d) => d.code === code)?.name ?? code;
export const departmentRef = (code: string): Ref => ref('department', code, departmentName(code));

export const DEPARTMENTS: Department[] = SEED_DEPARTMENTS.map((d) => {
  const parent = DEPARTMENT_PARENTS[d.code];
  const manual = d.code === 'SITE';
  return {
    id: idFor('department', d.code),
    code: d.code,
    name: d.name,
    parent: parent ? departmentRef(parent) : null,
    source: manual ? 'manual' : 'sap',
    syncedAt: manual ? null : SYNCED_AT,
    people: DEPARTMENT_PEOPLE[d.code] ?? 0,
    ...master,
  };
});

const COMPANY_PEOPLE: Readonly<Record<string, number>> = {
  'ADNOC-OFF': 1240,
  GOE: 186,
  ADA: 58,
  FAL: 34,
  AML: 72,
  GDS: 6,
};
export const COMPANIES: Company[] = (
  companiesJson as readonly {
    code: string;
    name: string;
    source: Company['source'];
    serviceProvider?: string;
  }[]
).map((c) => ({
  id: idFor('company', c.code),
  code: c.code,
  name: c.name,
  source: c.source,
  serviceProvider: c.serviceProvider ? providerRef(c.serviceProvider) : null,
  syncedAt: c.source === 'external' ? null : SYNCED_AT,
  people: COMPANY_PEOPLE[c.code] ?? 0,
  ...master,
}));

const CHARGE_EXTRAS: Readonly<
  Record<string, { sites?: string[]; department?: string; validTo?: string }>
> = {
  '1': { department: 'OPS' },
  '2': { department: 'MGT' },
  '3': { department: 'AVL' },
  '4': { sites: ['DAS', 'ZRK', 'UZ', 'LZ', 'US'], department: 'OPS' },
  '5': { department: 'OPS' },
  '6': { department: 'HSE' },
  '7': { sites: ['DAS', 'ZRK'], department: 'AVC', validTo: '2026-12-31' },
  '8': { department: 'HSE' },
};
export const CHARGE_CODES: ChargeCode[] = (
  chargeCodesJson as readonly {
    code: string;
    description: string;
    recoverability: ChargeCode['recoverability'];
  }[]
).map((c) => {
  const extra = CHARGE_EXTRAS[c.code] ?? {};
  return {
    id: idFor('charge-code', c.code),
    code: c.code,
    description: c.description,
    allSites: !extra.sites,
    sites: (extra.sites ?? []).map(locationRef),
    recoverability: c.recoverability,
    validFrom: '2026-01-01',
    validTo: extra.validTo ?? null,
    owningDepartment: extra.department ? departmentRef(extra.department) : null,
    ...master,
  };
});

const CATEGORY_SEEDS: readonly [
  string,
  string,
  PassengerCategory['icon'],
  PassengerCategory['colour'],
  string,
][] = [
  ['VIP', 'VIP', 'crown', '#7E22CE', 'VIP'],
  ['EP', 'EP', 'star', '#DC2626', 'EP'],
  ['DH', 'Direct Hire', 'refresh-cw', '#1D4ED8', 'Direct Hire'],
  ['EST-POS', 'Established Position', 'briefcase', '#0EA5E9', 'Established Position'],
  ['CON', 'Contractor', 'hard-hat', '#F59E0B', 'Contractor'],
  ['RADAR', 'Radar-NGCPA', 'radar', '#16A34A', 'Radar/NGCPA'],
  ['VIS', 'Visitor', 'user-round', '#7E22CE', 'Visitor'],
  ['GEN', 'General', 'user', '#64748B', 'General'],
];
export const PASSENGER_CATEGORIES: PassengerCategory[] = CATEGORY_SEEDS.map(
  ([code, name, icon, colour, sourceMapping], index) => ({
    id: idFor('passenger-category', code),
    code,
    name,
    icon,
    colour,
    priorityRank: index + 1,
    seatForward: code === 'VIP',
    sourceMapping,
    isCrewChange: code === 'DH',
    ...master,
  }),
);

const CONTACT_SEEDS: readonly {
  provider: string;
  name: string;
  email: string;
  designation: string;
  gender: 'M' | 'F';
  nationality: string;
  user?: 'invited' | 'active';
  left?: string;
}[] = [
  {
    provider: 'ADA',
    name: 'Omar Haddad',
    email: 'omar.haddad@ada.masar.example',
    designation: 'Chief Pilot',
    gender: 'M',
    nationality: 'Jordanian',
    user: 'active',
  },
  {
    provider: 'ADA',
    name: 'Leila Farouk',
    email: 'leila.farouk@ada.masar.example',
    designation: 'Operations Coordinator',
    gender: 'F',
    nationality: 'Egyptian',
    user: 'invited',
  },
  {
    provider: 'ADA',
    name: 'Rajesh Menon',
    email: 'rajesh.menon@ada.masar.example',
    designation: 'Load Controller',
    gender: 'M',
    nationality: 'Indian',
  },
  {
    provider: 'FAL',
    name: 'Daniel Mercer',
    email: 'daniel.mercer@fal.masar.example',
    designation: 'Flight Operations Manager',
    gender: 'M',
    nationality: 'British',
    user: 'active',
  },
  {
    provider: 'FAL',
    name: 'Priya Nair',
    email: 'priya.nair@fal.masar.example',
    designation: 'Crew Scheduler',
    gender: 'F',
    nationality: 'Indian',
  },
  {
    provider: 'FAL',
    name: 'Marco Bianchi',
    email: 'marco.bianchi@fal.masar.example',
    designation: 'Duty Dispatcher',
    gender: 'M',
    nationality: 'Italian',
    user: 'active',
    left: 'Left Falcon Aviation',
  },
  {
    provider: 'AML',
    name: 'Yusuf Rahman',
    email: 'yusuf.rahman@aml.masar.example',
    designation: 'Marine Superintendent',
    gender: 'M',
    nationality: 'Emirati',
    user: 'active',
  },
  {
    provider: 'AML',
    name: 'Grace Okafor',
    email: 'grace.okafor@aml.masar.example',
    designation: 'Vessel Coordinator',
    gender: 'F',
    nationality: 'Nigerian',
  },
  {
    provider: 'GDS',
    name: 'Ahmed Karim',
    email: 'ahmed.karim@gulfdeck.masar.example',
    designation: 'HLO Trainer',
    gender: 'M',
    nationality: 'Pakistani',
    user: 'invited',
  },
];
export const EXTERNAL_CONTACTS: ExternalContact[] = CONTACT_SEEDS.map((c, n) => ({
  id: idFor('external-contact', c.email),
  personnelNo: `EXT-${String(4101 + n).padStart(6, '0')}`,
  displayName: c.name,
  email: c.email,
  serviceProvider: providerRef(c.provider),
  designation: c.designation,
  phone: `+971 50 ${String(311 + n * 47).padStart(3, '0')} ${String(2040 + n * 311).slice(-4)}`,
  gender: c.gender,
  nationality: c.nationality,
  hsePassportNo: c.user ? `HSE-${String(712040 + n * 17)}` : null,
  activatedAt: c.user ? gstAt(-40 + n, '08:00') : null,
  user: c.user ? { id: idFor('user', c.email), status: c.left ? 'deactivated' : c.user } : null,
  isActive: !c.left,
  deactivatedReason: c.left ?? null,
  version: 1,
  updatedAt: SEEDED_AT,
}));
for (const p of SERVICE_PROVIDERS) {
  p.contacts = EXTERNAL_CONTACTS.filter((c) => c.serviceProvider.id === p.id && c.isActive).length;
}

// ── POB masters ───────────────────────────────────────────────────────────────

const INSTALLATION_AT_MUSTER: Readonly<Record<string, string>> = {
  'DAS-MA': 'DAS-HD-A',
  'UZ-MA': 'UZ-HUB-HD',
  'LZ-MA': 'LZ-CPP-HD',
  'GHF-MA': 'CHANANIZ',
  'ACPT-MA': 'ACPT-HD',
};
const installationRef = (code: string) =>
  ref('installation', code, SEED_INSTALLATIONS.find((i) => i.code === code)?.name ?? code);

export const MUSTER_POINTS: MusterPoint[] = SEED_MUSTER.map((m) => {
  const at = INSTALLATION_AT_MUSTER[m.code];
  return {
    id: idFor('muster-point', m.code),
    code: m.code,
    name: m.name,
    location: locationRef(m.location),
    installation: at ? installationRef(at) : null,
    role: m.role === 'alternate' ? 'alternate' : 'primary',
    capacity: m.capacity ?? null,
    evacuationModes: m.evacuationModes as MusterPoint['evacuationModes'],
    isOperational: !m.unavailable,
    unavailableReasonCode: m.unavailable?.reasonCode ?? null,
    unavailableReason: m.unavailable?.reason ?? null,
    unavailableSince: m.unavailable ? gstAt(-3, '05:30') : null,
    pendingChange: null,
    ...master,
  };
});

export const LIFEBOATS: Lifeboat[] = SEED_LIFEBOATS.map((b, n) => ({
  id: idFor('lifeboat', b.code),
  code: b.code,
  name: b.name,
  location: locationRef(b.location),
  craftType: 'lifeboat',
  station: b.station ?? null,
  ratedCapacity: b.ratedCapacity,
  certificateExpiresOn: b.certificateExpiresOn ?? null,
  isInService: !b.outOfService,
  outOfServiceReason: b.outOfService ?? null,
  outOfServiceSince: b.outOfService ? gstAt(-(4 + (n % 5)), '07:00') : null,
  pendingChange: null,
  ...master,
}));

const HIGH_CRITICALITY = new Set([
  'Operations Supervisor',
  'HLO',
  'Master / Captain',
  'Response Coordinator',
]);
const offshoreSites = SEED_LOCATIONS.filter(
  (l) => LOCATION_TYPES.find((t) => t.code === l.type)?.isOffshore,
).map((l) => l.code);

/** Every designation the essential-position master knows. */
export const DESIGNATIONS: readonly string[] = [
  ...SEED_ESSENTIAL.essential,
  ...SEED_ESSENTIAL.nonEssential,
];

export const essentialId = (location: string, designation: string) =>
  idFor('essential-position', `${location}:${designation}`);

export const ESSENTIAL_POSITIONS: EssentialPosition[] = offshoreSites.flatMap((site) => {
  const left = SEED_ESSENTIAL.unmapped.find((u) => u.location === site)?.designations ?? [];
  return DESIGNATIONS.filter((d) => !left.includes(d)).map((designation) => {
    const standard = SEED_ESSENTIAL.essential.includes(designation) ? 'essential' : 'non-essential';
    const override = SEED_ESSENTIAL.overrides.find(
      (o) => o.location === site && o.designation === designation,
    );
    const classification = (override?.classification ??
      standard) as EssentialPosition['classification'];
    const essential = classification === 'essential';
    return {
      id: essentialId(site, designation),
      designation,
      location: locationRef(site),
      classification,
      minCount: essential ? 1 : null,
      criticality: essential ? (HIGH_CRITICALITY.has(designation) ? 'high' : 'medium') : null,
      notes: override ? 'Site override of the standard classification' : null,
      effectiveFrom: SEED_ESSENTIAL.effectiveFrom,
      inForce: true,
      pendingChange: null,
      ...master,
    };
  });
});

export const ESSENTIAL_VERSIONS: EssentialVersionRow[] = [
  {
    id: idFor('essential-version', 'DAS:Catering Supervisor'),
    positionId: essentialId('DAS', 'Catering Supervisor'),
    classification: 'non-essential',
    minCount: null,
    criticality: null,
    notes: null,
    effectiveFrom: '2025-01-01',
    effectiveTo: SEED_ESSENTIAL.effectiveFrom,
    isActive: true,
  },
];

const REQUESTER = { id: idFor('user', 'fatima.alhashmi'), name: 'Fatima Al Hashmi' };

function change(
  n: number,
  master: PobMaster,
  action: PobAction,
  record: Ref,
  location: Ref,
  detail: Partial<PendingChangeRow> & Pick<PendingChangeRow, 'summary' | 'after' | 'payload'>,
): PendingChangeRow {
  return {
    id: idFor('pending-change', String(n)),
    ref: `PMC-2026-${String(n).padStart(4, '0')}`,
    master,
    action,
    record,
    location,
    batchId: null,
    reason: null,
    before: null,
    status: 'pending',
    requestedBy: REQUESTER,
    requestedAt: gstAt(-1, '11:20'),
    decidedAt: null,
    decisionNote: null,
    approvalId: idFor('approval', String(n)),
    myTask: null,
    canWithdraw: false,
    version: 1,
    taskId: idFor('approval-task', String(n)),
    ...detail,
  };
}

const crane = ESSENTIAL_POSITIONS.find((e) => e.id === essentialId('UZ', 'Crane Operator'));

export const PENDING_CHANGES: PendingChangeRow[] = [
  change(
    41,
    'lifeboats',
    'return-to-use',
    { ...ref('lifeboat', 'DAS-LB1', 'Boat 1') },
    locationRef('DAS'),
    {
      summary: 'Return DAS-LB1 · Boat 1 to service',
      reason: 'Annual maintenance complete; davit load test passed',
      before: { isInService: false },
      after: { isInService: true },
      payload: {},
    },
  ),
  change(
    42,
    'muster-points',
    'update',
    ref('muster-point', 'ZRK-MB', 'Muster B — Camp'),
    locationRef('ZRK'),
    {
      summary: 'Change ZRK-MB · Muster B — Camp: capacity 90 → 110',
      reason: 'Camp extension commissioned',
      before: { capacity: 90 },
      after: { capacity: 110 },
      payload: { capacity: 110 },
      requestedAt: gstAt(-2, '14:05'),
    },
  ),
  change(
    43,
    'essential-positions',
    'update',
    { id: crane?.id ?? '', code: 'Crane Operator', name: 'Crane Operator' },
    locationRef('UZ'),
    {
      summary: 'Change Crane Operator at Upper Zakum: minimum 1 → 2',
      reason: 'Two cranes running during the RP-3 campaign',
      before: { minCount: 1 },
      after: { minCount: 2, effectiveFrom: gstDate(7) },
      payload: { minCount: 2, effectiveFrom: gstDate(7) },
      requestedAt: gstAt(0, '08:45'),
    },
  ),
  change(38, 'lifeboats', 'update', ref('lifeboat', 'UZ-LB2', 'Boat 2'), locationRef('UZ'), {
    summary: 'Change UZ-LB2 · Boat 2: rated capacity 50 → 55',
    reason: 'Manufacturer re-rating',
    before: { ratedCapacity: 50 },
    after: { ratedCapacity: 55 },
    payload: { ratedCapacity: 55 },
    status: 'returned',
    requestedAt: gstAt(-9, '10:00'),
    decidedAt: gstAt(-8, '13:30'),
    decisionNote:
      'The current certificate still states 50 persons; attach the re-rating certificate.',
  }),
  change(
    35,
    'muster-points',
    'create',
    ref('muster-point', 'ACPT-MB', 'Muster B — Living Quarters'),
    locationRef('ACPT'),
    {
      summary: 'Add ACPT-MB · Muster B — Living Quarters',
      after: { code: 'ACPT-MB', name: 'Muster B — Living Quarters', role: 'alternate' },
      payload: {},
      status: 'withdrawn',
      requestedAt: gstAt(-15, '09:10'),
      decidedAt: gstAt(-14, '16:00'),
      decisionNote: 'Raised at the wrong site',
    },
  ),
];

/** Records with a change waiting carry it, so their pages show "pending". */
for (const c of PENDING_CHANGES.filter((p) => p.status === 'pending')) {
  const marker = { id: c.id, ref: c.ref, action: c.action };
  const rows: { id: string; pendingChange: unknown }[] =
    c.master === 'lifeboats'
      ? LIFEBOATS
      : c.master === 'muster-points'
        ? MUSTER_POINTS
        : ESSENTIAL_POSITIONS;
  const row = rows.find((r) => r.id === c.record?.id);
  if (row) row.pendingChange = marker;
}
