import { gstDate, idFor } from './ids';
import installationSeeds from './seeds/installations.json';
import locationSeeds from './seeds/locations.json';
import companySeeds from './seeds/companies.json';
import departmentSeeds from './seeds/departments.json';
import fleetSeeds from './seeds/fleet.json';
import passengerSeeds from './seeds/passengers.json';
import routeSeeds from './seeds/routes.json';
import scheduleSeeds from './seeds/recurring-schedules.json';
import zoneSeeds from './seeds/zones.json';

/**
 * Datasets for the representative Booking, Dispatch, POB, Helideck and Reporting screens. Those
 * modules aren't built in MASAR yet, so the demo shows realistic lists derived from the seeds.
 */
export type DemoValue = string | number | boolean | null;
export interface DemoRow {
  id: string;
  [field: string]: DemoValue;
}

/** A deterministic spread of numbers, so the demo shows the same data on every load. */
const spread = (i: number, mod: number) => (i * 7919 + 104729) % mod;

const locationName = new Map(locationSeeds.map((l) => [l.code, l.name]));
const zoneName = new Map(zoneSeeds.map((z) => [z.code, z.name]));
const routeText = (code: string) => {
  const route = routeSeeds.find((r) => r.code === code);
  return route ? route.points.map((p) => locationName.get(p) ?? p).join(' → ') : code;
};
const MODE: Record<string, string> = {
  'FIXED-WING': 'Fixed Wing',
  'ROTARY-WING': 'Rotary Wing',
  MARINE: 'Vessel / Boat',
};
const modeOfRoute = (code: string) =>
  MODE[routeSeeds.find((r) => r.code === code)?.category ?? ''] ?? 'Fixed Wing';

const companyName = new Map(companySeeds.map((c) => [c.code, c.name]));

const BOOKING_STATUS = [
  'Confirmed',
  'Confirmed',
  'Confirmed',
  'Pending approval',
  'Waitlisted',
  'Checked in',
  'Cancelled',
];
const CATEGORY = ['Direct Hire', 'Contractor', 'Visitor', 'Essential Personnel', 'VIP'];

export function bookingRows(): DemoRow[] {
  return passengerSeeds.slice(0, 48).map((p, i) => {
    const route = routeSeeds[spread(i, routeSeeds.length)] ?? routeSeeds[0];
    const status = BOOKING_STATUS[spread(i + 3, BOOKING_STATUS.length)] ?? 'Confirmed';
    return {
      id: idFor('booking', String(i)),
      reference: `BK-2026-${String(4100 + i).padStart(6, '0')}`,
      passenger: p.name,
      personnelNo: p.personnelNo,
      category: p.isVip
        ? 'VIP'
        : p.isVisitor
          ? 'Visitor'
          : (CATEGORY[spread(i, 4)] ?? 'Direct Hire'),
      route: routeText(route?.code ?? ''),
      mode: modeOfRoute(route?.code ?? ''),
      serviceDate: gstDate(spread(i, 10) - 2),
      status,
      requestedBy: p.department === 'SITE' ? 'Site Logistics' : 'Department Coordinator',
      company: companyName.get(p.company) ?? p.company,
      departs: `${String(6 + spread(i, 9)).padStart(2, '0')}:${spread(i, 2) === 0 ? '00' : '30'}`,
      chargeCode: String(1 + spread(i, 12)),
    };
  });
}

const DEPARTURE_STATUS = [
  'Scheduled',
  'Check-in open',
  'Boarding',
  'Departed',
  'Arrived',
  'Delayed',
  'Closed for Dispatch',
  'Arrived',
  'Cancelled',
  'Closed for Boarding',
];
const FLEET_TYPE: Record<string, string> = {
  AW139: 'AW139',
  AW189: 'AW189',
  BARGE: 'Barge',
  'BELL-412': 'Bell 412',
  'DASH8-300': 'Dash 8-300',
  'FAST-CREW-BOAT': 'Crew Boat',
  FERRY: 'Ferry',
  'LET-410': 'Let 410',
  'SUPPLY-VESSEL': 'Supply Vessel',
};
const fleetType = (registration: string) => {
  const type = fleetSeeds.find((f) => f.registration === registration)?.type ?? '';
  return FLEET_TYPE[type] ?? type;
};

export function departureRows(): DemoRow[] {
  return scheduleSeeds.map((s, i) => {
    const capacity = s.mode === 'marine' ? 80 : s.mode === 'rotary-wing' ? 12 : 50;
    const booked = Math.min(capacity, 6 + spread(i, capacity));
    return {
      id: idFor('departure', s.flightNumber),
      flightNumber: s.flightNumber,
      mode:
        MODE[
          s.mode === 'fixed-wing'
            ? 'FIXED-WING'
            : s.mode === 'rotary-wing'
              ? 'ROTARY-WING'
              : 'MARINE'
        ] ?? 'Fixed Wing',
      route: routeText(s.route),
      from: routeText(s.route).split(' → ')[0] ?? '',
      to: routeText(s.route).split(' → ').at(-1) ?? '',
      fleet: s.fleet,
      fleetType: fleetType(s.fleet),
      waiting: spread(i + 4, 5) === 0 ? 3 + spread(i, 3) : 0,
      departure: s.departureTime ?? null,
      booked,
      capacity,
      checkedIn: Math.max(0, booked - spread(i + 1, 6)),
      // Passengers and baggage against the aircraft's payload; boats carry no payload limit.
      payloadKg: s.mode === 'marine' ? null : booked * 92 + spread(i, 120) + (i === 3 ? 400 : 0),
      payloadLimit: s.mode === 'marine' ? null : s.mode === 'rotary-wing' ? 1400 : 5500,
      status: DEPARTURE_STATUS[spread(i + 2, DEPARTURE_STATUS.length)] ?? 'Scheduled',
    };
  });
}

export function pobRows(): DemoRow[] {
  return locationSeeds
    .filter((l) => l.type !== 'BASE')
    .map((l, i) => {
      const limit = l.pobLimit ?? 30 + spread(i, 60);
      const pob = Math.round((limit * (55 + spread(i, 50))) / 100);
      const utilisation = Math.round((pob / limit) * 100);
      return {
        id: idFor('location', l.code),
        location: l.name,
        code: l.code,
        zone: zoneName.get(l.zone) ?? l.zone,
        type: l.type.charAt(0) + l.type.slice(1).toLowerCase(),
        pob,
        limit,
        utilisation,
        status: utilisation > 100 ? 'Over limit' : utilisation >= 90 ? 'Near limit' : 'Normal',
        overstays: spread(i, 4),
      };
    });
}

const ACCEPTANCE = [
  'Accepted',
  'Accepted',
  'Accepted',
  'Accepted',
  'Expiring Soon',
  'Accepted',
  'Awaiting Acceptance',
  'Expired',
  'Accepted',
  'None on record',
];
const HELIDECK_STATUS = [
  'Valid',
  'Valid',
  'Valid',
  'Due within 30 days',
  'With limitations',
  'Overdue',
];

export function helideckRows(): DemoRow[] {
  return installationSeeds
    .filter((h) => h.type === 'HELIDECK')
    .map((h, i) => {
      const status = HELIDECK_STATUS[spread(i, HELIDECK_STATUS.length)] ?? 'Valid';
      return {
        id: idFor('installation', h.code),
        installation: h.name,
        code: h.code,
        location: locationName.get(h.location) ?? h.location,
        deckClass: h.deckClass ?? null,
        dValue: h.dValue,
        tValue: h.tValue,
        lastSurvey: h.lastOpsSurveyOn ?? null,
        field: `${zoneName.get(locationSeeds.find((l) => l.code === h.location)?.zone ?? '') ?? 'Other'} Field`,
        material: 'Material not recorded',
        // Acceptance letter: current, expiring within 60 days, expired, or never issued.
        acceptance: ACCEPTANCE[spread(i + 2, ACCEPTANCE.length)] ?? 'Accepted',
        acceptanceUntil: gstDate(
          ACCEPTANCE[spread(i + 2, ACCEPTANCE.length)] === 'Expired'
            ? -spread(i, 40) - 1
            : ACCEPTANCE[spread(i + 2, ACCEPTANCE.length)] === 'Expiring Soon'
              ? 3 + spread(i, 55)
              : 70 + spread(i, 300),
        ),
        // Friction, lighting, fire-fighting and net checks: pass, or a warning to look at.
        checks: [0, 1, 2, 3].map((n) => (spread(i + n * 7, 11) === 0 ? 'warn' : 'pass')).join(','),
        findingsHigh: spread(i, 9) === 0 ? 1 + spread(i, 2) : 0,
        findingsMedium: spread(i + 1, 12) === 0 ? 1 : 0,
        findingsPastTarget: spread(i + 3, 17) === 0 ? 1 : 0,
        inspector: spread(i + 4, 9) === 0 ? null : 'Assigned',
        frictionFailed: spread(i + 5, 18) === 0,
        documents: spread(i, 3) !== 0,
        assessmentPending: spread(i + 6, 15) === 0,
        nextInspection: gstDate(
          status === 'Overdue'
            ? -spread(i, 20) - 1
            : status === 'Due within 30 days'
              ? spread(i, 29) + 1
              : 40 + spread(i, 300),
        ),
        status,
      };
    });
}

export function reportRows(): DemoRow[] {
  const months = ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'];
  return months.map((month, i) => {
    const flights = 410 + spread(i, 90);
    return {
      id: idFor('report-month', month),
      month,
      passengers: 9800 + spread(i, 2400),
      flights,
      voyages: 120 + spread(i + 2, 40),
      onTime: 88 + spread(i, 9),
      cancellations: 14 + spread(i + 1, 18),
      seatUtilisation: 71 + spread(i + 3, 18),
    };
  });
}

/** Statuses a booking may move to from the demo's Bookings screen. */
const departmentName = new Map(departmentSeeds.map((d) => [d.code, d.name]));
const NATIONALITY: Record<string, string> = {
  AE: 'Emirati',
  GB: 'British',
  IN: 'Indian',
  PK: 'Pakistani',
  PH: 'Filipino',
  EG: 'Egyptian',
  JO: 'Jordanian',
  US: 'American',
  SA: 'Saudi',
  OM: 'Omani',
  LB: 'Lebanese',
  BD: 'Bangladeshi',
  LK: 'Sri Lankan',
  NP: 'Nepali',
};
const ROTATIONS = ['14/14', '28/28', '21/21', '7/7', 'Office'];

/** People who have travelled or are booked to travel, with their compliance and trips. */
export function passengerRows(): DemoRow[] {
  const bookings = bookingRows();
  return passengerSeeds.map((p, i) => {
    const mine = bookings.filter((b) => b.passenger === p.name);
    const dates = mine.map((b) => String(b.serviceDate)).sort();
    const today = gstDate(0);
    const category = p.isVisitor
      ? 'Visitor'
      : p.source === 'sap'
        ? spread(i, 9) === 0
          ? 'Radar/NGCPA'
          : 'Direct Hire'
        : 'Contractor';
    // A few passports run out soon, and a handful have run out (blocked from travel).
    const hseDays = spread(i + 5, 23) === 0 ? -(4 + spread(i, 40)) : 8 + spread(i, 520);
    return {
      id: idFor('passenger', p.key),
      name: p.name,
      optima: `OPT-${String(10000 + spread(i, 40000))}`,
      personnelNo: p.personnelNo,
      category,
      isVip: p.isVip,
      employer: companyName.get(p.company) ?? p.company,
      designation: p.designation,
      department: (p.department && departmentName.get(p.department)) ?? p.department ?? '—',
      gender: p.gender === 'F' ? 'Female' : 'Male',
      nationality: NATIONALITY[p.nationality] ?? p.nationality,
      weight: 62 + spread(i, 38),
      hseExpiry: gstDate(hseDays),
      hseBlocked: hseDays < 0,
      securityExpiry: gstDate(30 + spread(i + 1, 500)),
      bosiet: `TB-${String(11000 + spread(i, 9000))}`,
      bosietExpiry: gstDate(20 + spread(i + 2, 600)),
      huet: `TH-${String(20000 + spread(i, 9000))}`,
      huetExpiry: gstDate(40 + spread(i + 3, 600)),
      rotation: ROTATIONS[spread(i, ROTATIONS.length)] ?? '14/14',
      costObject: `CC-${String(4000 + spread(i, 60))}`,
      trips: mine.length + spread(i, 5),
      lastTrip: dates.filter((d) => d < today).at(-1) ?? null,
      nextTrip: dates.find((d) => d >= today) ?? null,
      hasBookings: mine.length > 0,
    };
  });
}

const CARGO = [
  'Chemicals',
  'Drilling Equipment',
  'Food / Catering',
  'Personal Effects',
  'Spare Parts',
];
const DESTINATIONS = ['ACPT', 'Das Island', 'Umm Shaif', 'Zirku Platform Z1', 'Zirku Platform Z2'];

/** Consignments on their way offshore, waiting for the destination to confirm receipt. */
export function freightRows(): DemoRow[] {
  return Array.from({ length: 16 }, (_, i) => {
    const n = 16 - i;
    const cargo = CARGO[spread(n, CARGO.length)] ?? 'Chemicals';
    return {
      id: idFor('freight', String(n)),
      note: `FR-2026-${String(n).padStart(4, '0')}`,
      cargo,
      hazmat: cargo === 'Chemicals' && spread(n, 3) !== 0,
      destination: DESTINATIONS[spread(n + 1, DESTINATIONS.length)] ?? 'Das Island',
      weightKg: 60 + spread(n, 1300),
      expected: gstDate(spread(n, 7) - 1),
      receivedAt: null,
      receivedBy: null,
    };
  });
}

export const BOOKING_MOVES: Readonly<Record<string, readonly string[]>> = {
  'Pending approval': ['Confirmed', 'Rejected', 'Cancelled'],
  Waitlisted: ['Confirmed', 'Cancelled'],
  Confirmed: ['Checked in', 'Cancelled'],
};

export const DATASETS: Readonly<Record<string, () => DemoRow[]>> = {
  bookings: bookingRows,
  passengers: passengerRows,
  departures: departureRows,
  freight: freightRows,
  hems: () => [],
  pob: pobRows,
  helidecks: helideckRows,
  reports: reportRows,
};
