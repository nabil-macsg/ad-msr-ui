/**
 * Sample data for the demo Create Booking, Bulk Booking and Freight screens
 * (src/demo/booking-create), from the original ADNOC LMS demo. Locations and charge codes come
 * from the seeds, so names match the other modules; movements are the seed recurring schedules
 * (RS-SEED-0xx) with the flight numbers, aircraft and seats the original shows.
 */
import chargeCodeSeeds from './seeds/charge-codes.json';
import locationSeeds from './seeds/locations.json';
import { PASSENGER_ROWS } from './demo-booking-create-passengers';

/** The original's "today": travel dates and certificate checks start here. */
export const DEMO_TODAY = '2026-10-07';

export interface DemoPassenger {
  id: string;
  optimaId: string;
  name: string;
  vip: boolean;
  nationality: string;
  gender: string;
  department: string;
  designation: string;
  company: string;
  category: string;
  rotation: string | null;
  hseExpiry: string;
  securityExpiry: string;
  bositExpiry: string;
  huetExpiry: string;
}

export const PASSENGERS: readonly DemoPassenger[] = PASSENGER_ROWS.map(
  ([optimaId, name, vip, nationality, gender, department, designation, company, category, ...r]) => ({
    id: optimaId,
    optimaId,
    name,
    vip,
    nationality,
    gender,
    department,
    designation,
    company,
    category,
    rotation: r[0],
    hseExpiry: r[1],
    securityExpiry: r[2],
    bositExpiry: r[3],
    huetExpiry: r[4],
  }),
);

/** Passenger categories in the original's order; each has a seat quota on every movement. */
export const CATEGORIES = [
  'VIP',
  'EP',
  'Direct Hire',
  'Established Position',
  'Contractor',
  'Radar/NGCPA',
  'Visitor',
  'General',
] as const;
export type Category = (typeof CATEGORIES)[number];
/** The short labels of the movement list's "N … left" quota line. */
export const CATEGORY_SHORT: Readonly<Record<Category, string>> = {
  VIP: 'VIP',
  EP: 'E',
  'Direct Hire': 'DH',
  'Established Position': 'EP',
  Contractor: 'C',
  'Radar/NGCPA': 'R',
  Visitor: 'VIS',
  General: 'G',
};

export const COMPANIES = [
  'ADNOC Offshore',
  'ADNOC Drilling',
  'Schlumberger',
  'Halliburton',
  'Weatherford',
  'Shell',
  'NPCC',
  'TotalEnergies',
  'BP',
  'Target Engineering',
  'Gulf Marine Services',
  'Zamil Offshore',
  'Topaz Marine',
  'NPCC Marine',
] as const;

export const REASONS = [
  'Duty',
  'Leave',
  'Medical',
  'Field Break',
  'Mission',
  'RSD',
  'Emergency',
  'Visitor',
  'VIP',
  'Shutdown',
  'Demobilization',
  'Remobilization',
  'Evacuation',
] as const;

export interface DemoLocation {
  code: string;
  name: string;
}
export const LOCATIONS: readonly DemoLocation[] = locationSeeds.map((l) => ({
  code: l.code,
  name: l.name,
}));

export interface DemoChargeCode {
  code: string;
  description: string;
}
export const CHARGE_CODES: readonly DemoChargeCode[] = chargeCodeSeeds.map((c) => ({
  code: c.code,
  description: c.description,
}));

export const MODES = ['Fixed Wing', 'Rotary Wing', 'Ferry', 'Crew Boat'] as const;
export type Mode = (typeof MODES)[number];

export interface DemoMovement {
  /** The recurring schedule; a day's movement is `${id}-${date}`. */
  id: string;
  flightNo: string;
  aircraft: string;
  mode: Mode;
  /** Origin, any stops, destination (location names). */
  stops: string[];
  departure: string;
  arrival: string;
  /** Seat quota per category, in CATEGORIES order (sums to the capacity). */
  quota: number[];
  /** Seats left per category today, in CATEGORIES order. */
  left: number[];
  cutoff: string;
  status: 'Scheduled' | 'Delayed';
  /** From the Fleet Master resource type; null when it records none. */
  baggageKg: number | null;
}

const QUOTA: Readonly<Record<number, number[]>> = {
  50: [1, 2, 23, 4, 13, 2, 3, 2],
  19: [0, 1, 9, 1, 5, 1, 1, 1],
  16: [0, 0, 7, 1, 5, 1, 1, 1],
  12: [0, 0, 5, 1, 3, 1, 1, 1],
  80: [2, 2, 36, 6, 20, 4, 6, 4],
  40: [1, 1, 18, 3, 10, 2, 3, 2],
};

const movement = (
  id: string,
  flightNo: string,
  aircraft: string,
  mode: Mode,
  stops: string[],
  times: [string, string],
  seats: number,
  left: number[],
  baggageKg: number | null,
  status: DemoMovement['status'] = 'Scheduled',
): DemoMovement => ({
  id,
  flightNo,
  aircraft,
  mode,
  stops,
  departure: times[0],
  arrival: times[1],
  quota: QUOTA[seats] ?? [],
  left,
  cutoff: '14:00',
  status,
  baggageKg,
});

const AUH = 'Abu Dhabi';
const DAS = 'Das Island';
const ZRK = 'Zirku Island';

export const MOVEMENTS: readonly DemoMovement[] = [
  movement('RS-SEED-001', 'ADA101', 'Dash 8-300', 'Fixed Wing', [AUH, DAS], ['07:00', '08:15'], 50, [1, 2, 23, 4, 13, 2, 3, 2], 23),
  movement('RS-SEED-002', 'ADA102', 'Dash 8-300', 'Fixed Wing', [DAS, AUH], ['16:00', '17:15'], 50, [1, 2, 21, 3, 3, 2, 3, 1], 23),
  movement('RS-SEED-003', 'ADA103', 'Let 410', 'Fixed Wing', [AUH, ZRK], ['06:30', '07:30'], 19, [0, 1, 9, 1, 5, 1, 1, 1], null),
  movement('RS-SEED-004', 'FAL102', 'Let 410', 'Fixed Wing', [ZRK, AUH], ['15:30', '16:30'], 19, [0, 1, 6, 0, 0, 0, 1, 1], null),
  movement('RS-SEED-006', 'ADA202', 'AW189', 'Rotary Wing', ['Upper Zakum', DAS], ['11:00', '11:40'], 16, [0, 0, 5, 0, 0, 0, 1, 1], null),
  movement('RS-SEED-007', 'FAL201', 'AW139', 'Rotary Wing', [DAS, 'Umm Shaif'], ['08:30', '09:00'], 12, [0, 0, 5, 1, 3, 1, 1, 1], null),
  movement('RS-SEED-009', 'FAL203', 'Bell 412', 'Rotary Wing', [DAS, 'Lower Zakum'], ['15:00', '15:45'], 12, [0, 0, 5, 1, 3, 1, 1, 1], null, 'Delayed'),
  movement('RS-SEED-012', 'AML301', 'Fast Crew Boat', 'Ferry', [AUH, ZRK], ['06:00', '09:00'], 80, [2, 2, 36, 6, 20, 4, 0, 4], 30),
  movement('RS-SEED-013', 'AML302', 'Fast Crew Boat', 'Ferry', [ZRK, AUH], ['14:00', '17:00'], 80, [1, 2, 33, 4, 5, 3, 4, 4], 30),
  movement('RS-SEED-015', 'AML401', 'Supply Vessel', 'Crew Boat', [ZRK, 'Zirku Platform Z1'], ['07:30', '08:15'], 40, [1, 1, 18, 3, 10, 2, 3, 2], 30),
  movement('RS-SEED-017', 'AML305', 'Fast Crew Boat', 'Ferry', [AUH, 'Upper Zakum', 'Lower Zakum', 'ACPT'], ['04:30', '13:00'], 80, [2, 1, 31, 2, 7, 4, -3, 4], 30),
  movement('RS-SEED-016', 'AML403', 'Supply Vessel', 'Crew Boat', [ZRK, 'Zirku Platform Z2'], ['09:00', '10:00'], 40, [1, 1, 18, 3, 10, 2, 3, 2], 30),
];

/** A booking request created by the Create Booking or Bulk Booking flow. */
export interface DemoBookingRequest {
  id: string;
  reference: string;
  /** Bulk bookings share a batch id. */
  batch: string | null;
  passengerId: string;
  passengerName: string;
  category: string;
  company: string;
  movementId: string;
  flightNo: string;
  route: string;
  mode: Mode;
  travelDate: string;
  reason: string;
  chargeCode: string;
  specialRequirements: string;
  status: 'Pending approval';
  createdAt: string;
}

/** The original's next booking reference is BK-2026-0599. */
export const FIRST_BOOKING_NUMBER = 599;

export interface DemoAdHocRequest {
  id: string;
  reference: string;
  travelDate: string;
  from: string;
  to: string;
  mode: Mode;
  passengers: number;
  reason: string;
  createdAt: string;
}

export const CARGO_TYPES = [
  'Drilling Equipment',
  'Chemicals',
  'Food / Catering',
  'Spare Parts',
  'Personal Effects',
  'Medical Supplies',
  'HAZMAT',
  'Other',
] as const;
export const PRIORITIES = ['Normal', 'Urgent', 'Critical'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const TRANSPORT_MODES = [
  {
    name: 'Helicopter Belly',
    hint: 'Underslung or internal belly cargo — rotary wing',
  },
  {
    name: 'Fixed Wing Cargo Hold',
    hint: 'Dedicated cargo hold on fixed-wing aircraft',
  },
  { name: 'Boat Deck', hint: 'Vessel deck cargo — supply / crew boats' },
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number]['name'];

export interface DemoFreight {
  id: string;
  reference: string;
  cargoType: string;
  hazmat: boolean;
  origin: string;
  destination: string;
  requestedDate: string;
  weightKg: number;
  /** L × W × H in cm; null when not given. */
  dimensions: [number, number, number] | null;
  priority: Priority;
  transportMode: TransportMode;
  chargeCode: string;
  /** The originating site whose charge codes apply. */
  chargeSite: string;
  recordedAgainst: string;
  requestedBy: string;
  /** "1411 · 8 – Corrosives"; null when not hazardous. */
  unNumber: string | null;
  notes: string;
  createdAt: string;
}

const freight = (
  n: number,
  cargoType: string,
  hazmat: boolean,
  route: [string, string],
  requestedDate: string,
  weightKg: number,
  priority: Priority,
  transportMode: TransportMode,
  dimensions: [number, number, number],
  charge: [string, string],
  recordedAgainst: string,
  requestedBy: string,
  unNumber: string | null = null,
  notes = '',
): DemoFreight => ({
  id: `fr-${String(n).padStart(4, '0')}`,
  reference: `FR-2026-${String(n).padStart(4, '0')}`,
  cargoType,
  hazmat,
  origin: route[0],
  destination: route[1],
  requestedDate,
  weightKg,
  dimensions,
  priority,
  transportMode,
  chargeCode: charge[0],
  chargeSite: charge[1],
  recordedAgainst,
  requestedBy,
  unNumber,
  notes,
  createdAt: `${requestedDate}T06:00:00.000Z`,
});

const KHALID = 'Khalid Al Dhaheri';
const SAEED = 'Saeed Al Kaabi';
const DISPATCH = 'Dispatch Power User';
const AVIATION = 'Aviation Control';
const Z1 = 'Zirku Platform Z1';
const Z2 = 'Zirku Platform Z2';

export const FREIGHT: readonly DemoFreight[] = [
  freight(16, 'Chemicals', true, [AUH, 'ACPT'], '2026-10-07', 251, 'Normal', 'Helicopter Belly', [212, 102, 41], ['6', AUH], 'Ferdinand Reyes', KHALID, '1411 · 8 – Corrosives'),
  freight(15, 'Drilling Equipment', false, [AUH, DAS], '2026-10-11', 1335, 'Critical', 'Boat Deck', [125, 92, 115], ['7', AUH], 'Helen Stanton', SAEED),
  freight(14, 'Food / Catering', false, [DAS, 'Umm Shaif'], '2026-10-12', 576, 'Urgent', 'Fixed Wing Cargo Hold', [159, 58, 55], ['4', DAS], 'Suresh Iyer', SAEED),
  freight(13, 'Personal Effects', false, ['Umm Shaif', DAS], '2026-10-06', 318, 'Critical', 'Fixed Wing Cargo Hold', [168, 119, 67], ['3', 'Umm Shaif'], 'Grace Fernandez', KHALID),
  freight(12, 'Personal Effects', false, [AUH, 'ACPT'], '2026-10-11', 78, 'Urgent', 'Boat Deck', [185, 96, 53], ['5', AUH], 'Andrew Harrington', DISPATCH),
  freight(11, 'Chemicals', true, [ZRK, Z2], '2026-10-11', 983, 'Normal', 'Boat Deck', [208, 47, 49], ['3', ZRK], 'Karim Abdelrahman', DISPATCH, '2823 · 8 – Corrosives'),
  freight(10, 'Chemicals', false, [ZRK, Z1], '2026-10-09', 856, 'Normal', 'Helicopter Belly', [161, 83, 50], ['6', ZRK], 'Khalifa Al Mansoori', AVIATION),
  freight(9, 'Food / Catering', false, [ZRK, Z1], '2026-10-06', 1028, 'Normal', 'Fixed Wing Cargo Hold', [67, 69, 107], ['6', ZRK], 'Hamad Al Ketbi', SAEED),
  freight(8, 'Food / Catering', false, [ZRK, Z1], '2026-10-12', 885, 'Critical', 'Boat Deck', [121, 89, 108], ['4', ZRK], 'Rajesh Kumar', AVIATION),
  freight(7, 'Chemicals', true, [ZRK, Z2], '2026-10-08', 1061, 'Normal', 'Fixed Wing Cargo Hold', [118, 121, 36], ['6', ZRK], 'Zayed Al Qubaisi', SAEED, '1675 · 8 – Corrosives'),
  freight(6, 'Spare Parts', false, [DAS, 'Upper Zakum'], '2026-10-11', 1523, 'Urgent', 'Fixed Wing Cargo Hold', [168, 59, 145], ['3', DAS], 'Louise Stanton', AVIATION),
  freight(5, 'Food / Catering', false, [AUH, DAS], '2026-10-10', 900, 'Normal', 'Boat Deck', [200, 120, 90], ['1', AUH], 'Maria Santos', DISPATCH, null, 'Weekly galley resupply.'),
  freight(4, 'Spare Parts', false, [DAS, 'Upper Zakum'], '2026-10-09', 210, 'Normal', 'Helicopter Belly', [90, 60, 50], ['1', DAS], 'Ravi Menon', SAEED),
  freight(3, 'Medical Supplies', false, [AUH, 'Umm Shaif'], '2026-10-06', 35, 'Critical', 'Helicopter Belly', [60, 40, 40], ['8', AUH], 'Fatima Al Nuaimi', KHALID, null, 'Cold chain — clinic resupply, next available rotor.'),
  freight(2, 'Chemicals', true, [AUH, ZRK], '2026-10-08', 480, 'Critical', 'Boat Deck', [120, 100, 140], ['3', AUH], 'Mohammad Hassan', AVIATION, '1791 · 8 – Corrosives', 'Segregate from foodstuffs. Sealed IBC totes.'),
  freight(1, 'Drilling Equipment', false, [AUH, DAS], '2026-10-07', 1250, 'Urgent', 'Boat Deck', [240, 120, 110], ['4', AUH], 'Rajesh Kumar', DISPATCH, null, 'Top drive spares for the DAS workover rig — crane required on arrival.'),
];
