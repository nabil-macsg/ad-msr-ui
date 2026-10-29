import type { components } from '../../api/schema';
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
import { listRows, type ListSpec } from '../core/list';
import { masterCrud as sharedCrud, type MasterRow, type MasterSpec } from '../core/masters';
import { route } from '../core/router';
import { all, find, insert, newId, now, removeRow, replace, seed } from '../core/store';
import { gstDate } from '../data/ids';
import {
  activationMissing,
  CHARGE_CODES,
  type ChargeCode,
  COMPANIES,
  type Company,
  type Coordinates,
  DEFAULT_CATEGORIES,
  DEPARTMENTS,
  type Department,
  DESIGNATIONS,
  ESSENTIAL_POSITIONS,
  ESSENTIAL_VERSIONS,
  type EssentialPosition,
  type EssentialVersionRow,
  EXTERNAL_CONTACTS,
  type ExternalContact,
  INSTALLATION_FILES,
  INSTALLATION_TYPES,
  type Installation,
  type InstallationFileRow,
  installationGis,
  INSTALLATIONS,
  type InstallationType,
  LIFEBOATS,
  type Lifeboat,
  type Location,
  locationGis,
  LOCATION_TYPES,
  LOCATIONS,
  type LocationType,
  MUSTER_POINTS,
  type MusterPoint,
  PASSENGER_CATEGORIES,
  type PassengerCategory,
  PENDING_CHANGES,
  type PendingChangeRow,
  type PendingMasterChange,
  type PobAction,
  type PobMaster,
  type Point,
  type Ref,
  type Route,
  ROUTE_REVISIONS,
  routePath,
  type RouteRevisionRow,
  ROUTES,
  SERVICE_PROVIDERS,
  type ServiceProvider,
  type Zone,
  ZONES,
} from '../data/places';
import { currentPersona } from '../demo-auth';

/**
 * Places and organisations (Administration → Shared Masters): zones, location and installation
 * types, locations, installations, routes (with revisions), departments, companies, service
 * providers, charge codes, passenger categories, external contacts, and the POB masters (muster
 * points, lifeboats, essential positions), whose changes wait for a second person's approval.
 */

const M = '/api/v1/masters';
type Body = Record<string, unknown>;
type Versioned = { id: string; version: number; isActive: boolean };
/** A collection's name, carrying its row type. */
type Table<T> = string & { readonly row?: T };
const TABLES = {
  zones: 'zones' as Table<Zone>,
  locationTypes: 'location-types' as Table<LocationType>,
  installationTypes: 'installation-types' as Table<InstallationType>,
  locations: 'locations' as Table<Location>,
  installations: 'installations' as Table<Installation>,
  routes: 'routes' as Table<Route>,
  departments: 'departments' as Table<Department>,
  companies: 'companies' as Table<Company>,
  serviceProviders: 'service-providers' as Table<ServiceProvider>,
  externalContacts: 'external-contacts' as Table<ExternalContact>,
  musterPoints: 'muster-points' as Table<MusterPoint>,
  lifeboats: 'lifeboats' as Table<Lifeboat>,
};

/** A copy of a row without some of its fields. */
function without<T extends object, K extends keyof T>(row: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !keys.includes(key as K)),
  ) as Omit<T, K>;
}

// ── Shared validation ─────────────────────────────────────────────────────────

function invalid(fields: Record<string, string>, message = 'Some fields need attention.'): never {
  throw new MockError(422, 'VALIDATION_FAILED', message, { fields });
}

function rule(code: string, message: string, details?: unknown): never {
  throw new MockError(422, code, message, details);
}

const has = (b: Body, key: string) => Object.prototype.hasOwnProperty.call(b, key);
const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function codeOf(b: Body, max: number): string {
  const code = required(b.code, 'code').toUpperCase();
  if (!new RegExp(`^[A-Z0-9][A-Z0-9-]{0,${max - 1}}$`).test(code)) {
    invalid({ code: `Use up to ${max} letters, digits and hyphens.` });
  }
  return code;
}

function numberOf(v: unknown, field: string, opts: { positive?: boolean; integer?: boolean } = {}) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || (opts.positive && n <= 0) || (opts.integer && !Number.isInteger(n))) {
    invalid({ [field]: opts.integer ? 'Enter a whole number above zero' : 'Enter a valid number' });
  }
  return n;
}

function oneOf<T extends string>(v: unknown, field: string, values: readonly T[]): T {
  if (typeof v !== 'string' || !values.includes(v as T)) invalid({ [field]: 'Choose a value' });
  return v as T;
}

function emailOf(v: unknown, field: string): string | null {
  const email = text(v);
  if (email && !EMAIL.test(email)) invalid({ [field]: 'Enter a valid email address' });
  return email;
}

function dateOf(v: unknown, field: string): string | null {
  const date = text(v);
  if (date && !DATE.test(date)) invalid({ [field]: 'Enter a date' });
  return date;
}

/** An active record a body refers to, by id. */
function activeRef<T extends { id: string; isActive: boolean }>(
  collection: Table<T>,
  id: unknown,
  field: string,
  noun: string,
): T {
  const row = typeof id === 'string' ? find<T>(collection, id) : undefined;
  if (!row) invalid({ [field]: `Choose a ${noun}` });
  if (!row.isActive) {
    rule('REFERENCE_INACTIVE', `Choose an active ${noun}.`, { fields: { [field]: 'Deactivated' } });
  }
  return row;
}

const refOf = (r: { id: string; code: string; name: string }): Ref => ({
  id: r.id,
  code: r.code,
  name: r.name,
});

/** The record a change is for, checked against `If-Match`. */
function current<T extends { id: string; version: number }>(
  collection: Table<T>,
  req: MockRequest,
  noun: string,
): T {
  const row = find<T>(collection, req.params.id ?? '');
  if (!row) throw new MockError(404, 'NOT_FOUND', `The ${noun} was not found.`);
  const ifMatch = req.headers.get('If-Match');
  if (ifMatch !== null && Number(ifMatch) !== row.version) {
    throw new MockError(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this record. Reload and try again.',
    );
  }
  return row;
}

const saved = <T extends { id: string; version: number }>(collection: string, row: T): T =>
  replace<T>(collection, { ...row, version: row.version + 1, updatedAt: now() });

function taken(collection: string, field: string, value: string, id?: string) {
  const clash = all<Record<string, unknown> & { id: string }>(collection).some((r) => {
    const v = r[field];
    return r.id !== id && typeof v === 'string' && v.toLowerCase() === value.toLowerCase();
  });
  if (clash) {
    throw new MockError(409, `${field.toUpperCase()}_TAKEN`, `That ${field} is already used.`, {
      fields: { [field]: 'Already used' },
    });
  }
}

/**
 * Deletion (admin tier) refused while other records use the record; registered after
 * `masterCrud`, so it replaces its unguarded delete.
 */
function guardedDelete<T extends Versioned & { code?: string; name?: string }>(
  base: string,
  collection: Table<T>,
  noun: string,
  uses: (row: T) => string | null,
) {
  route('DELETE', `${base}/:id`, (req) => {
    const row = current(collection, req, noun);
    const reason = required(bodyOf(req).reason, 'reason');
    const usedBy = uses(row);
    if (usedBy) {
      throw new MockError(
        409,
        'IN_USE',
        `This ${noun} is used by ${usedBy}; deactivate it instead.`,
      );
    }
    removeRow(collection, row.id);
    const label = row.name ?? row.code ?? row.id;
    audit(
      noun.replace(/\s+/g, '-'),
      { id: row.id, ref: row.code ?? row.id, label },
      'deleted',
      `${capital(noun)} deleted`,
      { reason },
    );
    return noContent();
  });
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const count = (n: number, noun: string) => (n > 0 ? `${n} ${noun}${n === 1 ? '' : 's'}` : null);
const firstUse = (...uses: (string | null)[]) => uses.find((u) => u !== null) ?? null;
const activeRefs = (
  rows: readonly { id: string; code: string; name: string; isActive: boolean }[],
) =>
  rows
    .filter((r) => r.isActive)
    .map(refOf)
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * The shared master endpoints, with `…/options` registered again afterwards: the shared helper
 * registers `…/:id` after `…/options`, and later routes are matched first.
 */
function masterCrud<T extends MasterRow>(
  base: string,
  collection: string,
  noun: string,
  spec: MasterSpec<T>,
) {
  sharedCrud<T>(base, collection, noun, spec);
  route('GET', `${base}/options`, () => json(spec.options?.() ?? {}));
}

// ── Coordinates and serviceability (spec 10 §5) ───────────────────────────────

/** Entered coordinates are manual; moving ones already set needs a reason (BRD C.4.2-37). */
function editedCoordinates(
  stored: Coordinates | null,
  entered: unknown,
  reason: unknown,
  isMobile: boolean,
  code: string,
): Coordinates | null {
  if (entered === undefined) return stored;
  let point: Point | null = null;
  if (entered !== null) {
    const { lat, lng } = entered as Partial<Point>;
    if (typeof lat !== 'number' || lat < -90 || lat > 90)
      invalid({ 'coordinates.lat': 'Enter a latitude' });
    if (typeof lng !== 'number' || lng < -180 || lng > 180)
      invalid({ 'coordinates.lng': 'Enter a longitude' });
    point = { lat, lng };
  }
  const same =
    point === null ? stored === null : stored?.lat === point.lat && stored.lng === point.lng;
  if (same) return stored;
  if (stored !== null) {
    if (!isMobile) {
      rule(
        'COORDINATES_FIXED',
        `${code}’s location type is not mobile, so its coordinates can’t be changed.`,
      );
    }
    if (!text(reason))
      rule('REASON_REQUIRED', 'Give a reason for changing coordinates that are already set.');
  }
  return point ? { ...point, source: 'manual', syncedAt: null } : null;
}

/** "VIA GIS": the position GIS holds for the record. */
function fromGis(
  stored: Coordinates | null,
  point: Point | null,
  isMobile: boolean,
  code: string,
): Coordinates {
  if (!point) {
    rule(
      'GIS_NO_COORDINATES',
      `GIS has no coordinates for ${code}. Enter them by hand, with a reason.`,
    );
  }
  const moved = stored !== null && (stored.lat !== point.lat || stored.lng !== point.lng);
  if (moved && !isMobile) {
    rule(
      'COORDINATES_FIXED',
      `${code}’s location type is not mobile, so its coordinates can’t be changed.`,
    );
  }
  return { ...point, source: 'integration', syncedAt: now() };
}

interface Serviceable {
  id: string;
  code: string;
  name: string;
  version: number;
  isServiceable: boolean;
  unserviceableReasonCode: string | null;
  unserviceableReason: string | null;
  unserviceableSince: string | null;
}

function serviceabilityRoute(base: string, collection: Table<Serviceable>, noun: string) {
  route('POST', `${base}/:id/serviceability`, (req) => {
    const row = current(collection, req, noun);
    const b = bodyOf(req);
    if (typeof b.serviceable !== 'boolean') invalid({ serviceable: 'Required' });
    const reason = required(b.reason, 'reason');
    if (row.isServiceable === b.serviceable) {
      throw new MockError(
        409,
        b.serviceable ? 'ALREADY_SERVICEABLE' : 'ALREADY_UNSERVICEABLE',
        `This ${noun} is already ${b.serviceable ? 'in' : 'out of'} service.`,
      );
    }
    const out = !b.serviceable;
    const next = saved<Serviceable>(collection, {
      ...row,
      isServiceable: b.serviceable,
      unserviceableReasonCode: out ? text(b.reasonCode) : null,
      unserviceableReason: out ? reason : null,
      unserviceableSince: out ? now() : null,
    });
    audit(
      noun,
      { id: row.id, ref: row.code, label: row.name },
      out ? 'out-of-service' : 'in-service',
      `${capital(noun)} ${out ? 'out of' : 'back in'} service`,
      {
        reason,
        after: { serviceable: next.isServiceable, reasonCode: next.unserviceableReasonCode },
      },
    );
    return json(next);
  });
}

// ── Zones and types ───────────────────────────────────────────────────────────

function registerTypes(): void {
  masterCrud<Zone>(`${M}/zones`, 'zones', 'zone', {
    create: (b) => ({
      code: codeOf(b, 12),
      name: required(b.name, 'name'),
      deactivatedReason: null,
    }),
    update: (c, b) => ({ ...c, name: has(b, 'name') ? required(b.name, 'name') : c.name }),
  });
  guardedDelete(`${M}/zones`, TABLES.zones, 'zone', (z) =>
    count(all<Location>('locations').filter((l) => l.zone.id === z.id).length, 'location'),
  );

  masterCrud<LocationType>(`${M}/location-types`, 'location-types', 'location type', {
    create: (b) => ({
      code: codeOf(b, 20),
      name: required(b.name, 'name'),
      isMobile: b.isMobile === true,
      isOffshore: b.isOffshore === true,
      deactivatedReason: null,
    }),
    update: (c, b) => ({
      ...c,
      name: has(b, 'name') ? required(b.name, 'name') : c.name,
      isMobile: typeof b.isMobile === 'boolean' ? b.isMobile : c.isMobile,
      isOffshore: typeof b.isOffshore === 'boolean' ? b.isOffshore : c.isOffshore,
    }),
  });
  guardedDelete(`${M}/location-types`, TABLES.locationTypes, 'location type', (t) =>
    count(all<Location>('locations').filter((l) => l.locationType.id === t.id).length, 'location'),
  );

  masterCrud<InstallationType>(
    `${M}/installation-types`,
    'installation-types',
    'installation type',
    {
      create: (b) => ({
        code: codeOf(b, 20),
        name: required(b.name, 'name'),
        deactivatedReason: null,
      }),
      update: (c, b) => ({ ...c, name: has(b, 'name') ? required(b.name, 'name') : c.name }),
    },
  );
  guardedDelete(`${M}/installation-types`, TABLES.installationTypes, 'installation type', (t) =>
    count(
      all<Installation>('installations').filter((i) => i.installationType.id === t.id).length,
      'installation',
    ),
  );
}

// ── Locations ─────────────────────────────────────────────────────────────────

const LOCATION_LIST: ListSpec<Location> = {
  search: (l) => [l.code, l.name, l.zone.name, l.focalPointName],
  filters: {
    zone: (l, v) => l.zone.id === v || l.zone.code === v,
    type: (l, v) => l.locationType.id === v || l.locationType.code === v,
    serviceable: (l, v) => String(l.isServiceable) === v,
    parent: (l, v) => l.parent?.id === v,
  },
  sorts: { type: (l) => l.locationType.name, zone: (l) => l.zone.name },
  defaultSort: 'name:asc',
};

const routePoints = (ids: readonly string[]) =>
  ids.map((id) => {
    const l = find<Location>('locations', id);
    return {
      id,
      code: l?.code ?? '',
      name: l?.name ?? '',
      coordinates: l?.coordinates ? { lat: l.coordinates.lat, lng: l.coordinates.lng } : null,
    };
  });

/** Keeps the records that show a location's name or position current after it changes. */
function refreshLocation(l: Location): void {
  const r = refOf(l);
  for (const route of all<Route>('routes').filter((x) => x.points.some((p) => p.id === l.id))) {
    replace<Route>('routes', {
      ...route,
      ...routePath(route.name, routePoints(route.points.map((p) => p.id))),
    });
  }
  for (const i of all<Installation>('installations').filter((x) => x.location.id === l.id)) {
    replace<Installation>('installations', {
      ...i,
      location: { ...r, isMobile: l.locationType.isMobile },
    });
  }
  for (const m of all<MusterPoint>('muster-points').filter((x) => x.location.id === l.id)) {
    replace<MusterPoint>('muster-points', { ...m, location: r });
  }
  for (const b of all<Lifeboat>('lifeboats').filter((x) => x.location.id === l.id)) {
    replace<Lifeboat>('lifeboats', { ...b, location: r });
  }
}

function locationValues(current: Location | null, b: Body): Location {
  const base: Location = current ?? {
    id: '',
    code: '',
    name: '',
    locationType: { id: '', code: '', name: '', isMobile: false, isOffshore: false },
    zone: { id: '', code: '', name: '' },
    parent: null,
    subLocations: 0,
    coordinates: null,
    pobLimit: null,
    isHub: false,
    isResidencyReset: false,
    isComplex: false,
    hasAccommodation: false,
    focalPointName: null,
    focalPointEmail: null,
    isServiceable: true,
    unserviceableReasonCode: null,
    unserviceableReason: null,
    unserviceableSince: null,
    isActive: true,
    deactivatedReason: null,
    version: 1,
    updatedAt: now(),
  };
  const next: Location = { ...base };
  if (!current || has(b, 'name')) next.name = required(b.name, 'name');
  if (!current || has(b, 'locationTypeId')) {
    const t = activeRef(TABLES.locationTypes, b.locationTypeId, 'locationTypeId', 'location type');
    next.locationType = { ...refOf(t), isMobile: t.isMobile, isOffshore: t.isOffshore };
  }
  if (!current || has(b, 'zoneId'))
    next.zone = refOf(activeRef(TABLES.zones, b.zoneId, 'zoneId', 'zone'));
  if (has(b, 'parentLocationId')) {
    if (b.parentLocationId === null || b.parentLocationId === '') next.parent = null;
    else {
      const parent = activeRef(
        TABLES.locations,
        b.parentLocationId,
        'parentLocationId',
        'parent location',
      );
      if (current && (parent.id === current.id || parent.parent?.id === current.id)) {
        invalid({ parentLocationId: 'A location can’t sit under itself' });
      }
      next.parent = refOf(parent);
    }
  }
  if (has(b, 'pobLimit'))
    next.pobLimit = numberOf(b.pobLimit, 'pobLimit', { positive: true, integer: true });
  for (const key of ['isHub', 'isResidencyReset', 'isComplex', 'hasAccommodation'] as const) {
    if (typeof b[key] === 'boolean') next[key] = b[key];
  }
  if (has(b, 'focalPointName')) next.focalPointName = text(b.focalPointName);
  if (has(b, 'focalPointEmail'))
    next.focalPointEmail = emailOf(b.focalPointEmail, 'focalPointEmail');
  next.coordinates = editedCoordinates(
    base.coordinates,
    b.coordinates,
    b.reason,
    next.locationType.isMobile,
    current?.code ?? text(b.code) ?? '',
  );
  taken('locations', 'name', next.name, current?.id);
  return next;
}

function registerLocations(): void {
  const base = `${M}/locations`;
  masterCrud<Location>(base, 'locations', 'location', {
    ...LOCATION_LIST,
    create: (b) => {
      const code = codeOf(b, 20);
      const values = locationValues(null, { ...b, code });
      return { ...without(values, 'id', 'version', 'isActive', 'updatedAt'), code };
    },
    options: () => ({
      zones: activeRefs(all<Zone>('zones')),
      locationTypes: all<LocationType>('location-types')
        .filter((t) => t.isActive)
        .map((t) => ({ ...refOf(t), isMobile: t.isMobile })),
      locations: activeRefs(all<Location>('locations')),
    }),
  });
  // An edit also refreshes the routes, installations and POB records that show the location.
  route('PATCH', `${base}/:id`, (req) => {
    const c = current(TABLES.locations, req, 'location');
    const b = bodyOf(req);
    const next = saved<Location>('locations', locationValues(c, b));
    refreshLocation(next);
    audit('location', { id: c.id, ref: c.code, label: next.name }, 'changed', 'Location changed', {
      before: c,
      after: next,
      reason: text(b.reason),
    });
    return json(next);
  });
  // The list counts each location's sub-locations as they stand.
  route('GET', base, (req) => {
    const rows = all<Location>('locations');
    const withCounts = rows.map((l) => ({
      ...l,
      subLocations: rows.filter((x) => x.parent?.id === l.id && x.isActive).length,
    }));
    return json(listRows(withCounts, req.query, LOCATION_LIST));
  });
  guardedDelete(base, TABLES.locations, 'location', (l) =>
    firstUse(
      count(
        all<Route>('routes').filter((r) => r.points.some((p) => p.id === l.id)).length,
        'route',
      ),
      count(
        all<Installation>('installations').filter((i) => i.location.id === l.id).length,
        'installation',
      ),
      count(all<Location>('locations').filter((x) => x.parent?.id === l.id).length, 'sub-location'),
      count(
        all<MusterPoint>('muster-points').filter((m) => m.location.id === l.id).length,
        'muster point',
      ),
    ),
  );
  serviceabilityRoute(base, TABLES.locations, 'location');
  route('POST', `${base}/:id/coordinates/sync`, (req) => {
    const l = current(TABLES.locations, req, 'location');
    const coordinates = fromGis(
      l.coordinates,
      locationGis(l.code),
      l.locationType.isMobile,
      l.code,
    );
    const next = saved<Location>('locations', { ...l, coordinates });
    refreshLocation(next);
    audit(
      'location',
      { id: l.id, ref: l.code, label: l.name },
      'coordinates-synced',
      'Coordinates from GIS',
      {
        before: { coordinates: l.coordinates },
        after: { coordinates },
      },
    );
    return json(next);
  });
}

// ── Installations ─────────────────────────────────────────────────────────────

const INSTALLATION_LIST: ListSpec<Installation> = {
  hasActive: false,
  search: (i) => [i.code, i.name, i.callsign, i.location.name, i.operator],
  filters: {
    location: (i, v) => i.location.id === v || i.location.code === v,
    type: (i, v) => i.installationType.id === v || i.installationType.code === v,
    unconfirmed: (i, v) => String(i.unconfirmedFields.length > 0) === v,
    serviceable: (i, v) => String(i.isServiceable) === v,
  },
  sorts: { type: (i) => i.installationType.name, location: (i) => i.location.name },
  defaultSort: 'name:asc',
};
const TEXT_FIELDS = [
  'callsign',
  'material',
  'gcaaClassOfUse',
  'deckClass',
  'minPerformanceClass',
  'radioFrequency',
  'ndb',
  'heading',
  'firefighting',
  'operator',
] as const;
const NUMBER_FIELDS = ['dValue', 'tValue', 'elevationM', 'deckHeightFt'] as const;
const FLAG_FIELDS = ['statusLights', 'fuelAvailable', 'gpuAvailable'] as const;

function installationValues(current: Installation, b: Body, creating: boolean): Installation {
  const next: Installation = { ...current };
  if (creating || has(b, 'name')) next.name = required(b.name, 'name');
  if (creating || has(b, 'installationTypeId')) {
    next.installationType = refOf(
      activeRef(
        TABLES.installationTypes,
        b.installationTypeId,
        'installationTypeId',
        'installation type',
      ),
    );
  }
  if (creating || has(b, 'locationId')) {
    const l = activeRef(TABLES.locations, b.locationId, 'locationId', 'location');
    next.location = { ...refOf(l), isMobile: l.locationType.isMobile };
  }
  for (const key of TEXT_FIELDS) if (has(b, key)) next[key] = text(b[key]);
  for (const key of NUMBER_FIELDS) {
    if (has(b, key)) next[key] = numberOf(b[key], key, { positive: key !== 'elevationM' });
  }
  for (const key of FLAG_FIELDS) if (typeof b[key] === 'boolean') next[key] = b[key];
  if (has(b, 'riskLevel')) {
    next.riskLevel =
      b.riskLevel === null
        ? null
        : oneOf(b.riskLevel, 'riskLevel', ['low', 'medium', 'high'] as const);
  }
  if (has(b, 'lastOpsSurveyOn'))
    next.lastOpsSurveyOn = dateOf(b.lastOpsSurveyOn, 'lastOpsSurveyOn');
  next.coordinates = editedCoordinates(
    current.coordinates,
    b.coordinates,
    b.reason,
    next.location.isMobile,
    next.code,
  );
  // Entering or confirming a placeholder value confirms it (P-53).
  const confirmed = Array.isArray(b.confirmed) ? (b.confirmed as string[]) : [];
  next.unconfirmedFields = current.unconfirmedFields.filter(
    (f) => !has(b, f) && !confirmed.includes(f),
  );
  next.activationMissing = activationMissing(next);
  if (current.isActive && next.activationMissing.length > 0) {
    rule(
      'ACTIVATION_FIELDS_REQUIRED',
      `An active installation needs its ${next.activationMissing.join(', ')}; deactivate it first.`,
      {
        missing: next.activationMissing,
      },
    );
  }
  return next;
}

const blankInstallation = (code: string): Installation => ({
  id: newId(),
  code,
  name: '',
  callsign: null,
  installationType: { id: '', code: '', name: '' },
  location: { id: '', code: '', name: '', isMobile: false },
  material: null,
  dValue: null,
  tValue: null,
  gcaaClassOfUse: null,
  elevationM: null,
  coordinates: null,
  deckClass: null,
  minPerformanceClass: null,
  radioFrequency: null,
  deckHeightFt: null,
  ndb: null,
  heading: null,
  statusLights: false,
  firefighting: null,
  fuelAvailable: false,
  gpuAvailable: false,
  operator: null,
  riskLevel: null,
  lastOpsSurveyOn: null,
  unconfirmedFields: [],
  activationMissing: [],
  isServiceable: true,
  unserviceableReasonCode: null,
  unserviceableReason: null,
  unserviceableSince: null,
  status: 'draft',
  isActive: false,
  activatedAt: null,
  deactivatedReason: null,
  attachments: 0,
  version: 1,
  updatedAt: now(),
});

const installationAudit = (i: Installation) => ({ id: i.id, ref: i.code, label: i.name });

function registerInstallations(): void {
  const base = `${M}/installations`;
  masterCrud<Installation>(base, 'installations', 'installation', {
    ...INSTALLATION_LIST,
    update: (c, b) => installationValues(c, b, false),
    options: () => ({
      installationTypes: activeRefs(all<InstallationType>('installation-types')),
      locations: activeRefs(all<Location>('locations')),
    }),
  });
  // Drafts are listed with the active ones; deactivated installations only on request.
  route('GET', base, (req) => {
    const shown = all<Installation>('installations').filter(
      (i) => req.query.get('includeDeactivated') === 'true' || i.status !== 'deactivated',
    );
    return json(listRows(shown, req.query, INSTALLATION_LIST));
  });
  // A new installation starts as a draft until activated.
  route('POST', base, (req) => {
    const b = bodyOf(req);
    const code = codeOf(b, 24);
    taken('installations', 'code', code);
    const row = insert<Installation>(
      'installations',
      installationValues(blankInstallation(code), b, true),
    );
    audit('installation', installationAudit(row), 'created', 'Installation added (draft)', {
      after: row,
    });
    return json(row, 201);
  });
  const activate = (req: MockRequest) => {
    const i = current(TABLES.installations, req, 'installation');
    const reason = text(bodyOf(req).reason);
    if (i.isActive)
      throw new MockError(409, 'ALREADY_ACTIVE', 'This installation is already active.');
    if (i.activatedAt && !reason)
      rule('REASON_REQUIRED', 'Give a reason for reactivating the installation.');
    if (i.activationMissing.length > 0) {
      rule(
        'ACTIVATION_INCOMPLETE',
        `Enter the ${i.activationMissing.join(', ')} before activating.`,
        {
          missing: i.activationMissing,
        },
      );
    }
    const next = saved<Installation>('installations', {
      ...i,
      status: 'active',
      isActive: true,
      deactivatedReason: null,
      activatedAt: i.activatedAt ?? now(),
    });
    const verb = i.activatedAt ? 'reactivated' : 'activated';
    audit('installation', installationAudit(next), verb, `Installation ${verb}`, { reason });
    return json(next);
  };
  route('POST', `${base}/:id/activate`, activate);
  route('POST', `${base}/:id/reactivate`, activate);
  route('POST', `${base}/:id/deactivate`, (req) => {
    const i = current(TABLES.installations, req, 'installation');
    const reason = required(bodyOf(req).reason, 'reason');
    if (!i.isActive) throw new MockError(409, 'NOT_ACTIVE', 'This installation is not active.');
    const next = saved<Installation>('installations', {
      ...i,
      status: 'deactivated',
      isActive: false,
      deactivatedReason: reason,
    });
    audit('installation', installationAudit(next), 'deactivated', 'Installation deactivated', {
      reason,
    });
    return json(next);
  });
  guardedDelete(base, TABLES.installations, 'installation', (i) =>
    count(
      all<MusterPoint>('muster-points').filter((m) => m.installation?.id === i.id).length,
      'muster point',
    ),
  );
  serviceabilityRoute(base, TABLES.installations, 'installation');
  route('POST', `${base}/:id/coordinates/sync`, (req) => {
    const i = current(TABLES.installations, req, 'installation');
    const coordinates = fromGis(
      i.coordinates,
      installationGis(i.code),
      i.location.isMobile,
      i.code,
    );
    const next = {
      ...i,
      coordinates,
      unconfirmedFields: i.unconfirmedFields.filter((f) => f !== 'coordinates'),
    };
    const row = saved<Installation>('installations', {
      ...next,
      activationMissing: activationMissing(next),
    });
    audit('installation', installationAudit(row), 'coordinates-synced', 'Coordinates from GIS', {
      before: { coordinates: i.coordinates },
      after: { coordinates },
    });
    return json(row);
  });

  const files = (id: string) =>
    all<InstallationFileRow>('installation-files')
      .filter((f) => f.installationId === id)
      .map((file) => without(file, 'installationId'));
  const recount = (i: Installation) =>
    replace<Installation>('installations', {
      ...i,
      attachments: files(i.id).length,
      updatedAt: now(),
    });
  route('GET', `${base}/:id/attachments`, (req) => {
    const i = find<Installation>('installations', req.params.id ?? '');
    return i ? json({ items: files(i.id) }) : notFound('installation');
  });
  route('POST', `${base}/:id/attachments`, (req) => {
    const i = find<Installation>('installations', req.params.id ?? '');
    if (!i) return notFound('installation');
    const ids = bodyOf(req).fileIds;
    if (!Array.isArray(ids) || ids.length === 0) invalid({ fileIds: 'Choose at least one file' });
    // Uploaded files' details, when the files service keeps them.
    const uploads = all<Partial<InstallationFileRow> & { id: string }>('files');
    for (const fileId of ids as string[]) {
      if (all<InstallationFileRow>('installation-files').some((f) => f.id === fileId)) continue;
      const upload = uploads.find((u) => u.id === fileId);
      insert<InstallationFileRow>('installation-files', {
        id: fileId,
        installationId: i.id,
        purpose: upload?.purpose ?? 'installation-document',
        fileName: upload?.fileName ?? `${i.code} document.pdf`,
        mimeType: upload?.mimeType ?? 'application/pdf',
        sizeBytes: upload?.sizeBytes ?? 240_000,
        sha256: upload?.sha256 ?? fileId.replace(/-/g, '').padEnd(64, '0'),
        scanStatus: 'clean',
        uploadedAt: upload?.uploadedAt ?? now(),
        attached: true,
        download: null,
      });
    }
    recount(i);
    audit('installation', installationAudit(i), 'files-attached', 'Files attached', {
      after: { fileIds: ids },
    });
    return json({ items: files(i.id) });
  });
  route('DELETE', `${base}/:id/attachments/:fileId`, (req) => {
    const i = find<Installation>('installations', req.params.id ?? '');
    if (!i) return notFound('installation');
    const reason = required(bodyOf(req).reason, 'reason');
    const file = all<InstallationFileRow>('installation-files').find(
      (f) => f.id === req.params.fileId && f.installationId === i.id,
    );
    if (!file) return notFound('file');
    removeRow('installation-files', file.id);
    recount(i);
    audit('installation', installationAudit(i), 'file-removed', `File removed · ${file.fileName}`, {
      reason,
    });
    return json({ items: files(i.id) });
  });
}

// ── Routes (spec 10 §5.1, BRD D.3.1.3) ────────────────────────────────────────

const ROUTE_LIST: ListSpec<Route> = {
  search: (r) => [
    r.code,
    r.displayName,
    r.owningTeam,
    ...r.points.flatMap((p) => [p.code, p.name]),
  ],
  filters: {
    via: (r, v) => r.points.some((p) => p.id === v || p.code === v),
    category: (r, v) => r.resourceCategory === v,
    origin: (r, v) => r.origin.id === v,
    destination: (r, v) => r.destination.id === v,
  },
  sorts: {
    origin: (r) => `${r.origin.name} ${r.destination.name}`,
    category: (r) => r.resourceCategory,
    route: (r) => r.displayName,
  },
  defaultSort: 'origin:asc',
};

/** The resource categories, from the resources area when it keeps them. */
function categories(): components['schemas']['ResourceCategoryOption'][] {
  const stored = all<{
    code: string;
    name: string;
    weightUnit: 'kg' | 'lb';
    baseMode?: string;
    isActive: boolean;
  }>('resource-categories');
  if (stored.length === 0) return DEFAULT_CATEGORIES;
  return stored
    .filter((c) => c.isActive)
    .map((c) => ({
      code: c.code,
      name: c.name,
      weightUnit: c.weightUnit,
      baseMode:
        c.baseMode === 'fixed-wing' || c.baseMode === 'rotary-wing' || c.baseMode === 'marine'
          ? c.baseMode
          : (DEFAULT_CATEGORIES.find((d) => d.code === c.code)?.baseMode ??
            (c.weightUnit === 'lb' ? 'rotary-wing' : 'fixed-wing')),
    }));
}

function categoryOf(v: unknown): string {
  const code = required(v, 'resourceCategory');
  if (!categories().some((c) => c.code === code)) {
    rule('CATEGORY_INACTIVE', 'Choose an active resource category.', {
      fields: { resourceCategory: 'Inactive' },
    });
  }
  return code;
}

/** A via point can't repeat or be an end; a round trip needs at least one via point. */
function checkPath(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2)
    invalid({ points: 'A route needs an origin and a destination' });
  if (value.length > 20) invalid({ points: 'A route has at most 20 points' });
  const path = value as unknown[];
  const fields: Record<string, string> = {};
  path.forEach((id, i) => {
    const l = typeof id === 'string' ? find<Location>('locations', id) : undefined;
    if (!l) fields[`points.${i}`] = 'Choose a location';
    else if (!l.isActive)
      fields[`points.${i}`] = `${l.name} is deactivated and cannot be used on a route.`;
  });
  if (Object.keys(fields).length > 0) {
    rule('ROUTE_POINT_INACTIVE', Object.values(fields)[0] ?? 'Choose active locations.', {
      fields,
    });
  }
  const ids = path as string[];
  const last = ids.length - 1;
  for (let i = 1; i < last; i += 1) {
    const id = ids[i] ?? '';
    if (id === ids[0]) fields[`points.${i}`] = 'A via point cannot be the origin';
    else if (id === ids[last]) fields[`points.${i}`] = 'A via point cannot be the destination';
    else if (ids.slice(1, i).includes(id))
      fields[`points.${i}`] = 'This location is already a via point';
  }
  if (last === 1 && ids[0] === ids[1])
    fields['points.1'] = 'A route back to its origin needs at least one via point.';
  if (Object.keys(fields).length > 0) {
    rule(
      'ROUTE_POINT_REPEATED',
      'A location can appear only once on a route (a round trip may end where it started).',
      {
        fields,
      },
    );
  }
  return ids;
}

/** ORIGIN-VIA…-DEST when it fits, else ORIGIN-DEST, then -2, -3, … for each clash. */
function routeCode(ids: readonly string[]): string {
  const parts = routePoints(ids).map((p) => p.code.replace(/[^A-Z0-9-]/g, ''));
  const full = parts.join('-');
  const root = (full.length <= 24 ? full : [parts[0], parts.at(-1)].join('-')).slice(0, 24);
  const codes = new Set(all<Route>('routes').map((r) => r.code));
  if (!codes.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const code = `${root.slice(0, 24 - `-${n}`.length)}-${n}`;
    if (!codes.has(code)) return code;
  }
}

const me = () => {
  const persona = currentPersona();
  return { id: persona?.me.id ?? 'demo-user', name: persona?.me.displayName ?? 'Demo user' };
};

function addRevision(route: Route): void {
  insert<RouteRevisionRow>('route-revisions', {
    id: newId(),
    routeId: route.id,
    revision: route.revision,
    createdAt: now(),
    createdBy: me().name,
    points: route.points.map(refOf),
  });
}

function routeValues(current: Route, b: Body): Route {
  const next: Route = { ...current };
  if (has(b, 'name')) {
    const name = text(b.name);
    if (name && name.length > 200) invalid({ name: 'Use up to 200 characters' });
    next.name = name;
  }
  if (has(b, 'resourceCategory') && b.resourceCategory !== current.resourceCategory) {
    next.resourceCategory = categoryOf(b.resourceCategory);
  }
  if (has(b, 'durationMinutes')) {
    next.durationMinutes = numberOf(b.durationMinutes, 'durationMinutes', {
      positive: true,
      integer: true,
    });
  }
  if (typeof b.isExclusive === 'boolean') next.isExclusive = b.isExclusive;
  if (has(b, 'owningTeam')) next.owningTeam = text(b.owningTeam);
  const ids = has(b, 'points') ? checkPath(b.points) : current.points.map((p) => p.id);
  const changed =
    ids.length !== current.points.length || ids.some((id, i) => id !== current.points[i]?.id);
  Object.assign(next, routePath(next.name, routePoints(ids)));
  if (changed) next.revision = current.revision + 1;
  return next;
}

function registerRoutes(): void {
  const base = `${M}/routes`;
  masterCrud<Route>(base, 'routes', 'route', {
    ...ROUTE_LIST,
    describe: (r) => ({ ref: r.code, label: r.displayName }),
    update: (c, b) => {
      const next = routeValues(c, b);
      if (next.revision !== c.revision) addRevision(next);
      return next;
    },
    options: () => ({
      locations: all<Location>('locations')
        .filter((l) => l.isActive)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => ({ ...refOf(l), hasCoordinates: l.coordinates !== null })),
      categories: categories(),
    }),
  });
  route('POST', base, (req) => {
    const b = bodyOf(req);
    const ids = checkPath(b.points);
    const code = text(b.code) ? codeOf(b, 24) : routeCode(ids);
    if (code.length < 2) invalid({ code: 'Use 2 to 24 letters, digits and hyphens.' });
    taken('routes', 'code', code);
    const draft: Route = {
      id: newId(),
      code,
      ...routePath(null, []),
      resourceCategory: categoryOf(b.resourceCategory),
      durationMinutes: null,
      isExclusive: false,
      owningTeam: null,
      revision: 1,
      isActive: true,
      deactivatedReason: null,
      version: 1,
      updatedAt: now(),
    };
    const row = insert<Route>('routes', {
      ...routeValues(draft, { ...b, points: ids }),
      revision: 1,
    });
    addRevision(row);
    audit(
      'route',
      { id: row.id, ref: row.code, label: row.displayName },
      'created',
      `Route added · ${row.code}`,
      { after: row },
    );
    return json(row, 201);
  });
  // A route comes back only while all its points are still active.
  route('POST', `${base}/:id/reactivate`, (req) => {
    const r = current(TABLES.routes, req, 'route');
    const reason = required(bodyOf(req).reason, 'reason');
    if (r.isActive) throw new MockError(409, 'ALREADY_IN_STATE', 'The route is already active.');
    checkPath(r.points.map((p) => p.id));
    const next = saved<Route>('routes', { ...r, isActive: true, deactivatedReason: null });
    audit(
      'route',
      { id: r.id, ref: r.code, label: r.displayName },
      'reactivated',
      `Route reactivated · ${r.code}`,
      { reason },
    );
    return json(next);
  });
  route('GET', `${base}/:id/revisions`, (req) => {
    if (!find<Route>('routes', req.params.id ?? '')) return notFound('route');
    const items = all<RouteRevisionRow>('route-revisions')
      .filter((r) => r.routeId === req.params.id)
      .sort((a, b) => b.revision - a.revision)
      .map(({ revision, createdAt, createdBy, points }) => ({
        revision,
        createdAt,
        createdBy,
        points,
      }));
    return json({ items });
  });
}

// ── Organisations ─────────────────────────────────────────────────────────────

const organisationOptions = () => ({
  departments: activeRefs(all<Department>('departments')),
  serviceProviders: all<ServiceProvider>('service-providers')
    .filter((p) => p.isActive)
    .map((p) => ({ id: p.id, code: p.code, name: p.legalName }))
    .sort((a, b) => a.name.localeCompare(b.name)),
});

const providerRef = (id: unknown, field: string) => {
  const p = activeRef(TABLES.serviceProviders, id, field, 'service provider');
  return { id: p.id, code: p.code, name: p.legalName };
};

function registerOrganisations(): void {
  masterCrud<Department>(`${M}/departments`, 'departments', 'department', {
    filters: { parent: (d, v) => d.parent?.id === v },
    sorts: { parent: (d) => d.parent?.name },
    defaultSort: 'name:asc',
    create: (b) => ({
      code: codeOf(b, 20),
      name: required(b.name, 'name'),
      parent: text(b.parentId)
        ? refOf(activeRef(TABLES.departments, b.parentId, 'parentId', 'department'))
        : null,
      source: 'manual',
      syncedAt: null,
      people: 0,
      deactivatedReason: null,
    }),
    update: (c, b) => {
      const next = { ...c };
      if (has(b, 'name')) {
        const name = required(b.name, 'name');
        if (c.source !== 'manual' && name !== c.name) {
          rule('SOURCE_MANAGED', 'This department comes from SAP; change its name there.', {
            fields: { name: 'Managed in SAP' },
          });
        }
        next.name = name;
      }
      if (has(b, 'parentId')) {
        const parent = text(b.parentId)
          ? activeRef(TABLES.departments, b.parentId, 'parentId', 'department')
          : null;
        if (parent && (parent.id === c.id || parent.parent?.id === c.id)) {
          invalid({ parentId: 'A department can’t sit under itself' });
        }
        next.parent = parent ? refOf(parent) : null;
      }
      return next;
    },
    options: organisationOptions,
  });
  guardedDelete(`${M}/departments`, TABLES.departments, 'department', (d) =>
    firstUse(
      count(
        all<Department>('departments').filter((x) => x.parent?.id === d.id).length,
        'sub-department',
      ),
      count(
        all<ChargeCode>('charge-codes').filter((c) => c.owningDepartment?.id === d.id).length,
        'charge code',
      ),
      d.people > 0 ? `${d.people} people` : null,
    ),
  );

  masterCrud<Company>(`${M}/companies`, 'companies', 'company', {
    filters: { provider: (c, v) => c.serviceProvider?.id === v },
    sorts: { provider: (c) => c.serviceProvider?.name },
    defaultSort: 'name:asc',
    create: (b) => ({
      code: codeOf(b, 20),
      name: required(b.name, 'name'),
      source: 'external',
      serviceProvider: providerRef(b.serviceProviderId, 'serviceProviderId'),
      syncedAt: null,
      people: 0,
      deactivatedReason: null,
    }),
    update: (c, b) => {
      if (c.source !== 'external' && (has(b, 'name') || has(b, 'serviceProviderId'))) {
        rule(
          'SOURCE_MANAGED',
          `This company comes from ${c.source === 'sap' ? 'SAP' : 'Fieldglass'}; change it there.`,
        );
      }
      return {
        ...c,
        name: has(b, 'name') ? required(b.name, 'name') : c.name,
        serviceProvider: has(b, 'serviceProviderId')
          ? providerRef(b.serviceProviderId, 'serviceProviderId')
          : c.serviceProvider,
      };
    },
    options: organisationOptions,
  });
  guardedDelete(`${M}/companies`, TABLES.companies, 'company', (c) =>
    c.people > 0 ? `${c.people} people` : null,
  );

  const providerList: ListSpec<ServiceProvider> = {
    search: (p) => [p.code, p.legalName, p.contactName, p.contactEmail],
    filters: { type: (p, v) => p.providerType === v },
    sorts: { name: (p) => p.legalName, type: (p) => p.providerType },
    defaultSort: 'name:asc',
  };
  const providerValues = (c: ServiceProvider, b: Body): ServiceProvider => ({
    ...c,
    legalName: has(b, 'legalName') ? required(b.legalName, 'legalName') : c.legalName,
    providerType: has(b, 'providerType')
      ? oneOf(b.providerType, 'providerType', ['aviation', 'marine', 'test'] as const)
      : c.providerType,
    contactName: has(b, 'contactName') ? text(b.contactName) : c.contactName,
    contactEmail: has(b, 'contactEmail') ? emailOf(b.contactEmail, 'contactEmail') : c.contactEmail,
    contactPhone: has(b, 'contactPhone') ? text(b.contactPhone) : c.contactPhone,
  });
  masterCrud<ServiceProvider>(`${M}/service-providers`, 'service-providers', 'service provider', {
    ...providerList,
    describe: (p) => ({ ref: p.code, label: p.legalName }),
    create: (b) => {
      const values = providerValues(
        {
          id: '',
          code: codeOf(b, 12),
          legalName: '',
          providerType: 'aviation',
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          fleet: 0,
          contacts: 0,
          isActive: true,
          deactivatedReason: null,
          version: 1,
          updatedAt: '',
        },
        { ...b, legalName: b.legalName ?? '', providerType: b.providerType ?? null },
      );
      return without(values, 'id', 'version', 'isActive', 'updatedAt');
    },
    update: providerValues,
  });
  // Contact counts follow the contacts as they stand.
  route('GET', `${M}/service-providers`, (req) => {
    const contacts = all<ExternalContact>('external-contacts');
    const rows = all<ServiceProvider>('service-providers').map((p) => ({
      ...p,
      contacts: contacts.filter((c) => c.serviceProvider.id === p.id && c.isActive).length,
    }));
    return json(listRows(rows, req.query, providerList));
  });
  guardedDelete(`${M}/service-providers`, TABLES.serviceProviders, 'service provider', (p) =>
    firstUse(
      count(
        all<Company>('companies').filter((c) => c.serviceProvider?.id === p.id).length,
        'company',
      ),
      count(
        all<ExternalContact>('external-contacts').filter((c) => c.serviceProvider.id === p.id)
          .length,
        'contact',
      ),
      count(p.fleet, 'fleet unit'),
    ),
  );

  const chargeValues = (c: ChargeCode | null, b: Body) => {
    const sites =
      !c || has(b, 'siteIds')
        ? (Array.isArray(b.siteIds) ? (b.siteIds as unknown[]) : []).map((id, i) =>
            refOf(activeRef(TABLES.locations, id, `siteIds.${i}`, 'site')),
          )
        : c.sites;
    const validFrom = !c || has(b, 'validFrom') ? dateOf(b.validFrom, 'validFrom') : c.validFrom;
    const validTo = !c || has(b, 'validTo') ? dateOf(b.validTo, 'validTo') : c.validTo;
    if (validFrom && validTo && validTo < validFrom) invalid({ validTo: 'Ends before it starts' });
    return {
      description:
        !c || has(b, 'description') ? required(b.description, 'description') : c.description,
      allSites: sites.length === 0,
      sites,
      recoverability:
        !c || has(b, 'recoverability')
          ? oneOf(b.recoverability, 'recoverability', ['recoverable', 'non-recoverable'] as const)
          : c.recoverability,
      validFrom,
      validTo,
      owningDepartment:
        !c || has(b, 'owningDepartmentId')
          ? text(b.owningDepartmentId)
            ? refOf(
                activeRef(
                  TABLES.departments,
                  b.owningDepartmentId,
                  'owningDepartmentId',
                  'department',
                ),
              )
            : null
          : c.owningDepartment,
    };
  };
  masterCrud<ChargeCode>(`${M}/charge-codes`, 'charge-codes', 'charge code', {
    search: (c) => [c.code, c.description, c.owningDepartment?.name],
    filters: {
      site: (c, v) => c.allSites || c.sites.some((s) => s.id === v),
      department: (c, v) => c.owningDepartment?.id === v,
    },
    sorts: { department: (c) => c.owningDepartment?.name },
    defaultSort: 'code:asc',
    describe: (c) => ({ ref: c.code, label: c.description }),
    create: (b) => ({ code: codeOf(b, 20), ...chargeValues(null, b), deactivatedReason: null }),
    update: (c, b) => ({ ...c, ...chargeValues(c, b) }),
    options: () => ({
      locations: activeRefs(all<Location>('locations')),
      departments: activeRefs(all<Department>('departments')),
    }),
  });

  const ICONS = [
    'crown',
    'star',
    'shield-check',
    'refresh-cw',
    'briefcase',
    'hard-hat',
    'radar',
    'user-round',
    'user',
    'stethoscope',
  ] as const;
  const COLOURS = [
    '#1D4ED8',
    '#16A34A',
    '#F59E0B',
    '#DC2626',
    '#7E22CE',
    '#0EA5E9',
    '#64748B',
  ] as const;
  const categoryValues = (c: PassengerCategory | null, b: Body) => {
    const rank =
      !c || has(b, 'priorityRank')
        ? (numberOf(b.priorityRank, 'priorityRank', { positive: true, integer: true }) ??
          invalid({ priorityRank: 'Required' }))
        : c.priorityRank;
    const clash = all<PassengerCategory>('passenger-categories').find(
      (x) => x.priorityRank === rank && x.id !== c?.id,
    );
    if (clash) {
      throw new MockError(409, 'RANK_TAKEN', `${clash.name} already has priority rank ${rank}.`, {
        fields: { priorityRank: 'Already used' },
      });
    }
    return {
      name: !c || has(b, 'name') ? required(b.name, 'name') : c.name,
      icon: !c || has(b, 'icon') ? oneOf(b.icon, 'icon', ICONS) : c.icon,
      colour: !c || has(b, 'colour') ? oneOf(b.colour, 'colour', COLOURS) : c.colour,
      priorityRank: rank,
      seatForward: typeof b.seatForward === 'boolean' ? b.seatForward : (c?.seatForward ?? false),
      sourceMapping: !c || has(b, 'sourceMapping') ? text(b.sourceMapping) : c.sourceMapping,
      isCrewChange:
        typeof b.isCrewChange === 'boolean' ? b.isCrewChange : (c?.isCrewChange ?? false),
    };
  };
  masterCrud<PassengerCategory>(
    `${M}/passenger-categories`,
    'passenger-categories',
    'passenger category',
    {
      search: (c) => [c.code, c.name, c.sourceMapping],
      sorts: { rank: (c) => c.priorityRank },
      defaultSort: 'rank:asc',
      create: (b) => ({ code: codeOf(b, 20), ...categoryValues(null, b), deactivatedReason: null }),
      update: (c, b) => ({ ...c, ...categoryValues(c, b) }),
    },
  );
}

// ── External contacts (spec 10 §2.1) ──────────────────────────────────────────

function registerContacts(): void {
  const base = `${M}/external-contacts`;
  const contactValues = (c: ExternalContact | null, b: Body) => ({
    displayName:
      !c || has(b, 'displayName') ? required(b.displayName, 'displayName') : c.displayName,
    email:
      !c || has(b, 'email')
        ? (emailOf(required(b.email, 'email'), 'email') ?? '').toLowerCase()
        : c.email,
    serviceProvider:
      !c || has(b, 'serviceProviderId')
        ? providerRef(b.serviceProviderId, 'serviceProviderId')
        : c.serviceProvider,
    designation: !c || has(b, 'designation') ? text(b.designation) : c.designation,
    phone: !c || has(b, 'phone') ? text(b.phone) : c.phone,
    gender:
      !c || has(b, 'gender') ? (b.gender === 'M' || b.gender === 'F' ? b.gender : null) : c.gender,
    nationality: !c || has(b, 'nationality') ? text(b.nationality) : c.nationality,
    hsePassportNo: !c || has(b, 'hsePassportNo') ? text(b.hsePassportNo) : c.hsePassportNo,
  });
  const describe = (c: ExternalContact) => ({ ref: c.personnelNo, label: c.displayName });
  masterCrud<ExternalContact>(base, 'external-contacts', 'external contact', {
    search: (c) => [c.displayName, c.email, c.personnelNo, c.designation, c.serviceProvider.name],
    filters: {
      provider: (c, v) => c.serviceProvider.id === v,
      state: (c, v) => (v === 'pending' ? c.activatedAt === null : c.activatedAt !== null),
    },
    sorts: { name: (c) => c.displayName, provider: (c) => c.serviceProvider.name },
    defaultSort: 'name:asc',
    unique: 'email',
    recordType: 'external-contact',
    describe,
    create: (b) => {
      const numbers = all<ExternalContact>('external-contacts').map(
        (c) => Number(c.personnelNo.replace(/\D/g, '')) || 0,
      );
      return {
        personnelNo: `EXT-${String(Math.max(4100, ...numbers) + 1).padStart(6, '0')}`,
        ...contactValues(null, b),
        activatedAt: null,
        user: null,
        deactivatedReason: null,
      };
    },
    update: (c, b) => ({ ...c, ...contactValues(c, b) }),
  });
  route('GET', `${base}/providers`, () => json({ items: organisationOptions().serviceProviders }));
  route('POST', `${base}/:id/activate`, (req) => {
    const c = current(TABLES.externalContacts, req, 'external contact');
    const referenceId = required(bodyOf(req).referenceId, 'referenceId');
    if (!c.isActive) rule('CONTACT_INACTIVE', 'Reactivate the contact before giving them access.');
    if (c.activatedAt)
      throw new MockError(409, 'ALREADY_ACTIVATED', 'This contact already has access.');
    const next = saved<ExternalContact>('external-contacts', {
      ...c,
      activatedAt: now(),
      user: { id: newId(), status: 'invited' },
    });
    audit(
      'external-contact',
      { id: next.id, ...describe(next) },
      'activated',
      'Access activated; invitation sent',
      {
        reason: `Reference ${referenceId}`,
        after: { user: next.user },
      },
    );
    return json(next);
  });
}

// ── POB masters: proposals approved by a second person (spec 10 §5.3) ─────────

type PobRecord = MusterPoint | Lifeboat | EssentialPosition;
const POB_NOUN: Readonly<Record<PobMaster, string>> = {
  'muster-points': 'muster point',
  lifeboats: 'lifeboat',
  'essential-positions': 'essential position',
};
const PENDING = 'pob-pending-changes';
const MODES = ['helicopter', 'lifeboat', 'boat'] as const;

const recordRef = (master: PobMaster, r: PobRecord): Ref =>
  master === 'essential-positions'
    ? {
        id: r.id,
        code: (r as EssentialPosition).designation,
        name: (r as EssentialPosition).designation,
      }
    : refOf(r as MusterPoint | Lifeboat);
const label = (master: PobMaster, r: PobRecord) =>
  master === 'essential-positions'
    ? `${(r as EssentialPosition).designation} at ${r.location.name}`
    : `${(r as MusterPoint).code} · ${(r as MusterPoint).name}`;

const mine = (c: PendingChangeRow) => c.requestedBy.id === me().id;

/** A change as its viewer sees it: theirs to withdraw, or theirs to decide. */
function view(c: PendingChangeRow): PendingMasterChange {
  const pending = c.status === 'pending';
  return {
    ...without(c, 'taskId', 'payload'),
    myTask: pending && !mine(c) ? { id: c.taskId, version: c.version } : null,
    canWithdraw: pending && mine(c),
  };
}

function nextRef(): string {
  const highest = all<PendingChangeRow>(PENDING).reduce(
    (n, c) => Math.max(n, Number(c.ref.slice(-4)) || 0),
    0,
  );
  return `PMC-${gstDate().slice(0, 4)}-${String(highest + 1).padStart(4, '0')}`;
}

function mark(master: PobMaster, id: string, marker: PobRecord['pendingChange']): void {
  const row = find<PobRecord>(master, id);
  if (row) replace<PobRecord>(master, { ...row, pendingChange: marker });
}

function propose(
  master: PobMaster,
  action: PobAction,
  record: PobRecord | null,
  detail: {
    location: Ref;
    summary: string;
    payload: Body;
    before?: Body | null;
    after: Body;
    reason?: string | null;
    batchId?: string | null;
    record?: Ref | null;
  },
): PendingChangeRow {
  if (record?.pendingChange) {
    throw new MockError(
      409,
      'CHANGE_PENDING',
      `${record.pendingChange.ref} is already waiting for approval for this record.`,
    );
  }
  const id = newId();
  const row = insert<PendingChangeRow>(PENDING, {
    id,
    ref: nextRef(),
    master,
    action,
    record: detail.record ?? (record ? recordRef(master, record) : null),
    location: detail.location,
    batchId: detail.batchId ?? null,
    summary: detail.summary,
    reason: detail.reason ?? null,
    before: detail.before ?? null,
    after: detail.after,
    status: 'pending',
    requestedBy: me(),
    requestedAt: now(),
    decidedAt: null,
    decisionNote: null,
    approvalId: newId(),
    myTask: null,
    canWithdraw: false,
    version: 1,
    taskId: newId(),
    payload: detail.payload,
  });
  if (record) mark(master, record.id, { id: row.id, ref: row.ref, action });
  audit(
    'pending-master-change',
    { id: row.id, ref: row.ref, label: row.summary },
    'proposed',
    `Change proposed · ${row.summary}`,
    {
      reason: row.reason,
      after: row.after,
    },
  );
  return row;
}

const proposed = (rows: PendingChangeRow[]) => json({ items: rows.map(view) }, 202);

/** Only what differs from the record goes for approval. */
function changes(record: PobRecord, values: Body): { before: Body; after: Body } {
  const before: Body = {};
  const after: Body = {};
  for (const [key, value] of Object.entries(values)) {
    const was = (record as unknown as Body)[key];
    if (JSON.stringify(was) !== JSON.stringify(value)) {
      before[key] = was;
      after[key] = value;
    }
  }
  if (Object.keys(after).length === 0) rule('NO_CHANGE', 'Nothing has changed.');
  return { before, after };
}

const shown = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return (v as string[]).join('/') || '—';
  return v && typeof v === 'object' ? (v as Ref).name : '—';
};
const describeValues = (after: Body) =>
  Object.entries(after)
    .map(([k, v]) => `${k} ${shown(v)}`)
    .join(', ');

// Values of a muster point or lifeboat form, with ids resolved for display.
function musterValues(b: Body, current: MusterPoint | null): Body {
  const out: Body = {};
  const location =
    current?.location ?? refOf(activeRef(TABLES.locations, b.locationId, 'locationId', 'location'));
  if (!current) {
    out.code = codeOf(b, 20);
    out.location = location;
  }
  if (!current || has(b, 'name')) out.name = required(b.name, 'name');
  if (!current || has(b, 'role'))
    out.role = oneOf(b.role, 'role', ['primary', 'alternate'] as const);
  if (has(b, 'capacity'))
    out.capacity = numberOf(b.capacity, 'capacity', { positive: true, integer: true });
  if (has(b, 'evacuationModes')) {
    const modes = Array.isArray(b.evacuationModes) ? (b.evacuationModes as unknown[]) : [];
    out.evacuationModes = modes.map((m) => oneOf(m, 'evacuationModes', MODES));
  }
  if (has(b, 'installationId')) {
    if (!text(b.installationId)) out.installation = null;
    else {
      const i = activeRef(TABLES.installations, b.installationId, 'installationId', 'installation');
      if (i.location.id !== location.id)
        invalid({ installationId: 'Choose an installation at this location' });
      out.installation = refOf(i);
    }
  }
  return out;
}

function lifeboatValues(b: Body, current: Lifeboat | null): Body {
  const out: Body = {};
  if (!current) {
    out.code = codeOf(b, 20);
    out.location = refOf(activeRef(TABLES.locations, b.locationId, 'locationId', 'location'));
  }
  if (!current || has(b, 'name')) out.name = required(b.name, 'name');
  if (!current || has(b, 'craftType')) {
    out.craftType = oneOf(b.craftType ?? 'lifeboat', 'craftType', [
      'lifeboat',
      'liferaft',
      'rescue-boat',
    ] as const);
  }
  if (!current || has(b, 'ratedCapacity')) {
    out.ratedCapacity =
      numberOf(b.ratedCapacity, 'ratedCapacity', { positive: true, integer: true }) ??
      invalid({ ratedCapacity: 'Required' });
  }
  if (has(b, 'station')) out.station = text(b.station);
  if (has(b, 'certificateExpiresOn'))
    out.certificateExpiresOn = dateOf(b.certificateExpiresOn, 'certificateExpiresOn');
  return out;
}

function essentialValues(b: Body, current: EssentialPosition | null): Body {
  const out: Body = {};
  if (!current || has(b, 'classification')) {
    out.classification = oneOf(b.classification, 'classification', [
      'essential',
      'non-essential',
    ] as const);
  }
  if (has(b, 'minCount'))
    out.minCount = numberOf(b.minCount, 'minCount', { positive: true, integer: true });
  if (has(b, 'criticality')) {
    out.criticality =
      b.criticality === null
        ? null
        : oneOf(b.criticality, 'criticality', ['low', 'medium', 'high'] as const);
  }
  if (has(b, 'notes')) out.notes = text(b.notes);
  return out;
}

function effectiveFrom(b: Body): string {
  const from = dateOf(b.effectiveFrom, 'effectiveFrom') ?? gstDate();
  if (from < gstDate()) invalid({ effectiveFrom: 'Can’t be backdated' });
  return from;
}

/** Applies an approved change to its master; false when the record is gone. */
function apply(c: PendingChangeRow): boolean {
  const master = c.master;
  const stamp = { pendingChange: null, updatedAt: now() };
  if (c.action === 'create') {
    const p = c.payload;
    const base = {
      id: c.record?.id ?? newId(),
      isActive: true,
      deactivatedReason: null,
      version: 1,
      ...stamp,
    };
    if (master === 'muster-points') {
      insert<MusterPoint>(master, {
        ...base,
        code: String(p.code),
        name: String(p.name),
        location: p.location as Ref,
        installation: (p.installation as Ref | undefined) ?? null,
        role: p.role as MusterPoint['role'],
        capacity: (p.capacity as number | undefined) ?? null,
        evacuationModes: (p.evacuationModes as MusterPoint['evacuationModes'] | undefined) ?? [],
        isOperational: true,
        unavailableReasonCode: null,
        unavailableReason: null,
        unavailableSince: null,
      });
    } else if (master === 'lifeboats') {
      insert<Lifeboat>(master, {
        ...base,
        code: String(p.code),
        name: String(p.name),
        location: p.location as Ref,
        craftType: p.craftType as Lifeboat['craftType'],
        station: (p.station as string | null | undefined) ?? null,
        ratedCapacity: Number(p.ratedCapacity),
        certificateExpiresOn: (p.certificateExpiresOn as string | null | undefined) ?? null,
        isInService: true,
        outOfServiceReason: null,
        outOfServiceSince: null,
      });
    } else {
      const from = String(p.effectiveFrom);
      insert<EssentialPosition>(master, {
        ...base,
        designation: String(p.designation),
        location: p.location as Ref,
        classification: p.classification as EssentialPosition['classification'],
        minCount: (p.minCount as number | null | undefined) ?? null,
        criticality: (p.criticality as EssentialPosition['criticality'] | undefined) ?? null,
        notes: (p.notes as string | null | undefined) ?? null,
        effectiveFrom: from,
        inForce: from <= gstDate(),
      });
    }
    return true;
  }
  const record = c.record ? find<PobRecord>(master, c.record.id) : undefined;
  if (!record) return false;
  const next = { ...record, ...stamp, version: record.version + 1 } as Body & PobRecord;
  switch (c.action) {
    case 'update': {
      Object.assign(next, c.payload);
      if (master === 'essential-positions') {
        const e = record as EssentialPosition;
        const from = text(c.payload.effectiveFrom) ?? gstDate();
        insert<EssentialVersionRow>('essential-versions', {
          id: newId(),
          positionId: e.id,
          classification: e.classification,
          minCount: e.minCount,
          criticality: e.criticality,
          notes: e.notes,
          effectiveFrom: e.effectiveFrom,
          effectiveTo: from,
          isActive: e.isActive,
        });
        Object.assign(next, { effectiveFrom: from, inForce: from <= gstDate() });
      }
      break;
    }
    case 'deactivate':
      Object.assign(next, { isActive: false, deactivatedReason: c.reason });
      break;
    case 'reactivate':
      Object.assign(next, { isActive: true, deactivatedReason: null });
      break;
    case 'return-to-use':
      Object.assign(
        next,
        master === 'lifeboats'
          ? { isInService: true, outOfServiceReason: null, outOfServiceSince: null }
          : {
              isOperational: true,
              unavailableReasonCode: null,
              unavailableReason: null,
              unavailableSince: null,
            },
      );
      break;
    case 'delete':
      removeRow(master, record.id);
      return true;
  }
  replace<PobRecord>(master, next);
  return true;
}

/**
 * Decides a POB master change's approval task: applies it, or returns it to the requester.
 * Returns null when the task isn't one of these changes (so an approvals service can delegate).
 */
export function decidePobTask(
  taskId: string,
  decision: 'approve' | 'reject',
  ifMatch: string | null,
  note: string | null = null,
): components['schemas']['ApprovalOutcome'] | null {
  const c = all<PendingChangeRow>(PENDING).find((x) => x.taskId === taskId);
  if (!c) return null;
  if (ifMatch !== null && Number(ifMatch) !== c.version) {
    throw new MockError(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this task. Reload and try again.',
    );
  }
  if (c.status !== 'pending')
    throw new MockError(409, 'TASK_DECIDED', 'This change has already been decided.');
  if (mine(c))
    throw new MockError(403, 'SELF_APPROVAL', 'A second person must decide your own change.');
  let status: PendingChangeRow['status'] = 'returned';
  if (decision === 'approve') status = apply(c) ? 'approved' : 'failed';
  else if (!note) invalid({ comment: 'Say why the change is returned' });
  if (c.record && status !== 'approved') mark(c.master, c.record.id, null);
  const row = replace<PendingChangeRow>(PENDING, {
    ...c,
    status,
    decidedAt: now(),
    decisionNote: note,
    version: c.version + 1,
  });
  audit(
    'pending-master-change',
    { id: c.id, ref: c.ref, label: c.summary },
    status,
    `Change ${status} · ${c.ref}`,
    {
      reason: note,
    },
  );
  if (status === 'approved' && c.record) {
    audit(
      c.master.replace(/s$/, ''),
      { id: c.record.id, ref: c.record.code, label: c.record.name },
      c.action,
      `${capital(POB_NOUN[c.master])} ${c.action} approved · ${c.ref}`,
      {
        before: row.before,
        after: row.after,
      },
    );
  }
  return {
    instanceId: row.approvalId ?? row.id,
    status: status === 'approved' ? 'approved' : status === 'returned' ? 'rejected' : 'cancelled',
  };
}

function registerPobMaster<T extends PobRecord>(
  master: PobMaster,
  spec: ListSpec<T> & { options: () => unknown },
  values: (b: Body, current: T | null) => Body,
): void {
  const base = `${M}/${master}`;
  const noun = POB_NOUN[master];
  masterCrud<MasterRow>(base, master, noun, {
    ...(spec as unknown as ListSpec<MasterRow>),
    options: spec.options,
    describe: (row) => {
      const r = row as unknown as T;
      return { ref: recordRef(master, r).code, label: label(master, r) };
    },
  });
  if (master !== 'essential-positions') {
    route('POST', base, (req) => {
      const b = bodyOf(req);
      const after = values(b, null);
      const code = String(after.code);
      taken(master, 'code', code);
      const clash = all<PendingChangeRow>(PENDING).some(
        (c) =>
          c.status === 'pending' &&
          c.action === 'create' &&
          c.master === master &&
          c.payload.code === code,
      );
      if (clash)
        throw new MockError(409, 'CODE_TAKEN', 'A pending change already adds this code.', {
          fields: { code: 'Pending' },
        });
      const location = after.location as Ref;
      return proposed([
        propose(master, 'create', null, {
          location,
          record: { id: newId(), code, name: String(after.name) },
          summary: `Add ${code} · ${String(after.name)} at ${location.name}`,
          payload: after,
          after,
        }),
      ]);
    });
  }
  route('PATCH', `${base}/:id`, (req) => {
    const record = current(master as Table<T>, req, noun);
    const b = bodyOf(req);
    const { before, after } = changes(record, values(b, record));
    const payload =
      master === 'essential-positions' ? { ...after, effectiveFrom: effectiveFrom(b) } : after;
    return proposed([
      propose(master, 'update', record, {
        location: record.location,
        summary: `Change ${label(master, record)}: ${describeValues(after)}`,
        reason: text(b.reason),
        payload,
        before,
        after: payload,
      }),
    ]);
  });
  const lifecycle = (action: 'deactivate' | 'reactivate' | 'delete') => (req: MockRequest) => {
    const record = current(master as Table<T>, req, noun);
    const reason = required(bodyOf(req).reason, 'reason');
    if (action !== 'delete' && record.isActive === (action === 'reactivate')) {
      throw new MockError(
        409,
        'ALREADY_IN_STATE',
        `The ${noun} is already ${record.isActive ? 'active' : 'deactivated'}.`,
      );
    }
    const verb = { deactivate: 'Deactivate', reactivate: 'Reactivate', delete: 'Delete' }[action];
    return proposed([
      propose(master, action, record, {
        location: record.location,
        summary: `${verb} ${label(master, record)}`,
        reason,
        payload: {},
        before: { isActive: record.isActive },
        after: action === 'delete' ? { deleted: true } : { isActive: action === 'reactivate' },
      }),
    ]);
  };
  route('POST', `${base}/:id/deactivate`, lifecycle('deactivate'));
  route('POST', `${base}/:id/reactivate`, lifecycle('reactivate'));
  route('DELETE', `${base}/:id`, lifecycle('delete'));
}

function registerPob(): void {
  const locationOptions = () => activeRefs(all<Location>('locations'));

  registerPobMaster<MusterPoint>(
    'muster-points',
    {
      search: (m) => [m.code, m.name, m.location.name, m.installation?.name],
      filters: {
        location: (m, v) => m.location.id === v,
        operational: (m, v) => String(m.isOperational) === v,
      },
      sorts: { location: (m) => `${m.location.name} ${m.code}` },
      defaultSort: 'location:asc',
      options: () => ({
        locations: locationOptions(),
        installations: all<Installation>('installations')
          .filter((i) => i.isActive)
          .map((i) => ({ ...refOf(i), locationId: i.location.id })),
      }),
    },
    (b, c) => musterValues(b, c),
  );
  registerPobMaster<Lifeboat>(
    'lifeboats',
    {
      search: (l) => [l.code, l.name, l.location.name, l.station],
      filters: {
        location: (l, v) => l.location.id === v,
        inService: (l, v) => String(l.isInService) === v,
        expiring: (l, v) =>
          String(l.certificateExpiresOn !== null && l.certificateExpiresOn <= gstDate(30)) === v,
      },
      sorts: {
        location: (l) => `${l.location.name} ${l.code}`,
        certificate: (l) => l.certificateExpiresOn,
      },
      defaultSort: 'location:asc',
      options: () => ({ locations: locationOptions() }),
    },
    (b, c) => lifeboatValues(b, c),
  );
  const designations = () =>
    [
      ...new Set([
        ...DESIGNATIONS,
        ...all<EssentialPosition>('essential-positions').map((e) => e.designation),
      ]),
    ].sort();
  registerPobMaster<EssentialPosition>(
    'essential-positions',
    {
      search: (e) => [e.designation, e.location.name, e.notes],
      filters: { location: (e, v) => e.location.id === v },
      sorts: { location: (e) => `${e.location.name} ${e.designation}` },
      defaultSort: 'location:asc',
      options: () => ({
        locations: all<Location>('locations')
          .filter((l) => l.isActive && l.locationType.isOffshore)
          .map(refOf)
          .sort((a, b) => a.name.localeCompare(b.name)),
        designations: designations(),
      }),
    },
    (b, c) => essentialValues(b, c),
  );

  // One essential-position proposal per site, in one batch.
  route('POST', `${M}/essential-positions`, (req) => {
    const b = bodyOf(req);
    const designation = required(b.designation, 'designation');
    const ids = Array.isArray(b.locationIds) ? (b.locationIds as unknown[]) : [];
    if (ids.length === 0) invalid({ locationIds: 'Choose at least one site' });
    const values: Body = { ...essentialValues(b, null), effectiveFrom: effectiveFrom(b) };
    const sites = ids.map((id, i) =>
      refOf(activeRef(TABLES.locations, id, `locationIds.${i}`, 'site')),
    );
    const existing = all<EssentialPosition>('essential-positions');
    const mapped = sites.find((s) =>
      existing.some(
        (e) => e.location.id === s.id && e.designation.toLowerCase() === designation.toLowerCase(),
      ),
    );
    if (mapped) {
      throw new MockError(
        409,
        'DESIGNATION_MAPPED',
        `${designation} is already mapped at ${mapped.name}.`,
      );
    }
    const batchId = sites.length > 1 ? newId() : null;
    return proposed(
      sites.map((location) => {
        const payload = {
          designation,
          location,
          minCount: null,
          criticality: null,
          notes: null,
          ...values,
        };
        return propose('essential-positions', 'create', null, {
          location,
          batchId,
          record: { id: newId(), code: designation, name: designation },
          summary: `Map ${designation} at ${location.name} as ${String(values.classification)}`,
          payload,
          after: payload,
        });
      }),
    );
  });
  route('GET', `${M}/essential-positions/unmapped`, (req) => {
    const location = find<Location>('locations', req.query.get('location') ?? '');
    if (!location) return notFound('location');
    const rows = all<EssentialPosition>('essential-positions').filter((e) => e.isActive);
    const here = new Set(
      rows.filter((e) => e.location.id === location.id).map((e) => e.designation),
    );
    const items = designations()
      .filter((d) => !here.has(d))
      .map((designation) => ({
        designation,
        sitesMapped: new Set(
          rows.filter((e) => e.designation === designation).map((e) => e.location.id),
        ).size,
      }));
    return json({ location: refOf(location), items });
  });
  route('GET', `${M}/essential-positions/:id/timeline`, (req) => {
    const e = find<EssentialPosition>('essential-positions', req.params.id ?? '');
    if (!e) return notFound('essential position');
    const now_ = {
      id: e.id,
      classification: e.classification,
      minCount: e.minCount,
      criticality: e.criticality,
      notes: e.notes,
      effectiveFrom: e.effectiveFrom,
      effectiveTo: null,
      isActive: e.isActive,
    };
    const past = all<EssentialVersionRow>('essential-versions')
      .filter((v) => v.positionId === e.id)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
      .map((v) => without(v, 'positionId'));
    return json({ items: [now_, ...past] });
  });

  // Out of use at once (P-57); back into use is a proposal.
  route('POST', `${M}/muster-points/:id/unavailable`, (req) => {
    const m = current(TABLES.musterPoints, req, 'muster point');
    const b = bodyOf(req);
    const reason = required(b.reason, 'reason');
    if (!m.isOperational)
      throw new MockError(409, 'ALREADY_UNAVAILABLE', 'This muster point is already out of use.');
    const next = saved<MusterPoint>('muster-points', {
      ...m,
      isOperational: false,
      unavailableReasonCode: text(b.reasonCode),
      unavailableReason: reason,
      unavailableSince: now(),
    });
    audit(
      'muster-point',
      { id: m.id, ref: m.code, label: m.name },
      'unavailable',
      'Muster point out of use',
      { reason },
    );
    return json(next);
  });
  route('POST', `${M}/lifeboats/:id/out-of-service`, (req) => {
    const l = current(TABLES.lifeboats, req, 'lifeboat');
    const reason = required(bodyOf(req).reason, 'reason');
    if (!l.isInService)
      throw new MockError(409, 'ALREADY_OUT_OF_SERVICE', 'This craft is already out of service.');
    const next = saved<Lifeboat>('lifeboats', {
      ...l,
      isInService: false,
      outOfServiceReason: reason,
      outOfServiceSince: now(),
    });
    audit(
      'lifeboat',
      { id: l.id, ref: l.code, label: l.name },
      'out-of-service',
      'Lifeboat out of service',
      { reason },
    );
    return json(next);
  });
  for (const master of ['muster-points', 'lifeboats'] as const) {
    route('POST', `${M}/${master}/:id/return-to-use`, (req) => {
      const record = current(master as Table<MusterPoint | Lifeboat>, req, POB_NOUN[master]);
      const reason = required(bodyOf(req).reason, 'reason');
      const inUse = 'isInService' in record ? record.isInService : record.isOperational;
      if (inUse)
        throw new MockError(409, 'ALREADY_IN_USE', `This ${POB_NOUN[master]} is already in use.`);
      return proposed([
        propose(master, 'return-to-use', record, {
          location: record.location,
          summary: `Return ${record.code} · ${record.name} to use`,
          reason,
          payload: {},
          before: { inUse: false },
          after: { inUse: true },
        }),
      ]);
    });
  }
  route('GET', `${M}/lifeboats/capacity`, () => {
    const boats = all<Lifeboat>('lifeboats').filter((b) => b.isActive);
    const sites = [...new Map(boats.map((b) => [b.location.id, b.location])).values()];
    const items = sites
      .map((location) => {
        const here = boats.filter((b) => b.location.id === location.id);
        const inService = here.filter((b) => b.isInService);
        const capacity = inService.reduce((sum, b) => sum + b.ratedCapacity, 0);
        const heldBack =
          inService.length > 0 ? Math.max(...inService.map((b) => b.ratedCapacity)) : null;
        return {
          location,
          craft: here.length,
          inService: inService.length,
          inServiceCapacity: capacity,
          heldBack,
          countedCapacity: capacity - (heldBack ?? 0),
        };
      })
      .sort((a, b) => a.location.name.localeCompare(b.location.name));
    return json({ holdBackLargest: true, items });
  });

  // Pending changes.
  const base = `${M}/pending-changes`;
  const pendingList: ListSpec<PendingMasterChange> = {
    hasActive: false,
    search: (c) => [
      c.ref,
      c.summary,
      c.record?.code,
      c.record?.name,
      c.location.name,
      c.requestedBy.name,
    ],
    filters: {
      mine: (c, v) => String(c.canWithdraw || c.myTask !== null) === v,
      location: (c, v) => c.location.id === v,
    },
    defaultSort: 'requestedAt:desc',
  };
  route('GET', base, (req) =>
    json(listRows(all<PendingChangeRow>(PENDING).map(view), req.query, pendingList)),
  );
  route('GET', `${base}/:id`, (req) => {
    const c = find<PendingChangeRow>(PENDING, req.params.id ?? '');
    return c ? json(view(c)) : notFound('change');
  });
  route('GET', `${base}/:id/history`, (req) => json(trail(req.params.id ?? '')));
  route('POST', `${base}/:id/withdraw`, (req) => {
    const c = current(PENDING as Table<PendingChangeRow>, req, 'change');
    const reason = required(bodyOf(req).reason, 'reason');
    if (c.status !== 'pending')
      throw new MockError(409, 'TASK_DECIDED', 'This change has already been decided.');
    if (!mine(c))
      throw new MockError(
        403,
        'FORBIDDEN',
        'Only the person who proposed a change can withdraw it.',
      );
    if (c.record) mark(c.master, c.record.id, null);
    const next = replace<PendingChangeRow>(PENDING, {
      ...c,
      status: 'withdrawn',
      decidedAt: now(),
      decisionNote: reason,
      version: c.version + 1,
    });
    audit(
      'pending-master-change',
      { id: c.id, ref: c.ref, label: c.summary },
      'withdrawn',
      `Change withdrawn · ${c.ref}`,
      { reason },
    );
    return json(view(next));
  });
  route('POST', '/api/v1/approvals/tasks/:id/approve', (req) => {
    const outcome = decidePobTask(req.params.id ?? '', 'approve', req.headers.get('If-Match'));
    return outcome ? json(outcome) : notFound('task');
  });
  route('POST', '/api/v1/approvals/tasks/:id/reject', (req) => {
    const b = bodyOf(req);
    const note = [text(b.reasonCode), text(b.comment)].filter(Boolean).join(' · ') || null;
    const outcome = decidePobTask(req.params.id ?? '', 'reject', req.headers.get('If-Match'), note);
    return outcome ? json(outcome) : notFound('task');
  });
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerPlaces(): void {
  seed('zones', () => ZONES);
  seed('location-types', () => LOCATION_TYPES);
  seed('installation-types', () => INSTALLATION_TYPES);
  seed('locations', () => LOCATIONS);
  seed('installations', () => INSTALLATIONS);
  seed('installation-files', () => INSTALLATION_FILES);
  seed('routes', () => ROUTES);
  seed('route-revisions', () => ROUTE_REVISIONS);
  seed('departments', () => DEPARTMENTS);
  seed('companies', () => COMPANIES);
  seed('service-providers', () => SERVICE_PROVIDERS);
  seed('charge-codes', () => CHARGE_CODES);
  seed('passenger-categories', () => PASSENGER_CATEGORIES);
  seed('external-contacts', () => EXTERNAL_CONTACTS);
  seed('muster-points', () => MUSTER_POINTS);
  seed('lifeboats', () => LIFEBOATS);
  seed('essential-positions', () => ESSENTIAL_POSITIONS);
  seed('essential-versions', () => ESSENTIAL_VERSIONS);
  seed(PENDING, () => PENDING_CHANGES);

  registerTypes();
  registerLocations();
  registerInstallations();
  registerRoutes();
  registerOrganisations();
  registerContacts();
  registerPob();
}
