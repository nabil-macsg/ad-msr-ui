/**
 * Scheduling demo service (spec 20 §2.1): recurring schedules, ad hoc movements, the journeys
 * they plan, the dashboard, Planning Board, unscheduled requests and pre-manifests.
 *
 * Journeys are not stored: they are planned on demand from the schedules and movements over the
 * 180-day horizon, so the screens always show today. Only what departs from that plan is stored
 * (`scheduling-journey-overrides`): a departure time given on the board, a cancellation, or a
 * booked journey an edit left as it was (needing reassignment).
 */
import type { components } from '../../api/schema';
import { audit, trail } from '../core/audit';
import { bodyOf, json, MockError, type MockRequest, notFound } from '../core/http';
import { listRows, type ListSpec } from '../core/list';
import { route } from '../core/router';
import { all, find, insert, newId, now, replace, seed } from '../core/store';
import { gstDate, idFor } from '../data/ids';
import {
  addDays,
  adhocRows,
  BAND,
  baseModeOf,
  CATEGORIES,
  categoryOfMode,
  chance,
  DISPATCH_MANIFESTS,
  FLEET,
  fleetById,
  HELIDECK_LIMITS,
  isoWeekday,
  type Journey,
  type JourneyOverride,
  type KeptJourney,
  LOCATIONS,
  type Mode,
  overrideRows,
  passengerCategory,
  PEOPLE,
  type Person,
  PROVIDERS,
  providerByCode,
  type RecurringSchedule,
  requestRows,
  RESOURCE_TYPES,
  resourceTypeById,
  routeById,
  routeRef,
  ROUTES,
  type RouteInfo,
  scheduleRows,
  type Stop,
  type StoredAdhoc,
  type StoredRequest,
  type StoredSchedule,
  WEATHER,
  WEATHER_DAYS,
} from '../data/scheduling';

type Schemas = components['schemas'];
type AdhocMovement = Schemas['AdhocMovement'];
type UnscheduledRequest = Schemas['UnscheduledRequest'];
type Premanifest = Schemas['Premanifest'];
type PremanifestLine = Schemas['PremanifestLine'];
type PremanifestRun = NonNullable<Schemas['PremanifestRun']>;

const SCHEDULES = 'scheduling-schedules';
const ADHOC = 'scheduling-adhoc-movements';
const OVERRIDES = 'scheduling-journey-overrides';
const REQUESTS = 'scheduling-unscheduled-requests';
const PREMANIFESTS = 'scheduling-premanifests';

const BASE = '/api/v1/scheduling';
const SCHEDULES_PATH = `${BASE}/recurring-schedules`;
const ADHOC_PATH = `${BASE}/adhoc-movements`;

/** Journeys are planned this many days ahead (BRD A.3.3-3). */
const HORIZON_DAYS = 180;
/** Bookings open this many days ahead: journeys beyond have none yet. */
const BOOKED_DAYS = 14;
const MODES: readonly Mode[] = ['fixed-wing', 'rotary-wing', 'ferry', 'crew-boat'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const today = () => gstDate(0);
const horizon = () => addDays(today(), HORIZON_DAYS);
const daysFrom = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const at = (date: string, time: string) => new Date(`${date}T${time}:00+04:00`).toISOString();
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- Shared helpers ------------------------------------------------------------------------------

/** Collects field problems and answers 422 VALIDATION_FAILED with all of them. */
class Problems {
  readonly fields: Record<string, string> = {};
  add(field: string, message: string) {
    this.fields[field] ??= message;
  }
  get any() {
    return Object.keys(this.fields).length > 0;
  }
  throwIfAny() {
    if (this.any) {
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: this.fields,
      });
    }
  }
}

function checkVersion(req: MockRequest, version: number) {
  const ifMatch = req.headers.get('If-Match');
  if (ifMatch !== null && Number(ifMatch) !== version) {
    throw new MockError(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this record. Reload and try again.',
    );
  }
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

function csv(rows: readonly Record<string, unknown>[], name: string): Response {
  const headers = Object.keys(rows[0] ?? {});
  const cell = (v: unknown) => {
    const value =
      typeof v === 'string' ? v : v === null || v === undefined ? '' : JSON.stringify(v);
    return `"${value.replace(/"/g, '""')}"`;
  };
  const body = [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))];
  return new Response(body.join('\n'), {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="${name}-demo.csv"`,
    },
  });
}

function withoutPaging(query: URLSearchParams): URLSearchParams {
  const copy = new URLSearchParams(query);
  copy.delete('page');
  copy.delete('pageSize');
  return copy;
}

// ---- Journey planning ----------------------------------------------------------------------------

/** What a journey is made from: a schedule, an ad hoc movement or a kept journey's snapshot. */
interface Source {
  kind: 'recurring' | 'adhoc';
  id: string;
  ref: string;
  flightNumber: string;
  route: RecurringSchedule['route'];
  mode: Mode;
  resourceType: RecurringSchedule['resourceType'];
  fleet: RecurringSchedule['fleet'];
  serviceProvider: RecurringSchedule['serviceProvider'];
  departureTime: string | null;
  arrivalTime: string | null;
  /** Seats booked on each journey; null for seeded sources, whose demand is simulated. */
  booked: number | null;
}

/** Seeded schedules and movements carry simulated bookings; ones made in the demo start empty. */
const SEEDED = new Set<string>();
const scheduleSource = (s: StoredSchedule): Source => ({
  kind: 'recurring',
  ...s,
  booked: SEEDED.has(s.id) ? null : 0,
});
// A movement made from unscheduled requests carries them as its bookings.
const adhocSource = (a: StoredAdhoc): Source => ({
  kind: 'adhoc',
  ...a,
  booked: SEEDED.has(a.id) ? null : a.requestIds.length,
});

/** The days a schedule plans between two days: its weekdays within its validity, until ended. */
function plannedDates(
  s: Pick<StoredSchedule, 'days' | 'validFrom' | 'validTo' | 'endedOn'>,
  from: string,
  to: string,
): string[] {
  const ends = [to, s.validTo, s.endedOn].filter((d): d is string => d !== null).sort();
  const last = ends[0] ?? to;
  const dates: string[] = [];
  for (let d = s.validFrom > from ? s.validFrom : from; d <= last; d = addDays(d, 1)) {
    if (s.days.includes(isoWeekday(d))) dates.push(d);
  }
  return dates;
}

const routeTypeOf = (stops: readonly Stop[]): Journey['route']['type'] => {
  if (stops.some((s) => s.code === 'AUH')) return 'auh';
  const zones = new Set(stops.map((s) => LOCATIONS.get(s.code)?.zone ?? s.code));
  return zones.size === 1 ? 'intra-field' : 'inter-field';
};

const QUOTA: Readonly<Record<string, number>> = { 'DASH8-300': 3, 'LET-410': 1 };

function seatsOf(id: string, date: string, capacity: number | null, manifest?: number) {
  const r = chance(id);
  const r2 = chance(`${id}:demand`);
  const d = daysFrom(today(), date);
  const cap = capacity ?? 0;
  // Big boats rarely fill.
  const fill = cap >= 80 ? 0.45 : 1;
  let booked = 0;
  if (manifest !== undefined) booked = manifest;
  else if (cap === 0) booked = 0;
  else if (d <= 0) booked = Math.round(cap * fill * Math.min(0.96, 0.55 + 0.45 * r));
  else if (d <= BOOKED_DAYS)
    booked = Math.max(1, Math.round(cap * fill * (0.3 + 0.65 * r) * (1 - d / (BOOKED_DAYS + 8))));
  const pending = d > 0 && d <= BOOKED_DAYS + 7 ? Math.floor(r2 * 4) : 0;
  const waitlisted = d >= 0 && cap > 0 && booked >= cap * 0.85 ? 1 + Math.floor(r2 * 5) : 0;
  return { capacity, booked, pending, waitlisted };
}

function weatherOf(stops: readonly Stop[], mode: Mode, date: string): Journey['weather'] {
  const offset = daysFrom(today(), date);
  if (offset < 0 || offset >= WEATHER_DAYS) return null;
  const marine = baseModeOf(mode) === 'marine';
  const notes = WEATHER.filter(
    (w) =>
      w.offset === offset &&
      stops.some((s) => s.code === w.location) &&
      (w.applies === 'all' || (w.applies === 'marine') === marine),
  ).sort((a, b) => (a.level === b.level ? 0 : a.level === 'adverse' ? -1 : 1));
  const w = notes[0];
  if (!w) return null;
  const l = LOCATIONS.get(w.location);
  return {
    level: w.level,
    location: l
      ? { id: l.id, code: l.code, name: l.name }
      : { id: w.location, code: w.location, name: w.location },
    summary: w.summary,
    recommendation: w.recommendation,
  };
}

function compatibilityOf(
  stops: readonly Stop[],
  mode: Mode,
  typeCode: string,
): Journey['compatibility'] {
  if (mode !== 'rotary-wing') return null;
  const reasons = HELIDECK_LIMITS.filter(
    (h) => h.resourceType === typeCode && stops.some((s) => s.code === h.location),
  ).map((h) => {
    const s = stops.find((x) => x.code === h.location) as Stop;
    return { location: s, code: 'HELIDECK_LIMIT', message: h.message };
  });
  return { outcome: reasons.length > 0 ? 'flag' : 'ok', reasons };
}

function gateOf(id: string, stops: readonly Stop[], mode: Mode, date: string): string | null {
  const d = daysFrom(today(), date);
  if (d < 0 || d > 1 || stops[0]?.code !== 'AUH') return null;
  const n = 1 + Math.floor(chance(`${id}:gate`) * 4);
  if (mode === 'fixed-wing') return `Gate ${n}`;
  if (mode === 'rotary-wing') return `Helipad ${n}`;
  return `Mina Zayed Berth ${n}`;
}

function statusOf(
  date: string,
  mode: Mode,
  departureAt: string | null,
  arrivalAt: string | null,
  weather: Journey['weather'],
): Journey['status'] {
  const day = today();
  if (date < day) return 'closed';
  if (date > day || departureAt === null) return 'scheduled';
  const t = Date.now();
  const dep = Date.parse(departureAt);
  const arr = arrivalAt ? Date.parse(arrivalAt) : dep + 3_600_000;
  // NCM's caution at the helideck holds rotary-wing departures (SCH-R7).
  if (weather && mode === 'rotary-wing' && t < dep + 45 * 60_000) return 'delayed';
  if (t >= arr) return 'arrived';
  if (t >= dep) return 'departed';
  if (t >= dep - 30 * 60_000) return 'boarding';
  if (t >= dep - 120 * 60_000) return 'check-in';
  return 'open';
}

function buildJourney(src: Source, date: string, ov: JourneyOverride | undefined): Journey {
  const kept: KeptJourney | undefined = ov?.kept;
  const v = kept ?? src;
  const id = ov?.id ?? idFor('journey', `${v.flightNumber}:${date}`);
  const times = ov?.departure ?? { departureTime: v.departureTime, arrivalTime: v.arrivalTime };
  const departureAt = times.departureTime ? at(date, times.departureTime) : null;
  let arrivalAt: string | null = null;
  if (times.departureTime && times.arrivalTime) {
    const overnight = times.arrivalTime < times.departureTime;
    arrivalAt = at(overnight ? addDays(date, 1) : date, times.arrivalTime);
  }
  const type = resourceTypeById(v.resourceType.id);
  const unit = v.fleet ? fleetById(v.fleet.id) : undefined;
  const manifest = DISPATCH_MANIFESTS.get(`${v.flightNumber}:${date}`)?.length;
  const seats = seatsOf(id, date, type?.capacity ?? null, manifest ?? src.booked ?? undefined);
  const weather = weatherOf(v.route.stops, v.mode, date);
  const flags: Journey['flags'] = [];
  if (departureAt === null) flags.push('no-time');
  if (v.fleet === null) flags.push('no-resource');
  if (unit?.availability === 'maintenance' && date >= today()) flags.push('resource-maintenance');
  const routeType = routeTypeOf(v.route.stops);
  const cutoffTime = routeType === 'auh' ? '14:00' : routeType === 'inter-field' ? '16:00' : null;
  return {
    id,
    flightNumber: v.flightNumber,
    serviceDate: date,
    departureAt,
    arrivalAt,
    departureAssigned: ov?.departure !== undefined,
    route: {
      id: v.route.id,
      code: v.route.code,
      name: v.route.name,
      stops: v.route.stops,
      type: routeType,
    },
    mode: v.mode,
    category: categoryOfMode(v.mode),
    resourceType: v.resourceType,
    fleet: v.fleet,
    serviceProvider: v.serviceProvider,
    source: { kind: src.kind, id: src.id, ref: src.ref },
    status: ov?.status ?? statusOf(date, v.mode, departureAt, arrivalAt, weather),
    gate: gateOf(id, v.route.stops, v.mode, date),
    seats: { ...seats, quota: type ? (QUOTA[type.code] ?? null) : null },
    compatibility: compatibilityOf(v.route.stops, v.mode, v.resourceType.code),
    cutoffAt: cutoffTime ? at(addDays(date, -1), cutoffTime) : null,
    flags,
    weather,
    version: ov?.version ?? 1,
  };
}

const overrideKey = (sourceId: string, date: string) => `${sourceId}|${date}`;

/** Every journey planned between two days (inclusive), with fleet overlaps flagged (SCH-R8). */
function journeysBetween(from: string, to: string): Journey[] {
  const last = to < horizon() ? to : horizon();
  const overrides = new Map(
    all<JourneyOverride>(OVERRIDES).map((o) => [overrideKey(o.sourceId, o.serviceDate), o]),
  );
  const out: Journey[] = [];
  for (const s of all<StoredSchedule>(SCHEDULES)) {
    const src = scheduleSource(s);
    const dates = new Set(plannedDates(s, from, last));
    for (const o of all<JourneyOverride>(OVERRIDES)) {
      if (o.sourceId === s.id && o.kept && o.serviceDate >= from && o.serviceDate <= last)
        dates.add(o.serviceDate);
    }
    for (const date of dates)
      out.push(buildJourney(src, date, overrides.get(overrideKey(s.id, date))));
  }
  for (const a of all<StoredAdhoc>(ADHOC)) {
    if (a.serviceDate < from || a.serviceDate > last) continue;
    const ov = overrides.get(overrideKey(a.id, a.serviceDate));
    const j = buildJourney(adhocSource(a), a.serviceDate, ov);
    out.push(a.isActive ? j : { ...j, status: 'cancelled' });
  }
  markOverlaps(out);
  return out;
}

function markOverlaps(journeys: Journey[]) {
  const byUnit = new Map<string, Journey[]>();
  for (const j of journeys) {
    if (!j.fleet || j.status === 'cancelled' || j.serviceDate < today()) continue;
    const key = `${j.fleet.id}|${j.serviceDate}`;
    byUnit.set(key, [...(byUnit.get(key) ?? []), j]);
  }
  const span = (j: Journey) => {
    const dep = Date.parse(j.departureAt ?? '');
    return [dep, j.arrivalAt ? Date.parse(j.arrivalAt) : dep + 3_600_000] as const;
  };
  for (const group of byUnit.values()) {
    for (const a of group) {
      for (const b of group) {
        if (a === b || !a.departureAt || !b.departureAt) continue;
        const [a0, a1] = span(a);
        const [b0, b1] = span(b);
        if (a0 < b1 && b0 < a1 && !a.flags.includes('resource-overlap'))
          a.flags.push('resource-overlap');
      }
    }
  }
}

function findJourney(id: string): Journey | undefined {
  return journeysBetween(addDays(today(), -30), horizon()).find((j) => j.id === id);
}

// ---- Recurring schedules -----------------------------------------------------------------------

function directionWarning(flightNumber: string, stops: readonly Stop[]): string | null {
  const first = stops[0];
  const last = stops.at(-1);
  if (!first || !last) return null;
  const hub = (s: Stop) => LOCATIONS.get(s.code)?.hub === true;
  let direction: 'outbound' | 'return' | null = null;
  if (first.code === 'AUH') direction = 'outbound';
  else if (last.code === 'AUH') direction = 'return';
  else if (hub(first) && !hub(last)) direction = 'outbound';
  else if (!hub(first) && hub(last)) direction = 'return';
  const odd = Number(flightNumber.slice(-1)) % 2 === 1;
  if (direction === 'outbound' && !odd)
    return 'Outbound numbers are usually odd; this route runs outbound.';
  if (direction === 'return' && odd)
    return 'Return numbers are usually even; this route runs back to base.';
  return null;
}

function fleetWarning(fleet: RecurringSchedule['fleet']): string | null {
  const unit = fleet ? fleetById(fleet.id) : undefined;
  return unit?.availability === 'maintenance'
    ? `${unit.registration} is in maintenance: its journeys are flagged until it is back.`
    : null;
}

function scheduleView(s: StoredSchedule): RecurringSchedule {
  const day = today();
  const tomorrow = addDays(day, 1);
  const ovs = all<JourneyOverride>(OVERRIDES).filter(
    (o) => o.sourceId === s.id && o.serviceDate > day,
  );
  const dates = new Set(plannedDates(s, tomorrow, horizon()));
  for (const o of ovs) if (o.kept) dates.add(o.serviceDate);
  const cancelled = ovs.filter((o) => o.status === 'cancelled' && dates.has(o.serviceDate)).length;
  const rest: Omit<StoredSchedule, 'endedOn'> & { endedOn?: string | null } = { ...s };
  delete rest.endedOn;
  return {
    ...rest,
    journeys: {
      upcoming: dates.size - cancelled,
      needingReassignment: ovs.filter((o) => o.kept).length,
    },
    warnings: [directionWarning(s.flightNumber, s.route.stops), fleetWarning(s.fleet)].filter(
      (w): w is string => w !== null,
    ),
  };
}

interface ScheduleValues {
  name: string | null;
  flightNumber: string;
  routeId: string;
  mode: Mode;
  resourceTypeId: string;
  fleetId: string | null;
  days: number[];
  departureTime: string | null;
  arrivalTime: string | null;
  validFrom: string;
  validTo: string | null;
}

const valuesOf = (s: StoredSchedule): ScheduleValues => ({
  name: s.name,
  flightNumber: s.flightNumber,
  routeId: s.route.id,
  mode: s.mode,
  resourceTypeId: s.resourceType.id,
  fleetId: s.fleet?.id ?? null,
  days: s.days,
  departureTime: s.departureTime,
  arrivalTime: s.arrivalTime,
  validFrom: s.validFrom,
  validTo: s.validTo,
});

/** Reads a create body, or an edit body over the current values. */
function readScheduleBody(
  body: Record<string, unknown>,
  base: ScheduleValues | null,
): ScheduleValues {
  const has = (k: string) => base === null || k in body;
  const pick = <T>(k: keyof ScheduleValues, read: (v: unknown) => T, fallback: T): T =>
    has(k) ? read(body[k]) : fallback;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    name: pick('name', text, base?.name ?? null),
    flightNumber: pick('flightNumber', (v) => str(v).toUpperCase(), base?.flightNumber ?? ''),
    routeId: pick('routeId', str, base?.routeId ?? ''),
    mode: pick('mode', (v) => v as Mode, base?.mode ?? 'fixed-wing'),
    resourceTypeId: pick('resourceTypeId', str, base?.resourceTypeId ?? ''),
    fleetId: pick('fleetId', text, base?.fleetId ?? null),
    days: pick(
      'days',
      (v) => (Array.isArray(v) ? [...new Set(v.map(Number))].sort((a, b) => a - b) : []),
      base?.days ?? [],
    ),
    departureTime: pick('departureTime', text, base?.departureTime ?? null),
    arrivalTime: pick('arrivalTime', text, base?.arrivalTime ?? null),
    validFrom: pick('validFrom', str, base?.validFrom ?? ''),
    validTo: pick('validTo', text, base?.validTo ?? null),
  };
}

interface Resolved {
  route: RouteInfo;
  provider: RecurringSchedule['serviceProvider'];
  resourceType: RecurringSchedule['resourceType'];
  fleet: RecurringSchedule['fleet'];
}

/** The checks a schedule and an ad hoc movement share: number, route, mode, type, fleet, times. */
function checkMovement(
  p: Problems,
  v: Pick<
    ScheduleValues,
    | 'flightNumber'
    | 'routeId'
    | 'mode'
    | 'resourceTypeId'
    | 'fleetId'
    | 'departureTime'
    | 'arrivalTime'
  >,
  band: number,
): Resolved | null {
  const number = /^([A-Z]{2,3})(\d)\d{2}$/.exec(v.flightNumber);
  const provider = number ? providerByCode(number[1] ?? '') : undefined;
  if (!number) {
    p.add(
      'flightNumber',
      'A flight or voyage number is the operator code and three digits, e.g. ADA101.',
    );
  } else if (Number(number[2]) !== band) {
    p.add(
      'flightNumber',
      band === 9
        ? 'An ad hoc movement is in the 9xx band.'
        : `A ${v.mode.replace('-', ' ')} number is in the ${band}xx band.`,
    );
  } else if (!provider) {
    p.add('flightNumber', `No service provider has the code ${number[1] ?? ''}.`);
  }
  if (!MODES.includes(v.mode)) p.add('mode', 'Choose how it travels.');
  const route = routeById(v.routeId);
  if (!route) p.add('routeId', 'Choose a route.');
  else if (MODES.includes(v.mode) && route.baseMode !== baseModeOf(v.mode))
    p.add('mode', `${route.code} is not travelled by ${v.mode.replace('-', ' ')}.`);
  const type = resourceTypeById(v.resourceTypeId);
  if (!type) p.add('resourceTypeId', 'Choose a type of resource.');
  else if (route && type.category !== route.category)
    p.add('resourceTypeId', `A ${type.name} doesn’t fly or sail ${route.code}.`);
  let fleet: RecurringSchedule['fleet'] = null;
  if (v.fleetId) {
    const unit = fleetById(v.fleetId);
    if (!unit) p.add('fleetId', 'Choose a fleet unit.');
    else if (type && unit.resourceTypeId !== type.id)
      p.add('fleetId', `${unit.registration} is not a ${type.name}.`);
    else if (provider && unit.serviceProviderId !== provider.id)
      p.add('fleetId', `${unit.registration} is not operated by ${provider.code}.`);
    else if (unit.availability === 'retired') p.add('fleetId', `${unit.registration} is retired.`);
    else fleet = { id: unit.id, registration: unit.registration };
  }
  for (const k of ['departureTime', 'arrivalTime'] as const) {
    const t = v[k];
    if (t !== null && !TIME.test(t)) p.add(k, 'Use a 24-hour time, e.g. 07:30.');
  }
  if (v.arrivalTime !== null && v.departureTime === null)
    p.add('arrivalTime', 'Give the departure time with the arrival time.');
  else if (v.arrivalTime !== null && v.arrivalTime === v.departureTime)
    p.add('arrivalTime', 'The arrival time can’t be the departure time.');
  if (!route || !type || !provider) return null;
  return {
    route,
    provider,
    resourceType: { id: type.id, code: type.code, name: type.name },
    fleet,
  };
}

function validateSchedule(v: ScheduleValues, id: string | null): Resolved {
  const p = new Problems();
  const resolved = checkMovement(p, v, MODES.includes(v.mode) ? BAND[v.mode] : 0);
  if (v.days.length === 0 || v.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
    p.add('days', 'Choose at least one day.');
  if (!DATE.test(v.validFrom)) p.add('validFrom', 'Give the day it starts.');
  if (v.validTo !== null && !DATE.test(v.validTo)) p.add('validTo', 'Give a day.');
  else if (v.validTo !== null && v.validTo < v.validFrom)
    p.add('validTo', 'It can’t end before it starts.');
  if (v.name !== null && v.name.length > 200) p.add('name', 'Use 200 characters or fewer.');
  p.throwIfAny();
  const clash = all<StoredSchedule>(SCHEDULES).find(
    (s) =>
      s.id !== id &&
      s.isActive &&
      s.flightNumber === v.flightNumber &&
      plannedDates(s, today(), horizon()).some(
        (d) => plannedDates({ ...v, endedOn: null }, d, d).length > 0,
      ),
  );
  if (clash) {
    throw new MockError(
      409,
      'FLIGHT_NUMBER_TAKEN',
      `${v.flightNumber} already runs on these days as ${clash.ref}.`,
      {
        fields: { flightNumber: `Already used by ${clash.ref}` },
      },
    );
  }
  return resolved as Resolved;
}

function scheduleRow(
  v: ScheduleValues,
  r: Resolved,
  current: StoredSchedule | null,
): StoredSchedule {
  return {
    id: current?.id ?? newId(),
    ref:
      current?.ref ??
      nextRef(
        'RS',
        all<StoredSchedule>(SCHEDULES).map((s) => s.ref),
      ),
    name: v.name,
    displayName: v.name ?? r.route.name,
    flightNumber: v.flightNumber,
    serviceProvider: r.provider,
    route: routeRef(r.route),
    mode: v.mode,
    resourceType: r.resourceType,
    fleet: r.fleet,
    days: v.days,
    departureTime: v.departureTime,
    arrivalTime: v.arrivalTime,
    validFrom: v.validFrom,
    validTo: v.validTo,
    isActive: current?.isActive ?? true,
    deactivatedReason: current?.deactivatedReason ?? null,
    version: (current?.version ?? 0) + 1,
    updatedAt: now(),
    endedOn: current?.endedOn ?? null,
  };
}

function nextRef(prefix: string, refs: readonly string[]): string {
  const max = Math.max(0, ...refs.map((r) => Number(r.slice(prefix.length + 1)) || 0));
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

/** Fields whose change moves a journey's passengers (route, time, number, mode). */
const sameShape = (a: StoredSchedule, b: StoredSchedule) =>
  a.flightNumber === b.flightNumber &&
  a.route.id === b.route.id &&
  a.mode === b.mode &&
  a.departureTime === b.departureTime &&
  a.arrivalTime === b.arrivalTime;

/**
 * Booked journeys from tomorrow that the change would move or drop are kept as they were and
 * listed for reassignment (BRD A.3.3-4); unbooked ones simply follow the schedule.
 */
function keepBooked(
  before: StoredSchedule,
  after: StoredSchedule | null,
  cause: KeptJourney['cause'],
  reason: string,
) {
  const day = today();
  const from = addDays(day, 1);
  const to = addDays(day, BOOKED_DAYS);
  const overrides = all<JourneyOverride>(OVERRIDES);
  const newDates = new Set(after ? plannedDates(after, from, to) : []);
  let kept = 0;
  for (const date of plannedDates(before, from, to)) {
    const ov = overrides.find((o) => o.sourceId === before.id && o.serviceDate === date);
    if (ov?.kept || ov?.status === 'cancelled') continue;
    if (after && newDates.has(date) && sameShape(before, after)) continue;
    const j = buildJourney(scheduleSource(before), date, ov);
    if (j.seats.booked === 0) continue;
    const row: JourneyOverride = {
      id: j.id,
      sourceId: before.id,
      serviceDate: date,
      version: j.version + 1,
      ...(ov?.departure ? { departure: ov.departure } : {}),
      kept: {
        flightNumber: before.flightNumber,
        route: before.route,
        mode: before.mode,
        resourceType: before.resourceType,
        fleet: before.fleet,
        serviceProvider: before.serviceProvider,
        departureTime: before.departureTime,
        arrivalTime: before.arrivalTime,
        reason,
        cause,
      },
    };
    if (ov) replace(OVERRIDES, row);
    else insert(OVERRIDES, row);
    kept += 1;
  }
  return kept;
}

const describeSchedule = (s: StoredSchedule) => ({
  id: s.id,
  ref: s.ref,
  label: `${s.flightNumber} · ${s.displayName}`,
});

function scheduleFor(req: MockRequest): StoredSchedule {
  const s = find<StoredSchedule>(SCHEDULES, req.params.id ?? '');
  if (!s) throw new MockError(404, 'NOT_FOUND', 'The recurring schedule was not found.');
  return s;
}

const scheduleSpec: ListSpec<RecurringSchedule> = {
  search: (s) => [s.flightNumber, s.ref, s.displayName, s.route.code, s.fleet?.registration],
  filters: {
    mode: (s, v) => s.mode === v,
    route: (s, v) => s.route.id === v || s.route.code === v,
    provider: (s, v) => s.serviceProvider.id === v || s.serviceProvider.code === v,
    unassigned: (s, v) => (v === 'true' ? s.fleet === null : s.fleet !== null),
  },
  sorts: { route: (s) => s.displayName },
  defaultSort: 'flightNumber:asc',
};

function options(): Schemas['RecurringScheduleOptions'] {
  return {
    routes: ROUTES.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      revision: r.revision,
      stops: r.stops,
      category: r.category,
      baseMode: r.baseMode,
    })),
    resourceTypes: RESOURCE_TYPES.filter((t) => t.capacity > 0).map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category,
      baseMode: t.baseMode,
    })),
    fleet: FLEET.filter((f) => f.bookable && f.availability !== 'retired').map((f) => ({
      id: f.id,
      registration: f.registration,
      resourceTypeId: f.resourceTypeId,
      serviceProviderId: f.serviceProviderId,
      availability: f.availability,
    })),
    serviceProviders: PROVIDERS,
  };
}

function registerSchedules() {
  route('GET', SCHEDULES_PATH, (req) =>
    json(listRows(all<StoredSchedule>(SCHEDULES).map(scheduleView), req.query, scheduleSpec)),
  );
  route('GET', `${SCHEDULES_PATH}/:id`, (req) => json(scheduleView(scheduleFor(req))));
  route('GET', `${SCHEDULES_PATH}/:id/history`, (req) => json(trail(scheduleFor(req).id)));
  route('GET', `${SCHEDULES_PATH}/:id/reassignment`, (req) => {
    const s = scheduleFor(req);
    const items = all<JourneyOverride>(OVERRIDES)
      .filter((o) => o.sourceId === s.id && o.kept && o.serviceDate > today())
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
      .map((o) => ({
        id: o.id,
        flightNumber: o.kept?.flightNumber ?? s.flightNumber,
        serviceDate: o.serviceDate,
        reason: o.kept?.reason ?? '',
      }));
    return json({ items } satisfies Schemas['ScheduleReassignment']);
  });
  route('GET', `${SCHEDULES_PATH}/options`, () => json(options()));
  route('GET', `${SCHEDULES_PATH}/export`, (req) => {
    const { items } = listRows(
      all<StoredSchedule>(SCHEDULES).map(scheduleView),
      withoutPaging(req.query),
      scheduleSpec,
    );
    return csv(
      items.map((s) => ({
        ref: s.ref,
        flightNumber: s.flightNumber,
        name: s.displayName,
        route: s.route.code,
        mode: s.mode,
        operator: s.serviceProvider.code,
        resourceType: s.resourceType.name,
        fleet: s.fleet?.registration ?? '',
        days: s.days.join(' '),
        departure: s.departureTime ?? '',
        arrival: s.arrivalTime ?? '',
        validFrom: s.validFrom,
        validTo: s.validTo ?? '',
        upcomingJourneys: s.journeys.upcoming,
        active: s.isActive,
      })),
      'recurring-schedules',
    );
  });

  route('POST', SCHEDULES_PATH, (req) => {
    const v = readScheduleBody(bodyOf(req), null);
    const row = insert(SCHEDULES, scheduleRow(v, validateSchedule(v, null), null));
    const view = scheduleView(row);
    audit('recurring-schedule', describeSchedule(row), 'created', 'Recurring schedule added', {
      after: view,
    });
    return json(view, 201);
  });

  route('POST', `${SCHEDULES_PATH}/preview`, (req) => {
    const body = bodyOf(req);
    const p = new Problems();
    const flightNumber =
      typeof body.flightNumber === 'string' ? body.flightNumber.trim().toUpperCase() : '';
    const days = Array.isArray(body.days) ? body.days.map(Number) : [];
    const validFrom = typeof body.validFrom === 'string' ? body.validFrom : '';
    const validTo = text(body.validTo);
    const r = routeById(typeof body.routeId === 'string' ? body.routeId : '');
    if (!r) p.add('routeId', 'Choose a route.');
    if (!DATE.test(validFrom)) p.add('validFrom', 'Give the day it starts.');
    if (days.length === 0) p.add('days', 'Choose at least one day.');
    p.throwIfAny();
    const pattern = { days, validFrom, validTo, endedOn: null };
    const dates = plannedDates(pattern, addDays(today(), 1), horizon());
    const scheduleId = text(body.scheduleId);
    const conflicts: Schemas['RecurringSchedulePreview']['conflicts'] = [];
    for (const date of dates) {
      const s = all<StoredSchedule>(SCHEDULES).find(
        (x) =>
          x.id !== scheduleId &&
          x.isActive &&
          x.flightNumber === flightNumber &&
          plannedDates(x, date, date).length > 0,
      );
      const a = all<StoredAdhoc>(ADHOC).find(
        (x) => x.isActive && x.flightNumber === flightNumber && x.serviceDate === date,
      );
      if (s || a) conflicts.push({ date, ref: s?.ref ?? a?.ref ?? null });
    }
    const warnings = [r ? directionWarning(flightNumber, r.stops) : null];
    if (validFrom > horizon())
      warnings.push(
        `It starts after ${horizon()}: its journeys are planned as that day comes within ${HORIZON_DAYS} days.`,
      );
    if (validTo !== null && validTo < addDays(today(), 1))
      warnings.push('It ends before tomorrow: no journeys would be planned.');
    return json({
      movements: dates.length,
      first: dates[0] ?? null,
      last: dates.at(-1) ?? null,
      conflicts: conflicts.slice(0, 10),
      conflictCount: conflicts.length,
      warnings: warnings.filter((w): w is string => w !== null),
    } satisfies Schemas['RecurringSchedulePreview']);
  });

  route('PATCH', `${SCHEDULES_PATH}/:id`, (req) => {
    const current = scheduleFor(req);
    checkVersion(req, current.version);
    if (!current.isActive) {
      throw new MockError(
        409,
        'SCHEDULE_ENDED',
        'The schedule has ended: resume it to change its journeys.',
      );
    }
    const v = readScheduleBody(bodyOf(req), valuesOf(current));
    const next = scheduleRow(v, validateSchedule(v, current.id), current);
    const kept = keepBooked(
      current,
      next,
      'changed',
      `Made by version ${current.version}; ${current.ref} has changed since.`,
    );
    replace(SCHEDULES, next);
    const view = scheduleView(next);
    audit('recurring-schedule', describeSchedule(next), 'changed', 'Recurring schedule changed', {
      before: scheduleView(current),
      after: view,
      reason: kept > 0 ? `${kept} booked journey(s) kept for reassignment` : null,
    });
    return json(view);
  });

  route('POST', `${SCHEDULES_PATH}/:id/deactivate`, (req) => {
    const current = scheduleFor(req);
    checkVersion(req, current.version);
    if (!current.isActive)
      throw new MockError(409, 'ALREADY_IN_STATE', 'The schedule has already ended.');
    const reason = text(bodyOf(req).reason);
    const day = today();
    const ended: StoredSchedule = {
      ...current,
      isActive: false,
      deactivatedReason: reason,
      endedOn: day,
      version: current.version + 1,
      updatedAt: now(),
    };
    keepBooked(
      current,
      null,
      'ended',
      `${current.ref} was ended on ${day}; this journey has bookings.`,
    );
    replace(SCHEDULES, ended);
    audit(
      'recurring-schedule',
      describeSchedule(ended),
      'deactivated',
      'Recurring schedule ended',
      { reason },
    );
    return json(scheduleView(ended));
  });

  route('POST', `${SCHEDULES_PATH}/:id/reactivate`, (req) => {
    const current = scheduleFor(req);
    checkVersion(req, current.version);
    if (current.isActive)
      throw new MockError(409, 'ALREADY_IN_STATE', 'The schedule is already running.');
    validateSchedule(valuesOf(current), current.id);
    const reason = text(bodyOf(req).reason);
    // Journeys kept when it ended follow it again.
    for (const o of all<JourneyOverride>(OVERRIDES).filter(
      (o) => o.sourceId === current.id && o.kept?.cause === 'ended',
    )) {
      const rest: JourneyOverride = { ...o };
      delete rest.kept;
      replace(OVERRIDES, { ...rest, version: o.version + 1 });
    }
    const resumed: StoredSchedule = {
      ...current,
      isActive: true,
      deactivatedReason: null,
      endedOn: null,
      version: current.version + 1,
      updatedAt: now(),
    };
    replace(SCHEDULES, resumed);
    audit(
      'recurring-schedule',
      describeSchedule(resumed),
      'reactivated',
      'Recurring schedule resumed',
      { reason },
    );
    return json(scheduleView(resumed));
  });
}

// ---- Ad hoc movements ---------------------------------------------------------------------------

function adhocView(a: StoredAdhoc, journeys?: readonly Journey[]): AdhocMovement {
  const list = journeys ?? journeysBetween(a.serviceDate, a.serviceDate);
  const j = list.find((x) => x.source.id === a.id);
  const warnings = [fleetWarning(a.fleet)];
  if (j?.flags.includes('resource-overlap') && a.fleet)
    warnings.push(`${a.fleet.registration} is on another journey at this time.`);
  if (j?.weather)
    warnings.push(`${capital(j.weather.level)} weather at ${j.weather.location.name}`);
  const { requestIds, ...rest } = a;
  return {
    ...rest,
    journey: j ? { id: j.id, status: j.status, booked: j.seats.booked } : null,
    requests: requestIds.length,
    warnings: warnings.filter((w): w is string => w !== null),
  };
}

function adhocViews(rows: readonly StoredAdhoc[]): AdhocMovement[] {
  if (rows.length === 0) return [];
  const dates = rows.map((a) => a.serviceDate).sort();
  const journeys = journeysBetween(dates[0] ?? today(), dates.at(-1) ?? today());
  return rows.map((a) => adhocView(a, journeys));
}

interface AdhocValues {
  flightNumber: string;
  routeId: string;
  mode: Mode;
  resourceTypeId: string;
  fleetId: string | null;
  serviceDate: string;
  departureTime: string | null;
  arrivalTime: string | null;
  purpose: string | null;
}

function readAdhocBody(body: Record<string, unknown>, base: AdhocValues | null): AdhocValues {
  const has = (k: string) => base === null || k in body;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    flightNumber: has('flightNumber')
      ? str(body.flightNumber).toUpperCase()
      : (base?.flightNumber ?? ''),
    routeId: has('routeId') ? str(body.routeId) : (base?.routeId ?? ''),
    mode: has('mode') ? (body.mode as Mode) : (base?.mode ?? 'fixed-wing'),
    resourceTypeId: has('resourceTypeId') ? str(body.resourceTypeId) : (base?.resourceTypeId ?? ''),
    fleetId: has('fleetId') ? text(body.fleetId) : (base?.fleetId ?? null),
    serviceDate: has('serviceDate') ? str(body.serviceDate) : (base?.serviceDate ?? ''),
    departureTime: has('departureTime') ? text(body.departureTime) : (base?.departureTime ?? null),
    arrivalTime: has('arrivalTime') ? text(body.arrivalTime) : (base?.arrivalTime ?? null),
    purpose: has('purpose') ? text(body.purpose) : (base?.purpose ?? null),
  };
}

const adhocValuesOf = (a: StoredAdhoc): AdhocValues => ({
  flightNumber: a.flightNumber,
  routeId: a.route.id,
  mode: a.mode,
  resourceTypeId: a.resourceType.id,
  fleetId: a.fleet?.id ?? null,
  serviceDate: a.serviceDate,
  departureTime: a.departureTime,
  arrivalTime: a.arrivalTime,
  purpose: a.purpose,
});

function validateAdhoc(v: AdhocValues, current: StoredAdhoc | null): Resolved {
  const p = new Problems();
  const resolved = checkMovement(p, v, 9);
  if (!DATE.test(v.serviceDate)) p.add('serviceDate', 'Give the day it travels.');
  else if (v.serviceDate < today() && v.serviceDate !== current?.serviceDate)
    p.add('serviceDate', 'Choose today or a later day.');
  if (v.purpose !== null && v.purpose.length > 500)
    p.add('purpose', 'Use 500 characters or fewer.');
  p.throwIfAny();
  const taken =
    all<StoredAdhoc>(ADHOC).find(
      (a) =>
        a.id !== current?.id &&
        a.isActive &&
        a.flightNumber === v.flightNumber &&
        a.serviceDate === v.serviceDate,
    )?.ref ??
    all<StoredSchedule>(SCHEDULES).find(
      (s) =>
        s.isActive &&
        s.flightNumber === v.flightNumber &&
        plannedDates(s, v.serviceDate, v.serviceDate).length > 0,
    )?.ref;
  if (taken) {
    throw new MockError(
      409,
      'FLIGHT_NUMBER_TAKEN',
      `${v.flightNumber} already runs on ${v.serviceDate} (${taken}).`,
      {
        fields: { flightNumber: `Already used by ${taken}` },
      },
    );
  }
  return resolved as Resolved;
}

function adhocFor(req: MockRequest): StoredAdhoc {
  const a = find<StoredAdhoc>(ADHOC, req.params.id ?? '');
  if (!a) throw new MockError(404, 'NOT_FOUND', 'The ad hoc movement was not found.');
  return a;
}

const describeAdhoc = (a: StoredAdhoc) => ({
  id: a.id,
  ref: a.ref,
  label: `${a.flightNumber} · ${a.route.name}`,
});

const adhocSpec: ListSpec<AdhocMovement> = {
  search: (a) => [
    a.flightNumber,
    a.ref,
    a.route.code,
    a.route.name,
    a.purpose,
    a.fleet?.registration,
  ],
  filters: {
    mode: (a, v) => a.mode === v,
    route: (a, v) => a.route.id === v,
    provider: (a, v) => a.serviceProvider.id === v,
    from: (a, v) => a.serviceDate >= v,
    to: (a, v) => a.serviceDate <= v,
  },
  sorts: { route: (a) => a.route.name },
  defaultSort: 'serviceDate:desc',
};

/** Finds the route that carries a request: a direct one first, else one passing both in order. */
function routeFor(originId: string, destinationId: string): RouteInfo | undefined {
  return ROUTES.filter((r) => {
    const i = r.stops.findIndex((s) => s.id === originId);
    const j = r.stops.findIndex((s) => s.id === destinationId);
    return i >= 0 && j > i;
  }).sort((a, b) => a.stops.length - b.stops.length)[0];
}

function distanceKm(stops: readonly Stop[]): number | null {
  let km = 0;
  for (let i = 1; i < stops.length; i += 1) {
    const a = LOCATIONS.get(stops[i - 1]?.code ?? '')?.coordinates;
    const b = LOCATIONS.get(stops[i]?.code ?? '')?.coordinates;
    if (!a || !b) return null;
    const rad = Math.PI / 180;
    const h =
      Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
    km += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return Math.round(km * 10) / 10;
}

function registerAdhoc() {
  route('GET', ADHOC_PATH, (req) =>
    json(listRows(adhocViews(all<StoredAdhoc>(ADHOC)), req.query, adhocSpec)),
  );
  route('GET', `${ADHOC_PATH}/:id`, (req) => json(adhocView(adhocFor(req))));
  route('GET', `${ADHOC_PATH}/:id/history`, (req) => json(trail(adhocFor(req).id)));
  route('GET', `${ADHOC_PATH}/options`, () => json(options()));
  route('GET', `${ADHOC_PATH}/export`, (req) => {
    const { items } = listRows(
      adhocViews(all<StoredAdhoc>(ADHOC)),
      withoutPaging(req.query),
      adhocSpec,
    );
    return csv(
      items.map((a) => ({
        ref: a.ref,
        flightNumber: a.flightNumber,
        serviceDate: a.serviceDate,
        route: a.route.code,
        mode: a.mode,
        operator: a.serviceProvider.code,
        resourceType: a.resourceType.name,
        fleet: a.fleet?.registration ?? '',
        departure: a.departureTime ?? '',
        arrival: a.arrivalTime ?? '',
        purpose: a.purpose ?? '',
        requests: a.requests,
        booked: a.journey?.booked ?? 0,
        active: a.isActive,
      })),
      'adhoc-movements',
    );
  });

  route('POST', ADHOC_PATH, (req) => {
    const body = bodyOf(req);
    const v = readAdhocBody(body, null);
    const r = validateAdhoc(v, null);
    const requestIds = Array.isArray(body.requestIds) ? body.requestIds.map(String) : [];
    const requests = requestIds.map((id) => find<StoredRequest>(REQUESTS, id));
    const unavailable = requests.findIndex((q) => !q || q.takenBy !== null);
    if (unavailable >= 0) {
      throw new MockError(
        409,
        'REQUEST_TAKEN',
        'One of the requests has already been taken up. Reload and choose again.',
      );
    }
    const id = newId();
    const row = insert<StoredAdhoc>(ADHOC, {
      id,
      ref: nextRef(
        'AH',
        all<StoredAdhoc>(ADHOC).map((a) => a.ref),
      ),
      flightNumber: v.flightNumber,
      serviceProvider: r.provider,
      route: routeRef(r.route),
      mode: v.mode,
      resourceType: r.resourceType,
      fleet: r.fleet,
      serviceDate: v.serviceDate,
      departureTime: v.departureTime,
      arrivalTime: v.arrivalTime,
      purpose: v.purpose,
      requestIds,
      isActive: true,
      deactivatedReason: null,
      version: 1,
      updatedAt: now(),
    });
    for (const q of requests) if (q) replace(REQUESTS, { ...q, takenBy: id });
    const view = adhocView(row);
    audit('adhoc-movement', describeAdhoc(row), 'created', 'Ad hoc movement added', {
      after: view,
      reason: requestIds.length > 0 ? `Takes up ${requestIds.length} unscheduled request(s)` : null,
    });
    return json(view, 201);
  });

  route('POST', `${ADHOC_PATH}/suggest`, (req) => {
    const body = bodyOf(req);
    const ids = Array.isArray(body.requestIds) ? body.requestIds.map(String) : [];
    const groups = new Map<string, Schemas['ConsolidationSuggestion']['groups'][number]>();
    const unplaced: Schemas['ConsolidationSuggestion']['unplaced'] = [];
    for (const id of ids) {
      const q = find<StoredRequest>(REQUESTS, id);
      if (!q || q.takenBy !== null) {
        unplaced.push({ requestId: id, reason: 'not-open' });
        continue;
      }
      const r = routeFor(q.origin.id, q.destination.id);
      if (!r) {
        unplaced.push({ requestId: id, reason: 'no-route' });
        continue;
      }
      const key = `${r.id}|${q.travelDate}`;
      const group = groups.get(key) ?? {
        date: q.travelDate,
        route: { ...routeRef(r), category: r.category },
        requestIds: [],
        distanceKm: distanceKm(r.stops),
        resourceType: null,
      };
      group.requestIds.push(id);
      groups.set(key, group);
    }
    for (const g of groups.values()) {
      const fit = RESOURCE_TYPES.filter(
        (t) => t.category === g.route.category && t.capacity >= g.requestIds.length,
      ).sort((a, b) => a.capacity - b.capacity)[0];
      g.resourceType = fit
        ? { id: fit.id, code: fit.code, name: fit.name, capacity: fit.capacity }
        : null;
    }
    return json({
      groups: [...groups.values()].sort(
        (a, b) => b.requestIds.length - a.requestIds.length || a.date.localeCompare(b.date),
      ),
      unplaced,
    } satisfies Schemas['ConsolidationSuggestion']);
  });

  route('PATCH', `${ADHOC_PATH}/:id`, (req) => {
    const current = adhocFor(req);
    checkVersion(req, current.version);
    if (!current.isActive)
      throw new MockError(
        409,
        'MOVEMENT_ENDED',
        'The movement was cancelled: resume it to change it.',
      );
    if (current.serviceDate < today())
      throw new MockError(
        409,
        'MOVEMENT_PAST',
        'This movement has travelled: it can no longer be changed.',
      );
    const v = readAdhocBody(bodyOf(req), adhocValuesOf(current));
    const r = validateAdhoc(v, current);
    const row = replace<StoredAdhoc>(ADHOC, {
      ...current,
      flightNumber: v.flightNumber,
      serviceProvider: r.provider,
      route: routeRef(r.route),
      mode: v.mode,
      resourceType: r.resourceType,
      fleet: r.fleet,
      serviceDate: v.serviceDate,
      departureTime: v.departureTime,
      arrivalTime: v.arrivalTime,
      purpose: v.purpose,
      version: current.version + 1,
      updatedAt: now(),
    });
    const view = adhocView(row);
    audit('adhoc-movement', describeAdhoc(row), 'changed', 'Ad hoc movement changed', {
      before: adhocView(current),
      after: view,
    });
    return json(view);
  });

  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${ADHOC_PATH}/:id/${action}`, (req) => {
      const current = adhocFor(req);
      checkVersion(req, current.version);
      if (current.isActive === active) {
        throw new MockError(
          409,
          'ALREADY_IN_STATE',
          `The movement is already ${active ? 'running' : 'cancelled'}.`,
        );
      }
      if (active) validateAdhoc(adhocValuesOf(current), current);
      const reason = text(bodyOf(req).reason);
      const row = replace<StoredAdhoc>(ADHOC, {
        ...current,
        isActive: active,
        deactivatedReason: active ? null : reason,
        version: current.version + 1,
        updatedAt: now(),
      });
      const verb = active ? 'reactivated' : 'deactivated';
      audit(
        'adhoc-movement',
        describeAdhoc(row),
        verb,
        `Ad hoc movement ${active ? 'resumed' : 'ended'}`,
        { reason },
      );
      return json(adhocView(row));
    });
  }
}

// ---- Journeys, dashboard, Planning Board ---------------------------------------------------------

/** By day, then departure (untimed last), then number. */
const departureKey = (j: Journey) => `${j.serviceDate}|${j.departureAt ?? 'z'}|${j.flightNumber}`;

const journeySpec: ListSpec<Journey> = {
  search: (j) => [
    j.flightNumber,
    j.source.ref,
    j.route.code,
    j.fleet?.registration,
    ...j.route.stops.map((s) => s.name),
  ],
  filters: {
    from: (j, v) => j.serviceDate >= v,
    to: (j, v) => j.serviceDate <= v,
    mode: (j, v) => j.mode === v,
    category: (j, v) => j.category === v,
    route: (j, v) => j.route.id === v,
    location: (j, v) => j.route.stops.some((s) => s.id === v),
    provider: (j, v) => j.serviceProvider.id === v,
    status: (j, v) => j.status === v,
    flag: (j, v) => j.flags.includes(v as Journey['flags'][number]),
  },
  sorts: {
    departure: departureKey,
    flightNumber: (j) => `${j.flightNumber}|${j.serviceDate}`,
  },
  defaultSort: 'departure:asc',
  hasActive: false,
};

function dashboard(): Schemas['SchedulingDashboard'] {
  const day = today();
  const week = journeysBetween(day, addDays(day, 7));
  const ahead = journeysBetween(day, horizon());
  const live = (j: Journey) => j.status !== 'cancelled';
  const conflicts = new Map<string, Schemas['SchedulingDashboard']['conflicts'][number]>();
  for (const j of week.filter(live)) {
    if (!j.fleet) continue;
    for (const [flag, kind] of [
      ['resource-overlap', 'overlap'],
      ['resource-maintenance', 'maintenance'],
    ] as const) {
      if (!j.flags.includes(flag)) continue;
      const key = `${kind}|${j.fleet.id}|${j.serviceDate}`;
      const c = conflicts.get(key) ?? {
        kind,
        fleet: j.fleet,
        serviceDate: j.serviceDate,
        journeys: [],
      };
      c.journeys.push({ id: j.id, flightNumber: j.flightNumber });
      conflicts.set(key, c);
    }
  }
  return {
    date: day,
    kpis: {
      activeRecurringSchedules: all<StoredSchedule>(SCHEDULES).filter(
        (s) => s.isActive && (s.validTo === null || s.validTo >= day),
      ).length,
      activeAdhocMovements: all<StoredAdhoc>(ADHOC).filter(
        (a) => a.isActive && a.serviceDate >= day,
      ).length,
      unassignedFleetResources: week.filter(
        (j) => live(j) && j.fleet === null && j.serviceDate > day,
      ).length,
      movementsPublished: ahead.filter((j) => live(j) && j.serviceDate > day).length,
      journeysWithoutDepartureTime: ahead.filter((j) => live(j) && j.departureAt === null).length,
      compatibilityFlags: ahead.filter(
        (j) => live(j) && j.compatibility !== null && j.compatibility.outcome !== 'ok',
      ).length,
      requestsNeedingRoute: openRequests().filter(
        (r) => r.kind === 'no-route' && r.travelDate >= day,
      ).length,
    },
    categories: [...CATEGORIES],
    // Overlaps first: they need a decision, maintenance usually only a swap.
    conflicts: [...conflicts.values()].sort(
      (a, b) => b.kind.localeCompare(a.kind) || a.serviceDate.localeCompare(b.serviceDate),
    ),
  };
}

/** A departure time may be given to a planned journey from today on, when its source gives none. */
const canGiveTime = (j: Journey) =>
  j.status === 'scheduled' &&
  j.serviceDate >= today() &&
  (j.departureAt === null || j.departureAssigned);

function registerJourneys() {
  route('GET', `${BASE}/dashboard`, () => json(dashboard()));

  route('GET', `${BASE}/journeys`, (req) => {
    const from = req.query.get('filter[from]') || today();
    const to = req.query.get('filter[to]') || horizon();
    return json(listRows(journeysBetween(from, to), req.query, journeySpec));
  });

  route('GET', `${BASE}/planning-board`, (req) => {
    const q = req.query;
    const from = q.get('from') ?? '';
    const to = q.get('to') ?? '';
    const p = new Problems();
    if (!DATE.test(from)) p.add('from', 'Give the first day.');
    if (!DATE.test(to)) p.add('to', 'Give the last day.');
    else if (to < from) p.add('to', 'The last day can’t be before the first.');
    else if (daysFrom(from, to) > 62) p.add('to', 'Show up to two months at a time.');
    p.throwIfAny();
    const want = (k: string, ok: (j: Journey, v: string) => boolean) => (j: Journey) => {
      const v = q.get(k);
      return !v || ok(j, v);
    };
    const journeys = journeysBetween(from, to)
      .filter(want('category', (j, v) => j.category === v))
      .filter(want('mode', (j, v) => j.mode === v))
      .filter(want('route', (j, v) => j.route.id === v))
      .filter(want('location', (j, v) => j.route.stops.some((s) => s.id === v)))
      .filter(want('provider', (j, v) => j.serviceProvider.id === v))
      .sort((a, b) => departureKey(a).localeCompare(departureKey(b)));
    return json({
      from,
      to,
      journeys,
      categories: [...CATEGORIES],
      weather: { available: true, from: today(), to: addDays(today(), WEATHER_DAYS - 1) },
    } satisfies Schemas['PlanningBoard']);
  });

  route('POST', `${BASE}/journeys/:id/departure-time`, (req) => {
    const j = findJourney(req.params.id ?? '');
    if (!j) return notFound('journey');
    checkVersion(req, j.version);
    if (!canGiveTime(j)) {
      throw new MockError(
        409,
        'DEPARTURE_TIME_FIXED',
        j.status !== 'scheduled' || j.serviceDate < today()
          ? 'This journey is past planning: its time can no longer be given here.'
          : `This journey’s time comes from ${j.source.ref}: change the schedule instead.`,
      );
    }
    const body = bodyOf(req);
    const departureTime = text(body.departureTime);
    const arrivalTime = text(body.arrivalTime);
    const p = new Problems();
    if (!departureTime || !TIME.test(departureTime))
      p.add('departureTime', 'Give the departure time, e.g. 07:30.');
    if (arrivalTime !== null && !TIME.test(arrivalTime))
      p.add('arrivalTime', 'Use a 24-hour time, e.g. 08:15.');
    else if (arrivalTime !== null && arrivalTime === departureTime)
      p.add('arrivalTime', 'The arrival time can’t be the departure time.');
    p.throwIfAny();
    const current = all<JourneyOverride>(OVERRIDES).find(
      (o) => o.sourceId === j.source.id && o.serviceDate === j.serviceDate,
    );
    const row: JourneyOverride = {
      ...(current ?? { id: j.id, sourceId: j.source.id, serviceDate: j.serviceDate }),
      version: j.version + 1,
      departure: { departureTime: departureTime as string, arrivalTime },
    };
    if (current) replace(OVERRIDES, row);
    else insert(OVERRIDES, row);
    const after = findJourney(j.id) as Journey;
    audit(
      'journey',
      {
        id: j.id,
        ref: `${j.source.ref}-${j.serviceDate}`,
        label: `${j.flightNumber} · ${j.serviceDate}`,
      },
      'changed',
      j.departureAssigned ? 'Departure time changed' : 'Departure time given',
      {
        before: { departureAt: j.departureAt, arrivalAt: j.arrivalAt },
        after: { departureAt: after.departureAt, arrivalAt: after.arrivalAt },
      },
    );
    return json(after);
  });

  route('GET', `${BASE}/locations/:id/affected-journeys`, (req) => {
    const id = req.params.id ?? '';
    const items = journeysBetween(addDays(today(), 1), horizon())
      .filter((j) => j.status !== 'cancelled' && j.route.stops.some((s) => s.id === id))
      .sort((a, b) =>
        (a.departureAt ?? a.serviceDate).localeCompare(b.departureAt ?? b.serviceDate),
      )
      .map((j) => ({
        id: j.id,
        flightNumber: j.flightNumber,
        serviceDate: j.serviceDate,
        departureAt: j.departureAt,
        sourceRef: j.source.ref,
        booked: j.seats.booked > 0,
      }));
    return json({ items } satisfies Schemas['AffectedJourneys']);
  });
}

// ---- Unscheduled requests ------------------------------------------------------------------------

/** Requests no movement carries: no route for the pair, or no journey on it that day. */
function openRequests(): UnscheduledRequest[] {
  const byDate = new Map<string, Journey[]>();
  const journeysOn = (date: string) => {
    const cached = byDate.get(date);
    if (cached) return cached;
    const list = journeysBetween(date, date).filter((j) => j.status !== 'cancelled');
    byDate.set(date, list);
    return list;
  };
  return all<StoredRequest>(REQUESTS).flatMap((q) => {
    if (q.takenBy !== null) return [];
    const r = routeFor(q.origin.id, q.destination.id);
    if (r) {
      const carried = journeysOn(q.travelDate).some((j) => {
        const i = j.route.stops.findIndex((s) => s.id === q.origin.id);
        const k = j.route.stops.findIndex((s) => s.id === q.destination.id);
        return i >= 0 && k > i;
      });
      if (carried) return [];
    }
    return [
      {
        id: q.id,
        ref: q.ref,
        person: q.person,
        category: q.category,
        origin: q.origin,
        destination: q.destination,
        travelDate: q.travelDate,
        requestedTime: q.requestedTime,
        criticality: q.criticality,
        status: q.status,
        reason: q.reason,
        submittedAt: q.submittedAt,
        kind: r ? 'no-movement' : 'no-route',
        route: r ? { id: r.id, code: r.code, name: r.name, category: r.category } : null,
      } satisfies UnscheduledRequest,
    ];
  });
}

const requestSpec: ListSpec<UnscheduledRequest> = {
  search: (r) => [r.ref, r.person.name, r.person.personnelNo, r.origin.name, r.destination.name],
  filters: {
    from: (r, v) => r.travelDate >= v,
    to: (r, v) => r.travelDate <= v,
    kind: (r, v) => r.kind === v,
    origin: (r, v) => r.origin.id === v || r.origin.code === v,
    destination: (r, v) => r.destination.id === v || r.destination.code === v,
    criticality: (r, v) => r.criticality === v,
  },
  sorts: { travelDate: (r) => `${r.travelDate}|${r.requestedTime ?? '99'}` },
  defaultSort: 'travelDate:asc',
  hasActive: false,
};

// ---- Pre-manifest ------------------------------------------------------------------------------

interface StoredPremanifest {
  id: string;
  run: PremanifestRun;
  lines: PremanifestLine[];
}

const PRIORITY = ['VIP', 'EP', 'CREW', 'EST-POS', 'DH', 'RADAR', 'CON', 'VIS', 'GEN'];

/** The lead time: a day before departure (noon the day before for an untimed journey). */
const dueAtOf = (j: Journey) =>
  j.departureAt
    ? new Date(Date.parse(j.departureAt) - 86_400_000).toISOString()
    : at(addDays(j.serviceDate, -1), '12:00');

function candidates(j: Journey): { person: Person; category: string }[] {
  const manifest = DISPATCH_MANIFESTS.get(`${j.flightNumber}:${j.serviceDate}`);
  if (manifest) return manifest;
  const n = Math.min(90, j.seats.booked + j.seats.waitlisted);
  return [...PEOPLE]
    .sort((a, b) => chance(`${j.id}:${a.personnelNo}`) - chance(`${j.id}:${b.personnelNo}`))
    .slice(0, n)
    .map((person) => ({ person, category: person.category }));
}

function suggestLines(j: Journey): PremanifestLine[] {
  const due = Date.parse(dueAtOf(j));
  const first = j.route.stops[0] as Stop;
  const last = j.route.stops.at(-1) as Stop;
  const lines = candidates(j).map(({ person, category }) => {
    const key = `${j.id}:${person.personnelNo}`;
    const crewChange = category === 'DH' && chance(`${key}:crew`) < 0.4;
    return {
      id: idFor('premanifest-line', key),
      rank: 0,
      decision: 'manifest',
      reason: null,
      manual: false,
      note: null,
      booking: {
        id: idFor('booking', key),
        ref: `BK-2026-${String(1000 + Math.floor(chance(`${key}:bk`) * 8999)).padStart(4, '0')}`,
        status: 'confirmed',
      },
      person: {
        id: person.id,
        name: person.name,
        personnelNo: person.personnelNo,
        gender: person.gender,
      },
      category: passengerCategory(category),
      crewChange,
      vip: category === 'VIP',
      submittedAt: new Date(due - (2 + chance(`${key}:at`) * 12) * 86_400_000).toISOString(),
      origin: first,
      destination: last,
      reassignment: null,
    } satisfies PremanifestLine;
  });
  const priority = (l: PremanifestLine) =>
    PRIORITY.indexOf(l.crewChange ? 'CREW' : l.category.code) + (l.vip ? -10 : 0);
  lines.sort((a, b) => priority(a) - priority(b) || a.submittedAt.localeCompare(b.submittedAt));
  return lines.map((l, i) => ({ ...l, rank: i + 1 }));
}

/** Seats lines in rank order around the manual decisions; the rest wait, then are over the cap. */
function allocate(run: PremanifestRun, lines: PremanifestLine[]): StoredPremanifest['lines'] {
  const seats = Math.max(0, run.capacity - run.reserveSeats);
  let seated = lines.filter((l) => l.manual && l.decision === 'manifest').length;
  let waiting = lines.filter((l) => l.manual && l.decision === 'waitlist').length;
  const out = lines.map((l): PremanifestLine => {
    if (l.manual) return l;
    if (seated < seats) {
      seated += 1;
      return { ...l, decision: 'manifest', reason: null };
    }
    if (waiting < run.waitlistCap) {
      waiting += 1;
      return { ...l, decision: 'waitlist', reason: 'no-seat' };
    }
    return { ...l, decision: 'over-cap', reason: 'waitlist-full' };
  });
  const count = (d: PremanifestLine['decision']) => out.filter((l) => l.decision === d).length;
  run.counts = {
    manifest: count('manifest'),
    waitlist: count('waitlist'),
    overCap: count('over-cap'),
    excluded: count('excluded'),
  };
  return out;
}

function generate(
  j: Journey,
  previous: PremanifestRun | null,
  trigger: PremanifestRun['trigger'],
): StoredPremanifest {
  const capacity = j.seats.capacity ?? 0;
  const runNo = (previous?.runNo ?? 0) + 1;
  const run: PremanifestRun = {
    id: idFor('premanifest-run', `${j.id}:${runNo}`),
    runNo,
    trigger,
    // Runs for today and before were published at their lead time.
    status: trigger === 'lead-time' && j.serviceDate <= today() ? 'published' : 'draft',
    capacity,
    reserveSeats: previous?.reserveSeats ?? 0,
    waitlistCap: Math.max(2, Math.round(capacity * 0.15)),
    generatedAt: trigger === 'lead-time' ? dueAtOf(j) : now(),
    publishedAt: null,
    counts: { manifest: 0, waitlist: 0, overCap: 0, excluded: 0 },
    version: (previous?.version ?? 0) + 1,
  };
  if (run.status === 'published') run.publishedAt = run.generatedAt;
  return { id: j.id, run, lines: allocate(run, suggestLines(j)) };
}

/** The stored pre-manifest, or the one suggested at the lead time once it has passed. */
function premanifestOf(j: Journey): StoredPremanifest | null {
  const stored = find<StoredPremanifest>(PREMANIFESTS, j.id);
  if (stored) return stored;
  if (j.status === 'cancelled' || Date.now() < Date.parse(dueAtOf(j))) return null;
  return generate(j, null, 'lead-time');
}

function premanifestView(j: Journey, p: StoredPremanifest | null): Premanifest {
  return {
    journey: j,
    dueAt: dueAtOf(j),
    run: p?.run ?? null,
    lines: p?.lines ?? [],
    nonTimed:
      j.departureAt === null
        ? {
            needingService: candidates(j).length,
            allocatedHere: p?.run.counts.manifest ?? 0,
          }
        : null,
  };
}

function journeyFor(req: MockRequest): Journey {
  const j = findJourney(req.params.journeyId ?? '');
  if (!j) throw new MockError(404, 'NOT_FOUND', 'The journey was not found.');
  return j;
}

function draftFor(req: MockRequest, j: Journey): StoredPremanifest {
  const p = premanifestOf(j);
  if (!p)
    throw new MockError(409, 'PREMANIFEST_NOT_READY', 'No pre-manifest has been suggested yet.');
  checkVersion(req, p.run.version);
  if (p.run.status === 'published')
    throw new MockError(
      409,
      'PREMANIFEST_PUBLISHED',
      'The pre-manifest is published: it can no longer be changed here.',
    );
  return structuredClone(p);
}

function save(
  j: Journey,
  p: StoredPremanifest,
  label: string,
  reason: string | null = null,
): Response {
  if (find<StoredPremanifest>(PREMANIFESTS, p.id)) replace(PREMANIFESTS, p);
  else insert(PREMANIFESTS, p);
  audit(
    'premanifest',
    {
      id: j.id,
      ref: `${j.source.ref}-${j.serviceDate}`,
      label: `${j.flightNumber} · ${j.serviceDate}`,
    },
    'changed',
    label,
    { reason, after: { run: p.run.runNo, status: p.run.status, counts: p.run.counts } },
  );
  return json(premanifestView(j, p));
}

function registerPremanifest() {
  route('GET', `${BASE}/premanifest`, (req) => {
    const date = req.query.get('date') ?? addDays(today(), 1);
    if (!DATE.test(date)) {
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { date: 'Give a day.' },
      });
    }
    const items = journeysBetween(date, date)
      .filter((j) => j.status !== 'cancelled' && (j.seats.capacity ?? 0) > 0)
      .sort((a, b) => (a.departureAt ?? 'z').localeCompare(b.departureAt ?? 'z'))
      .map((j) => ({ journey: j, dueAt: dueAtOf(j), run: premanifestOf(j)?.run ?? null }));
    return json({ date, items } satisfies Schemas['PremanifestDay']);
  });

  route('GET', `${BASE}/premanifest/:journeyId`, (req) => {
    const j = journeyFor(req);
    return json(premanifestView(j, premanifestOf(j)));
  });

  route('POST', `${BASE}/premanifest/:journeyId`, (req) => {
    const j = journeyFor(req);
    if (j.status === 'cancelled')
      throw new MockError(409, 'JOURNEY_CANCELLED', 'The journey is cancelled.');
    const current = premanifestOf(j);
    if (current?.run.status === 'published')
      throw new MockError(
        409,
        'PREMANIFEST_PUBLISHED',
        'The pre-manifest is published: it can no longer be suggested again.',
      );
    const next = generate(j, current?.run ?? null, 'on-demand');
    return save(j, next, current ? 'Pre-manifest suggested again' : 'Pre-manifest suggested');
  });

  route('POST', `${BASE}/premanifest/:journeyId/adjust`, (req) => {
    const j = journeyFor(req);
    const p = draftFor(req, j);
    const body = bodyOf(req);
    const action = typeof body.action === 'string' ? body.action : '';
    const i = p.lines.findIndex((l) => l.id === body.lineId);
    const line = p.lines[i];
    if (!line) throw new MockError(404, 'NOT_FOUND', 'The passenger is not on this pre-manifest.');
    let reason: string | null = null;
    if (action === 'up' || action === 'down') {
      const k = action === 'up' ? i - 1 : i + 1;
      const other = p.lines[k];
      if (!other)
        throw new MockError(409, 'CANNOT_MOVE', `Already ${action === 'up' ? 'first' : 'last'}.`);
      p.lines[k] = line;
      p.lines[i] = other;
      p.lines = p.lines.map((l, n) => ({ ...l, rank: n + 1 }));
    } else if (action === 'manifest') {
      const seated = p.lines.filter((l) => l.decision === 'manifest').length;
      if (seated >= p.run.capacity - p.run.reserveSeats)
        throw new MockError(
          422,
          'NO_SEAT',
          'Every seat is taken: move someone to the waitlist first.',
        );
      p.lines[i] = { ...line, decision: 'manifest', reason: 'manual', manual: true, note: null };
    } else if (action === 'waitlist') {
      p.lines[i] = { ...line, decision: 'waitlist', reason: 'manual', manual: true, note: null };
    } else if (action === 'exclude') {
      reason = text(body.reason);
      if (!reason) {
        throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
          fields: { reason: 'Required' },
        });
      }
      p.lines[i] = {
        ...line,
        decision: 'excluded',
        reason: 'excluded',
        manual: true,
        note: reason,
      };
    } else {
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { action: 'Unknown action' },
      });
    }
    p.lines = allocate(p.run, p.lines);
    p.run.version += 1;
    const labels: Record<string, string> = {
      up: 'moved up',
      down: 'moved down',
      manifest: 'given a seat',
      waitlist: 'waitlisted',
      exclude: 'excluded',
    };
    return save(j, p, `${line.person.name} ${labels[action] ?? action}`, reason);
  });

  route('POST', `${BASE}/premanifest/:journeyId/reserve`, (req) => {
    const j = journeyFor(req);
    const p = draftFor(req, j);
    const seats = Number(bodyOf(req).seats);
    if (!Number.isInteger(seats) || seats < 0 || seats > p.run.capacity) {
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { seats: `Reserve between 0 and ${p.run.capacity} seats.` },
      });
    }
    p.run.reserveSeats = seats;
    p.lines = allocate(p.run, p.lines);
    p.run.version += 1;
    return save(j, p, `${seats} seat(s) held back`);
  });

  route('POST', `${BASE}/premanifest/:journeyId/publish`, (req) => {
    const j = journeyFor(req);
    const p = draftFor(req, j);
    p.run.status = 'published';
    p.run.publishedAt = now();
    p.run.version += 1;
    return save(j, p, 'Pre-manifest published');
  });
}

// ---- Registration ------------------------------------------------------------------------------

export function registerScheduling(): void {
  const schedules = scheduleRows();
  const movements = adhocRows();
  for (const row of [...schedules, ...movements]) SEEDED.add(row.id);
  seed(SCHEDULES, () => schedules);
  seed(ADHOC, () => movements);
  seed(OVERRIDES, () => overrideRows(schedules));
  seed(REQUESTS, requestRows);
  seed<StoredPremanifest>(PREMANIFESTS, () => []);

  registerSchedules();
  registerAdhoc();
  registerJourneys();
  registerPremanifest();
  route('GET', `${BASE}/unscheduled-requests`, (req) =>
    json(listRows(openRequests(), req.query, requestSpec)),
  );
}
