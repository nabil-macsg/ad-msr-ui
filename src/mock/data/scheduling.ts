/**
 * Scheduling demo data (spec 20 §2.1): B.4's recurring schedules and ad hoc movements, the
 * requests no movement has taken up yet, and the masters they point at, all derived from the
 * backend's demo seed JSON. Dates are relative to GST today so the screens always have data.
 */
import type { components } from '../../api/schema';
import { gstDate, idFor, ref, SEEDED_AT } from './ids';
import dispatchSeeds from './seeds/dispatch.json';
import fleetSeeds from './seeds/fleet.json';
import locationSeeds from './seeds/locations.json';
import passengerSeeds from './seeds/passengers.json';
import resourceTypeSeeds from './seeds/resource-types.json';
import scheduleSeeds from './seeds/recurring-schedules.json';
import routeSeeds from './seeds/routes.json';
import providerSeeds from './seeds/service-providers.json';

type Schemas = components['schemas'];
export type RecurringSchedule = Schemas['RecurringSchedule'];
export type AdhocMovement = Schemas['AdhocMovement'];
export type Journey = Schemas['Journey'];
export type UnscheduledRequest = Schemas['UnscheduledRequest'];
export type Mode = RecurringSchedule['mode'];
export type BaseMode = Schemas['RecurringScheduleOptions']['routes'][number]['baseMode'];
export type Stop = RecurringSchedule['route']['stops'][number];

/** A schedule as stored: its journey counts and warnings are worked out when it is read. */
export type StoredSchedule = Omit<RecurringSchedule, 'journeys' | 'warnings'> & {
  /** The day it was ended (deactivated): its journeys after it are no longer planned. */
  endedOn: string | null;
};
/** An ad hoc movement as stored, with the requests it took up. */
export type StoredAdhoc = Omit<AdhocMovement, 'journey' | 'requests' | 'warnings'> & {
  requestIds: string[];
};
/** A request as stored; `kind` and `route` are worked out when it is listed. */
export type StoredRequest = Omit<UnscheduledRequest, 'kind' | 'route'> & {
  /** The ad hoc movement that took it up, if any. */
  takenBy: string | null;
};

/** A journey that no longer follows its source (kept booked, timed here, or cancelled). */
export interface JourneyOverride {
  id: string;
  sourceId: string;
  serviceDate: string;
  version: number;
  /** Given on the Planning Board (A.3.3-03). */
  departure?: { departureTime: string; arrivalTime: string | null };
  status?: Journey['status'];
  /** Booked journeys an edit or end left as they were: they need reassignment. */
  kept?: KeptJourney;
}
export interface KeptJourney {
  flightNumber: string;
  route: RecurringSchedule['route'];
  mode: Mode;
  resourceType: RecurringSchedule['resourceType'];
  fleet: RecurringSchedule['fleet'];
  serviceProvider: RecurringSchedule['serviceProvider'];
  departureTime: string | null;
  arrivalTime: string | null;
  reason: string;
  cause: 'changed' | 'ended';
}

// ---- Dates -----------------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoWeekday = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
export const addMinutes = (time: string, minutes: number): string => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
/** The first day on or after `today + offset` whose weekday is not in `avoid`. */
const dayAvoiding = (offset: number, avoid: readonly number[]): string => {
  let day = gstDate(offset);
  while (avoid.includes(isoWeekday(day))) day = addDays(day, 1);
  return day;
};

/** A stable number in [0, 1) from text: seat counts and picks that stay put across reloads. */
export function chance(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 10_000) / 10_000;
}

// ---- Masters (read-only here; other areas seed the same ids) -----------------------------------

interface LocationSeed {
  code: string;
  name: string;
  zone: string;
  hub?: boolean;
  coordinates?: { lat: number; lng: number };
}
export interface LocationInfo extends Stop {
  zone: string;
  hub: boolean;
  coordinates: { lat: number; lng: number } | null;
}
export const LOCATIONS = new Map<string, LocationInfo>(
  (locationSeeds as LocationSeed[]).map((l) => [
    l.code,
    {
      ...ref('location', l.code, l.name),
      zone: l.zone,
      hub: l.hub === true,
      coordinates: l.coordinates ?? null,
    },
  ]),
);
const stop = (code: string): Stop => {
  const l = LOCATIONS.get(code);
  return l ? { id: l.id, code: l.code, name: l.name } : ref('location', code, code);
};

export const CATEGORIES: readonly { code: string; name: string; baseMode: BaseMode }[] = [
  { code: 'FIXED-WING', name: 'Fixed wing', baseMode: 'fixed-wing' },
  { code: 'MARINE', name: 'Marine', baseMode: 'marine' },
  { code: 'ROTARY-WING', name: 'Rotary wing', baseMode: 'rotary-wing' },
];
const BASE_MODE_OF_CATEGORY: Readonly<Record<string, BaseMode>> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c.baseMode]),
);
const MODE_BASE: Readonly<Record<Mode, BaseMode>> = {
  'fixed-wing': 'fixed-wing',
  'rotary-wing': 'rotary-wing',
  ferry: 'marine',
  'crew-boat': 'marine',
};
export const baseModeOf = (mode: Mode): BaseMode => MODE_BASE[mode];
export const categoryOfMode = (mode: Mode): string =>
  CATEGORIES.find((c) => c.baseMode === MODE_BASE[mode])?.code ?? 'MARINE';
/** 1xx fixed wing, 2xx rotary wing, 3xx ferry, 4xx crew boat; 9xx ad hoc (PROMPT §1.6). */
export const BAND: Readonly<Record<Mode, number>> = {
  'fixed-wing': 1,
  'rotary-wing': 2,
  ferry: 3,
  'crew-boat': 4,
};

interface RouteSeed {
  code: string;
  points: string[];
  category: string;
  durationMinutes: number;
}
export interface RouteInfo {
  id: string;
  code: string;
  name: string;
  revision: number;
  stops: Stop[];
  category: string;
  baseMode: BaseMode;
  durationMinutes: number;
}
export const ROUTES: readonly RouteInfo[] = (routeSeeds as RouteSeed[]).map((r) => {
  const stops = r.points.map(stop);
  return {
    id: idFor('route', r.code),
    code: r.code,
    name: stops.map((s) => s.name).join(' – '),
    revision: 1,
    stops,
    category: r.category,
    baseMode: BASE_MODE_OF_CATEGORY[r.category] ?? 'marine',
    durationMinutes: r.durationMinutes,
  };
});
export const routeById = (id: string) => ROUTES.find((r) => r.id === id);
const routeByCode = (code: string) => ROUTES.find((r) => r.code === code);
/** The route as a schedule or movement carries it. */
export const routeRef = (r: RouteInfo): RecurringSchedule['route'] => ({
  id: r.id,
  code: r.code,
  name: r.name,
  revision: r.revision,
  stops: r.stops,
});

interface ResourceTypeSeed {
  code: string;
  name: string;
  category: string;
  passengerCapacity: number;
}
export interface ResourceTypeInfo {
  id: string;
  code: string;
  name: string;
  category: string;
  baseMode: BaseMode;
  capacity: number;
}
export const RESOURCE_TYPES: readonly ResourceTypeInfo[] = (
  resourceTypeSeeds as ResourceTypeSeed[]
).map((t) => ({
  id: idFor('resource-type', t.code),
  code: t.code,
  name: t.name,
  category: t.category,
  baseMode: BASE_MODE_OF_CATEGORY[t.category] ?? 'marine',
  capacity: t.passengerCapacity,
}));
export const resourceTypeById = (id: string) => RESOURCE_TYPES.find((t) => t.id === id);

interface ProviderSeed {
  code: string;
  legalName: string;
  type: string;
}
export const PROVIDERS = (providerSeeds as ProviderSeed[])
  .filter((p) => p.type !== 'test')
  .map((p) => ref('service-provider', p.code, p.legalName));
export const providerByCode = (code: string) => PROVIDERS.find((p) => p.code === code);

interface FleetSeed {
  registration: string;
  type: string;
  provider: string;
  availability: 'available' | 'maintenance' | 'retired';
  bookable?: boolean;
}
export interface FleetInfo {
  id: string;
  registration: string;
  resourceTypeId: string;
  serviceProviderId: string;
  availability: 'available' | 'maintenance' | 'retired';
  bookable: boolean;
}
export const FLEET: readonly FleetInfo[] = (fleetSeeds as FleetSeed[]).map((f) => ({
  id: idFor('fleet', f.registration),
  registration: f.registration,
  resourceTypeId: idFor('resource-type', f.type),
  serviceProviderId: idFor('service-provider', f.provider),
  availability: f.availability,
  bookable: f.bookable !== false,
}));
export const fleetById = (id: string) => FLEET.find((f) => f.id === id);
const fleetByRegistration = (registration: string) =>
  FLEET.find((f) => f.registration === registration);

export const PASSENGER_CATEGORIES: Readonly<Record<string, string>> = {
  VIP: 'VIP',
  EP: 'EP',
  DH: 'Direct Hire',
  'EST-POS': 'Established Position',
  CON: 'Contractor',
  RADAR: 'Radar-NGCPA',
  VIS: 'Visitor',
  GEN: 'General',
};
export const passengerCategory = (code: string) =>
  ref('passenger-category', code, PASSENGER_CATEGORIES[code] ?? code);

// ---- People ----------------------------------------------------------------------------------

export interface Person {
  id: string;
  name: string;
  personnelNo: string;
  gender: 'M' | 'F' | null;
  category: string;
}
interface PassengerSeed {
  key: string;
  name: string;
  personnelNo: string;
  gender?: string;
  isVip?: boolean;
  isVisitor?: boolean;
}
const categoryOfPassenger = (p: PassengerSeed): string => {
  if (p.isVip) return 'VIP';
  if (p.isVisitor || p.key.startsWith('vs-')) return 'VIS';
  if (p.key.startsWith('cw-')) return 'CON';
  return chance(p.personnelNo) < 0.15 ? 'EST-POS' : 'DH';
};
const gender = (g: string | undefined): 'M' | 'F' | null => (g === 'M' || g === 'F' ? g : null);
/** The demo's people, for pre-manifest lines and requests. */
export const PEOPLE: readonly Person[] = (passengerSeeds as PassengerSeed[]).map((p) => ({
  id: idFor('passenger', p.personnelNo),
  name: p.name,
  personnelNo: p.personnelNo,
  gender: gender(p.gender),
  category: categoryOfPassenger(p),
}));

interface DispatchSeed {
  passengers: { personnelNo: string; name: string; gender?: string }[];
  movements: {
    flightNumber: string;
    provider: string;
    route: string;
    mode: Mode;
    type: string;
    fleet: string;
    dayOffset: number;
    departure: string;
    arrival: string;
    manifest: { personnelNo: string; category: string; finalDestination?: string }[];
  }[];
}
const dispatch = dispatchSeeds as unknown as DispatchSeed;
const DISPATCH_PEOPLE = new Map(dispatch.passengers.map((p) => [p.personnelNo, p]));
/** Dispatch's manifests (seeds/dispatch.json), so pre-manifests match what dispatch shows. */
export const DISPATCH_MANIFESTS = new Map<string, { person: Person; category: string }[]>(
  dispatch.movements.map((m) => [
    `${m.flightNumber}:${gstDate(m.dayOffset)}`,
    m.manifest.map((line) => {
      const p = DISPATCH_PEOPLE.get(line.personnelNo);
      return {
        person: {
          id: idFor('passenger', line.personnelNo),
          name: p?.name ?? line.personnelNo,
          personnelNo: line.personnelNo,
          gender: gender(p?.gender),
          category: line.category,
        },
        category: line.category,
      };
    }),
  ]),
);

// ---- Weather (NCM, SCH-R7) and helideck compatibility --------------------------------------------

export interface WeatherNote {
  offset: number;
  location: string;
  level: 'caution' | 'adverse';
  /** Which journeys it concerns. */
  applies: 'marine' | 'air' | 'all';
  summary: string;
  recommendation: string | null;
}
/** The forecast window: today and the next two days. */
export const WEATHER_DAYS = 3;
export const WEATHER: readonly WeatherNote[] = [
  {
    offset: 0,
    location: 'DAS',
    level: 'caution',
    applies: 'air',
    summary: 'Wind gusting 25 kt; reduced visibility in haze',
    recommendation: 'Expect holds of up to 45 minutes on rotary-wing departures.',
  },
  {
    offset: 1,
    location: 'ZRK',
    level: 'adverse',
    applies: 'marine',
    summary: 'Sea state above limits; strong north-westerly winds (Shamal) 30–35 kt',
    recommendation: 'Hold marine departures; consider rotary wing for essential crew.',
  },
  {
    offset: 1,
    location: 'ZRK',
    level: 'caution',
    applies: 'air',
    summary: 'North-westerly 22–28 kt; light turbulence below 3,000 ft',
    recommendation: null,
  },
  {
    offset: 2,
    location: 'UZ',
    level: 'caution',
    applies: 'all',
    summary: 'Fog patches 04:00–08:00; visibility below 2 km',
    recommendation: 'Plan departures from 09:00.',
  },
];

/** Helidecks rated below a type (C.4.2): the journey is flagged for the Aviation Team. */
export const HELIDECK_LIMITS: readonly {
  location: string;
  resourceType: string;
  message: string;
}[] = [
  {
    location: 'NASR',
    resourceType: 'AW189',
    message: 'NASR helideck D-value 16.0 m is below the AW189’s 20.6 m.',
  },
  {
    location: 'US',
    resourceType: 'AW189',
    message: 'Umm Shaif helideck is limited to 6.4 t; the AW189 is 8.6 t at maximum take-off.',
  },
];

// ---- Seeds -----------------------------------------------------------------------------------

interface ScheduleSeed {
  flightNumber: string;
  name: string;
  route: string;
  mode: Mode;
  fleet: string | null;
  days: number[];
  departureTime?: string;
  validFromDays: number;
  validToDays?: number;
}
/** Two more than B.4 so the list shows an unassigned and an ended schedule. */
const EXTRA_SCHEDULES: readonly (ScheduleSeed & { endedDays?: number; reason?: string })[] = [
  {
    flightNumber: 'ADA107',
    name: 'Abu Dhabi – Das Island Midday Shuttle',
    route: 'AUH-DAS-FW',
    mode: 'fixed-wing',
    fleet: null,
    days: [4, 7],
    departureTime: '12:30',
    validFromDays: 3,
    validToDays: 90,
  },
  {
    flightNumber: 'ADA105',
    name: 'Abu Dhabi – Zirku Island Summer Shuttle',
    route: 'AUH-ZRK-FW',
    mode: 'fixed-wing',
    fleet: 'A6-FLA',
    days: [2, 4],
    departureTime: '13:00',
    validFromDays: -120,
    validToDays: 30,
    endedDays: -10,
    reason: 'Summer timetable ended; demand moved to ADA103.',
  },
];
/** The type a schedule flies: its fleet unit's, else the route category's usual one. */
const DEFAULT_TYPE: Readonly<Record<string, string>> = {
  'FIXED-WING': 'DASH8-300',
  'ROTARY-WING': 'AW139',
  MARINE: 'FAST-CREW-BOAT',
};
const TYPE_OF_FLEET = new Map((fleetSeeds as FleetSeed[]).map((f) => [f.registration, f.type]));

function typeRef(code: string): RecurringSchedule['resourceType'] {
  const t = RESOURCE_TYPES.find((r) => r.code === code);
  return { id: idFor('resource-type', code), code, name: t?.name ?? code };
}

export function scheduleRows(): StoredSchedule[] {
  return [...(scheduleSeeds as ScheduleSeed[]), ...EXTRA_SCHEDULES].flatMap((s, i) => {
    const route = routeByCode(s.route);
    if (!route) return [];
    const unit = s.fleet ? fleetByRegistration(s.fleet) : undefined;
    const operator = s.flightNumber.slice(0, -3);
    const provider = providerByCode(operator) ?? ref('service-provider', operator, operator);
    const typeCode = (s.fleet && TYPE_OF_FLEET.get(s.fleet)) ?? DEFAULT_TYPE[route.category] ?? '';
    const extra = s as ScheduleSeed & { endedDays?: number; reason?: string };
    const ended = extra.endedDays !== undefined ? gstDate(extra.endedDays) : null;
    const no = String(i + 1).padStart(3, '0');
    return [
      {
        id: idFor('recurring-schedule', s.flightNumber),
        ref: `RS-${no}`,
        name: s.name,
        displayName: s.name,
        flightNumber: s.flightNumber,
        serviceProvider: provider,
        route: routeRef(route),
        mode: s.mode,
        resourceType: typeRef(typeCode),
        fleet: unit ? { id: unit.id, registration: unit.registration } : null,
        days: s.days,
        departureTime: s.departureTime ?? null,
        arrivalTime: s.departureTime ? addMinutes(s.departureTime, route.durationMinutes) : null,
        validFrom: gstDate(s.validFromDays),
        validTo: s.validToDays === undefined ? null : gstDate(s.validToDays),
        // ADA201 moved from 07:30 to 08:00 this week (see its kept journeys).
        version: s.flightNumber === 'ADA201' ? 2 : 1,
        isActive: ended === null,
        deactivatedReason: extra.reason ?? null,
        updatedAt: SEEDED_AT,
        endedOn: ended,
      },
    ];
  });
}

interface AdhocSeed {
  flightNumber: string;
  route: string;
  mode: Mode;
  fleet: string;
  type?: string;
  offset: number;
  departure: string;
  arrival?: string;
  purpose: string;
}
/** B.4's ad hoc movements (shifted around today) and dispatch's movements for today and tomorrow. */
const ADHOC: readonly AdhocSeed[] = [
  {
    flightNumber: 'AML901',
    route: 'AUH-ACPT-MAR',
    mode: 'ferry',
    fleet: 'ADNOC Supply 2',
    offset: -3,
    departure: '05:00',
    purpose: 'Shutdown crew and supplies for ACPT',
  },
  {
    flightNumber: 'ADA901',
    route: 'ZRK-NASR-RW',
    mode: 'rotary-wing',
    fleet: 'A6-AWB',
    offset: 4,
    departure: '09:00',
    purpose: 'Emergency maintenance team to NASR',
  },
  {
    flightNumber: 'AML902',
    route: 'AUH-UZ-MAR',
    mode: 'ferry',
    fleet: 'ADNOC Ferry 1',
    offset: 14,
    departure: '11:00',
    purpose: 'Unscheduled requests to Upper Zakum',
  },
  {
    flightNumber: 'ADA902',
    route: 'AUH-DAS-RW',
    mode: 'rotary-wing',
    fleet: 'A6-AWC',
    offset: -11,
    departure: '10:00',
    purpose: 'Urgent technicians to Das Island',
  },
  {
    flightNumber: 'ADA903',
    route: 'AUH-DAS-FW',
    mode: 'fixed-wing',
    fleet: 'A6-ADA',
    offset: -6,
    departure: '15:15',
    purpose: 'Extra seats for a crew change',
  },
  ...dispatch.movements.map((m) => ({
    flightNumber: m.flightNumber,
    route: m.route,
    mode: m.mode,
    fleet: m.fleet,
    type: m.type,
    offset: m.dayOffset,
    departure: m.departure,
    arrival: m.arrival,
    purpose:
      m.mode === 'fixed-wing'
        ? 'Crew change: extra seats to Das Island'
        : m.mode === 'rotary-wing'
          ? 'Well intervention crew to Upper Zakum'
          : 'Contractor mobilisation by crew boat',
  })),
];

export function adhocRows(): StoredAdhoc[] {
  return ADHOC.flatMap((a, i) => {
    const route = routeByCode(a.route);
    if (!route) return [];
    const unit = fleetByRegistration(a.fleet);
    const operator = a.flightNumber.slice(0, -3);
    const typeCode = a.type ?? TYPE_OF_FLEET.get(a.fleet) ?? DEFAULT_TYPE[route.category] ?? '';
    const serviceDate = gstDate(a.offset);
    return [
      {
        id: idFor('adhoc-movement', `${a.flightNumber}:${a.offset}`),
        ref: `AH-${String(i + 1).padStart(3, '0')}`,
        flightNumber: a.flightNumber,
        serviceProvider: providerByCode(operator) ?? ref('service-provider', operator, operator),
        route: routeRef(route),
        mode: a.mode,
        resourceType: typeRef(typeCode),
        fleet: unit ? { id: unit.id, registration: unit.registration } : null,
        serviceDate,
        departureTime: a.departure,
        arrivalTime: a.arrival ?? addMinutes(a.departure, route.durationMinutes),
        purpose: a.purpose,
        requestIds: [],
        isActive: true,
        deactivatedReason: null,
        version: 1,
        updatedAt: SEEDED_AT,
      },
    ];
  });
}

/** ADA201's journeys booked at 07:30 before it moved to 08:00, and AML303's dry-dock cancellations. */
export function overrideRows(schedules: readonly StoredSchedule[]): JourneyOverride[] {
  const rows: JourneyOverride[] = [];
  const ada201 = schedules.find((s) => s.flightNumber === 'ADA201');
  if (ada201) {
    for (const offset of [2, 3]) {
      const serviceDate = gstDate(offset);
      rows.push({
        id: idFor('journey', `ADA201:${serviceDate}`),
        sourceId: ada201.id,
        serviceDate,
        version: 1,
        kept: {
          flightNumber: ada201.flightNumber,
          route: ada201.route,
          mode: ada201.mode,
          resourceType: ada201.resourceType,
          fleet: ada201.fleet,
          serviceProvider: ada201.serviceProvider,
          departureTime: '07:30',
          arrivalTime: '08:10',
          reason: `Made by version 1 at 07:30; ${ada201.ref} has changed since.`,
          cause: 'changed',
        },
      });
    }
  }
  const aml303 = schedules.find((s) => s.flightNumber === 'AML303');
  if (aml303) {
    let found = 0;
    for (let offset = 1; offset <= 10 && found < 2; offset += 1) {
      const serviceDate = gstDate(offset);
      if (!aml303.days.includes(isoWeekday(serviceDate))) continue;
      found += 1;
      rows.push({
        id: idFor('journey', `AML303:${serviceDate}`),
        sourceId: aml303.id,
        serviceDate,
        version: 2,
        status: 'cancelled',
      });
    }
  }
  return rows;
}

interface RequestSeed {
  person: number;
  origin: string;
  destination: string;
  /** The travel day: today + offset, moved off the weekdays a movement already runs. */
  offset: number;
  avoid?: readonly number[];
  time?: string;
  criticality: UnscheduledRequest['criticality'];
  reason: [string, string];
}
const DUTY: [string, string] = ['TRV-DUTY', 'Duty'];
const CREW: [string, string] = ['TRV-CREW', 'Crew change'];
const MAINT: [string, string] = ['TRV-MAINT', 'Maintenance work'];
const AUDIT: [string, string] = ['TRV-AUDIT', 'Audit / inspection'];
const TRAIN: [string, string] = ['TRV-TRAIN', 'Training'];
const MEDICAL: [string, string] = ['TRV-MED', 'Medical / compassionate'];
const REQUESTS: readonly RequestSeed[] = [
  // Upper Zakum by sea: no movement on these days (AML305 runs Wednesday and Sunday).
  {
    person: 4,
    origin: 'AUH',
    destination: 'UZ',
    offset: 2,
    avoid: [3, 7],
    time: '06:00',
    criticality: 'urgent',
    reason: CREW,
  },
  {
    person: 17,
    origin: 'AUH',
    destination: 'UZ',
    offset: 2,
    avoid: [3, 7],
    criticality: 'normal',
    reason: CREW,
  },
  {
    person: 80,
    origin: 'AUH',
    destination: 'UZ',
    offset: 2,
    avoid: [3, 7],
    criticality: 'normal',
    reason: MAINT,
  },
  {
    person: 23,
    origin: 'ACPT',
    destination: 'AUH',
    offset: 4,
    criticality: 'normal',
    reason: DUTY,
  },
  {
    person: 41,
    origin: 'US',
    destination: 'AUH',
    offset: 1,
    time: '14:00',
    criticality: 'vital',
    reason: MEDICAL,
  },
  // Umm Shaif direct runs Tuesday and Thursday only.
  {
    person: 9,
    origin: 'AUH',
    destination: 'US',
    offset: 3,
    avoid: [2, 4],
    time: '09:00',
    criticality: 'urgent',
    reason: AUDIT,
  },
  {
    person: 88,
    origin: 'ZRK-Z1',
    destination: 'ZRK',
    offset: 1,
    criticality: 'normal',
    reason: DUTY,
  },
  {
    person: 95,
    origin: 'ZRK-Z1',
    destination: 'ZRK',
    offset: 1,
    criticality: 'normal',
    reason: DUTY,
  },
  // Pairs with no master route yet.
  {
    person: 30,
    origin: 'DAS',
    destination: 'ABK',
    offset: 3,
    time: '08:00',
    criticality: 'urgent',
    reason: MAINT,
  },
  { person: 55, origin: 'ZRK', destination: 'LZ', offset: 5, criticality: 'normal', reason: TRAIN },
  {
    person: 101,
    origin: 'AUH',
    destination: 'GHF',
    offset: 6,
    criticality: 'normal',
    reason: AUDIT,
  },
  {
    person: 64,
    origin: 'UZ',
    destination: 'NASR',
    offset: 2,
    time: '10:30',
    criticality: 'urgent',
    reason: MAINT,
  },
];

export function requestRows(): StoredRequest[] {
  return REQUESTS.flatMap((r, i) => {
    const person = PEOPLE[r.person];
    if (!person) return [];
    const no = `BK-2026-${String(4310 + i * 7).padStart(4, '0')}`;
    return [
      {
        id: idFor('booking', no),
        ref: no,
        person: { id: person.id, name: person.name, personnelNo: person.personnelNo },
        category: passengerCategory(person.category),
        origin: stop(r.origin),
        destination: stop(r.destination),
        travelDate: r.avoid ? dayAvoiding(r.offset, r.avoid) : gstDate(r.offset),
        requestedTime: r.time ?? null,
        criticality: r.criticality,
        status: 'approved',
        reason: { code: r.reason[0], description: r.reason[1] },
        submittedAt: new Date(Date.now() - (i + 2) * 7 * 3_600_000).toISOString(),
        takenBy: null,
      },
    ];
  });
}
