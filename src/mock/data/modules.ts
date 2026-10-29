import { gstDate, idFor } from './ids';
import installationSeeds from './seeds/installations.json';
import locationSeeds from './seeds/locations.json';
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
];

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
      fleet: s.fleet,
      departure: s.departureTime ?? null,
      booked,
      capacity,
      checkedIn: Math.max(0, booked - spread(i + 1, 6)),
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
export const BOOKING_MOVES: Readonly<Record<string, readonly string[]>> = {
  'Pending approval': ['Confirmed', 'Cancelled'],
  Waitlisted: ['Confirmed', 'Cancelled'],
  Confirmed: ['Checked in', 'Cancelled'],
};

export const DATASETS: Readonly<Record<string, () => DemoRow[]>> = {
  bookings: bookingRows,
  departures: departureRows,
  pob: pobRows,
  helidecks: helideckRows,
  reports: reportRows,
};
