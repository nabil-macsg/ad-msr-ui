/** Mock API for the demo screens in src/demo/booking-create (Create / Bulk Booking, Freight). */
import { currentPersona } from '../demo-auth';
import { MockError, bodyOf, json, notFound, text } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, find, insert, newId, now, seed } from '../core/store';
import {
  CARGO_TYPES,
  CATEGORIES,
  CHARGE_CODES,
  DEMO_TODAY,
  FIRST_BOOKING_NUMBER,
  FREIGHT,
  LOCATIONS,
  MODES,
  MOVEMENTS,
  PASSENGERS,
  PRIORITIES,
  REASONS,
  TRANSPORT_MODES,
  type DemoAdHocRequest,
  type DemoBookingRequest,
  type DemoFreight,
  type DemoMovement,
  type DemoPassenger,
  type Mode,
  type Priority,
  type TransportMode,
} from '../data/demo-booking-create';

const BASE = '/api/v1/demo/booking-create';
const PAX = 'demo-booking-create:passengers';
const MOVES = 'demo-booking-create:movements';
const BOOKINGS = 'demo-booking-create:bookings';
const ADHOC = 'demo-booking-create:adhoc';
const FREIGHTS = 'demo-booking-create:freight';

type Fields = Record<string, string>;
const invalid = (fields: Fields) =>
  new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fields });

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const routeText = (m: DemoMovement) => m.stops.join(' → ');
const available = (m: DemoMovement) => m.left.reduce((a, b) => a + b, 0);

/** `RS-SEED-001-2026-10-07` → the schedule and the day. */
function movementOf(id: string): { movement: DemoMovement; date: string } | null {
  const date = id.slice(-10);
  const movement = all<DemoMovement>(MOVES).find((m) => `${m.id}-${date}` === id);
  return movement && ISO_DAY.test(date) ? { movement, date } : null;
}

function nextBookingReference(): string {
  const n = FIRST_BOOKING_NUMBER + all<DemoBookingRequest>(BOOKINGS).length;
  return `BK-2026-${String(n).padStart(4, '0')}`;
}

function checkCommon(body: Record<string, unknown>, fields: Fields) {
  const movementId = text(body.movementId);
  const reason = text(body.reason);
  const found = movementOf(movementId);
  if (!found) fields.movementId = 'Select a flight or vessel.';
  if (!(REASONS as readonly string[]).includes(reason)) fields.reason = 'Required';
  if (found && found.date < DEMO_TODAY) fields.movementId = 'The travel date has passed.';
  return { found, reason };
}

const hseExpired = (p: DemoPassenger, date: string) => p.hseExpiry < date;

function bookingRow(
  p: DemoPassenger,
  movement: DemoMovement,
  date: string,
  extra: { reason: string; chargeCode: string; specialRequirements: string; batch: string | null },
): DemoBookingRequest {
  return {
    id: newId(),
    reference: nextBookingReference(),
    batch: extra.batch,
    passengerId: p.id,
    passengerName: p.name,
    category: p.category,
    company: p.company,
    movementId: `${movement.id}-${date}`,
    flightNo: movement.flightNo,
    route: routeText(movement),
    mode: movement.mode,
    travelDate: date,
    reason: extra.reason,
    chargeCode: extra.chargeCode,
    specialRequirements: extra.specialRequirements,
    status: 'Pending approval',
    createdAt: now(),
  };
}

export function registerDemoBookingCreate(): void {
  seed(PAX, () => [...PASSENGERS]);
  seed(MOVES, () => MOVEMENTS.map((m) => ({ ...m })));
  seed(FREIGHTS, () => [...FREIGHT]);
  seed(BOOKINGS, () => []);
  seed(ADHOC, () => []);

  route('GET', `${BASE}/options`, () =>
    json({
      today: DEMO_TODAY,
      locations: LOCATIONS,
      chargeCodes: CHARGE_CODES,
      reasons: REASONS,
      categories: CATEGORIES,
      modes: MODES,
    }),
  );

  route('GET', `${BASE}/passengers`, (req) =>
    json(
      listRows(all<DemoPassenger>(PAX), req.query, {
        hasActive: false,
        search: (p) => [p.name, p.optimaId, p.company, p.department, p.designation],
        sorts: { department: (p) => `${p.department} ${p.designation}` },
        defaultSort: 'name:asc',
      }),
    ),
  );

  route('GET', `${BASE}/passengers/:id`, (req) => {
    const p = find<DemoPassenger>(PAX, req.params.id ?? '');
    return p ? json(p) : notFound('passenger');
  });

  /**
   * A day's published movements: `date`, `from` (origin), `to` (any later stop), `minSeats`,
   * `filter[mode]`; `modeCounts` counts every mode before the mode filter.
   */
  route('GET', `${BASE}/movements`, (req) => {
    const date = req.query.get('date') ?? DEMO_TODAY;
    const from = req.query.get('from') ?? '';
    const to = req.query.get('to') ?? '';
    const minSeats = Number(req.query.get('minSeats')) || 0;
    const rows = all<DemoMovement>(MOVES)
      .filter((m) => !from || m.stops[0] === from)
      .filter((m) => !to || m.stops.slice(1).includes(to))
      .filter((m) => available(m) >= minSeats)
      .map((m) => ({ ...m, movementId: `${m.id}-${date}`, travelDate: date, available: available(m) }));
    const modeCounts = Object.fromEntries(
      MODES.map((mode) => [mode, rows.filter((m) => m.mode === mode).length]),
    );
    // Keep the published order unless the user sorts.
    const order = new Map(rows.map((m, i) => [m.id, i]));
    const page = listRows(rows, req.query, {
      hasActive: false,
      search: (m) => [m.flightNo, m.aircraft, ...m.stops],
      sorts: { order: (m) => order.get(m.id) ?? 0 },
      defaultSort: 'order:asc',
    });
    return json({ ...page, modeCounts, total: page.total });
  });

  route('GET', `${BASE}/bookings`, (req) =>
    json(
      listRows(all<DemoBookingRequest>(BOOKINGS), req.query, {
        hasActive: false,
        search: (b) => [b.reference, b.passengerName, b.route, b.flightNo],
        defaultSort: 'createdAt:desc',
      }),
    ),
  );

  /** One passenger on one movement (Create Booking). */
  route('POST', `${BASE}/bookings`, (req) => {
    const body = bodyOf(req);
    const fields: Fields = {};
    const p = find<DemoPassenger>(PAX, text(body.passengerId));
    if (!p) fields.passengerId = 'Select a passenger.';
    const { found, reason } = checkCommon(body, fields);
    const chargeCode = text(body.chargeCode);
    if (!CHARGE_CODES.some((c) => c.code === chargeCode)) fields.chargeCode = 'Required';
    if (p && found && hseExpired(p, found.date))
      fields.passengerId = 'HSE Passport has expired for this travel date.';
    if (Object.keys(fields).length > 0 || !p || !found) throw invalid(fields);
    const row = bookingRow(p, found.movement, found.date, {
      reason,
      chargeCode,
      specialRequirements: text(body.specialRequirements).trim(),
      batch: null,
    });
    return json(insert(BOOKINGS, row), 201);
  });

  /** Several passengers on one movement, each with a charge code (Bulk Booking). */
  route('POST', `${BASE}/bookings/bulk`, (req) => {
    const body = bodyOf(req);
    const fields: Fields = {};
    const { found, reason } = checkCommon(body, fields);
    const lines = Array.isArray(body.passengers) ? (body.passengers as unknown[]) : [];
    const people = lines.map((line) => {
      const l = (line ?? {}) as Record<string, unknown>;
      return {
        p: find<DemoPassenger>(PAX, text(l.passengerId)),
        chargeCode: text(l.chargeCode),
      };
    });
    if (people.length === 0) fields.passengers = 'Select at least one passenger.';
    if (people.some((x) => !x.p)) fields.passengers = 'A passenger was not found.';
    if (people.some((x) => !CHARGE_CODES.some((c) => c.code === x.chargeCode)))
      fields.chargeCode = 'Every passenger needs a charge code.';
    if (found && people.some((x) => x.p && hseExpired(x.p, found.date)))
      fields.passengers = 'Remove passengers whose HSE Passport has expired.';
    if (found && available(found.movement) < people.length)
      fields.movementId = 'Not enough seats on this movement.';
    if (Object.keys(fields).length > 0 || !found) throw invalid(fields);
    const batch = newId();
    const rows = people.map(({ p, chargeCode }) =>
      insert(
        BOOKINGS,
        bookingRow(p as DemoPassenger, found.movement, found.date, {
          reason,
          chargeCode,
          specialRequirements: '',
          batch,
        }),
      ),
    );
    return json({ batch, items: rows.reverse() }, 201);
  });

  route('POST', `${BASE}/adhoc-requests`, (req) => {
    const body = bodyOf(req);
    const fields: Fields = {};
    const travelDate = text(body.travelDate);
    const from = text(body.from);
    const to = text(body.to);
    const mode = text(body.mode) as Mode;
    const passengers = Number(body.passengers);
    const reason = text(body.reason);
    const place = (name: string) => LOCATIONS.some((l) => l.name === name);
    if (!ISO_DAY.test(travelDate)) fields.travelDate = 'Required';
    else if (travelDate < DEMO_TODAY) fields.travelDate = 'Choose today or a later date.';
    if (!place(from)) fields.from = 'Required';
    if (!place(to)) fields.to = 'Required';
    else if (to === from) fields.to = 'Choose a destination other than the origin.';
    if (!MODES.includes(mode)) fields.mode = 'Required';
    if (!Number.isInteger(passengers) || passengers < 1) fields.passengers = 'At least 1';
    if (!(REASONS as readonly string[]).includes(reason)) fields.reason = 'Required';
    if (Object.keys(fields).length > 0) throw invalid(fields);
    const n = all<DemoAdHocRequest>(ADHOC).length + 1;
    const row: DemoAdHocRequest = {
      id: newId(),
      reference: `AH-2026-${String(n).padStart(4, '0')}`,
      travelDate,
      from,
      to,
      mode,
      passengers,
      reason,
      createdAt: now(),
    };
    return json(insert(ADHOC, row), 201);
  });

  route('GET', `${BASE}/freight`, (req) =>
    json(
      listRows(all<DemoFreight>(FREIGHTS), req.query, {
        hasActive: false,
        search: (f) => [
          f.reference,
          f.cargoType,
          f.hazmat ? 'HAZMAT' : '',
          f.destination,
          f.origin,
        ],
        sorts: { route: (f) => `${f.origin} ${f.destination}` },
        defaultSort: 'reference:desc',
      }),
    ),
  );

  route('GET', `${BASE}/freight/:id`, (req) => {
    const f = find<DemoFreight>(FREIGHTS, req.params.id ?? '');
    return f ? json(f) : notFound('freight request');
  });

  route('POST', `${BASE}/freight`, (req) => {
    const body = bodyOf(req);
    const fields: Fields = {};
    const cargoType = text(body.cargoType);
    const weightKg = Number(body.weightKg);
    const origin = text(body.origin);
    const destination = text(body.destination);
    const requestedDate = text(body.requestedDate);
    const priority = text(body.priority) as Priority;
    const transportMode = text(body.transportMode) as TransportMode;
    const chargeCode = text(body.chargeCode);
    const person = find<DemoPassenger>(PAX, text(body.recordedAgainst));
    const dims = Array.isArray(body.dimensions) ? (body.dimensions as unknown[]).map(Number) : [];
    if (!person) fields.recordedAgainst = 'A responsible person is required';
    if (!(CARGO_TYPES as readonly string[]).includes(cargoType))
      fields.cargoType = 'Cargo type is required';
    if (!Number.isFinite(weightKg) || weightKg <= 0) fields.weightKg = 'Valid weight is required';
    if (!LOCATIONS.some((l) => l.name === origin)) fields.origin = 'Required';
    if (!LOCATIONS.some((l) => l.name === destination)) fields.destination = 'Required';
    else if (destination === origin)
      fields.destination = 'Choose a destination other than the origin.';
    if (!ISO_DAY.test(requestedDate)) fields.requestedDate = 'Required';
    if (!PRIORITIES.includes(priority)) fields.priority = 'Required';
    if (!TRANSPORT_MODES.some((m) => m.name === transportMode))
      fields.transportMode = 'Select a transport mode';
    if (!CHARGE_CODES.some((c) => c.code === chargeCode))
      fields.chargeCode = 'Cost object / WBS is required';
    if (Object.keys(fields).length > 0 || !person) throw invalid(fields);
    const n =
      Math.max(0, ...all<DemoFreight>(FREIGHTS).map((f) => Number(f.reference.slice(-4)))) + 1;
    const hazmat = body.hazmat === true || cargoType === 'HAZMAT';
    const row: DemoFreight = {
      id: newId(),
      reference: `FR-2026-${String(n).padStart(4, '0')}`,
      cargoType,
      hazmat,
      origin,
      destination,
      requestedDate,
      weightKg,
      dimensions:
        dims.length === 3 && dims.every((d) => Number.isFinite(d) && d > 0)
          ? [dims[0] ?? 0, dims[1] ?? 0, dims[2] ?? 0]
          : null,
      priority,
      transportMode,
      chargeCode,
      chargeSite: origin,
      recordedAgainst: person.name,
      requestedBy: currentPersona()?.me.displayName ?? 'Demo User',
      unNumber: hazmat ? text(body.unNumber).trim() || null : null,
      notes: text(body.notes).trim(),
      createdAt: now(),
    };
    return json(insert(FREIGHTS, row), 201);
  });
}
