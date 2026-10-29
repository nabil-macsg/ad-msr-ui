import { bodyOf, json, MockError, notFound, text } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, find, replace, seed } from '../core/store';
import { BOOKING_MOVES, DATASETS, type DemoRow } from '../data/modules';

export interface DemoKpi {
  label: string;
  value: string | number;
  subline?: string;
}

const count = (rows: DemoRow[], field: string, value: string) =>
  rows.filter((r) => r[field] === value).length;
const sum = (rows: DemoRow[], field: string) =>
  rows.reduce((total, r) => total + (typeof r[field] === 'number' ? r[field] : 0), 0);

const SUMMARIES: Readonly<Record<string, (rows: DemoRow[]) => DemoKpi[]>> = {
  bookings: (rows) => [
    { label: 'Bookings', value: rows.length, subline: 'Next 10 days' },
    { label: 'Confirmed', value: count(rows, 'status', 'Confirmed') },
    { label: 'Pending approval', value: count(rows, 'status', 'Pending approval') },
    { label: 'Waitlisted', value: count(rows, 'status', 'Waitlisted') },
  ],
  departures: (rows) => [
    { label: 'Departures today', value: rows.length },
    { label: 'Passengers booked', value: sum(rows, 'booked') },
    { label: 'Checked in', value: sum(rows, 'checkedIn') },
    { label: 'Delayed', value: count(rows, 'status', 'Delayed') },
  ],
  pob: (rows) => [
    {
      label: 'Persons on board',
      value: sum(rows, 'pob'),
      subline: `${String(rows.length)} offshore locations`,
    },
    { label: 'Near limit', value: count(rows, 'status', 'Near limit') },
    { label: 'Over limit', value: count(rows, 'status', 'Over limit') },
    { label: 'Overstays', value: sum(rows, 'overstays') },
  ],
  helidecks: (rows) => [
    { label: 'Helidecks', value: rows.length },
    { label: 'Valid', value: count(rows, 'status', 'Valid') },
    { label: 'Due within 30 days', value: count(rows, 'status', 'Due within 30 days') },
    { label: 'Overdue', value: count(rows, 'status', 'Overdue') },
  ],
  reports: (rows) => {
    const last = rows.at(-1);
    return [
      {
        label: 'Passengers moved',
        value: sum(rows, 'passengers').toLocaleString('en'),
        subline: 'Last 6 months',
      },
      { label: 'Flights', value: sum(rows, 'flights').toLocaleString('en') },
      {
        label: 'On-time performance',
        value: `${String(last?.onTime ?? 0)}%`,
        subline: 'This month',
      },
      {
        label: 'Seat utilisation',
        value: `${String(last?.seatUtilisation ?? 0)}%`,
        subline: 'This month',
      },
    ];
  },
};

/** `GET /api/v1/demo/datasets/:name[/summary|/:id]` and a booking's status change. */
export function registerModules(): void {
  for (const [name, rows] of Object.entries(DATASETS)) seed(`demo:${name}`, rows);
  const known = (name: string | undefined) => {
    if (!name || !(name in DATASETS)) throw new MockError(404, 'NOT_FOUND', 'No such demo list.');
    return `demo:${name}`;
  };

  route('GET', '/api/v1/demo/datasets/:name', (req) =>
    json(listRows(all<DemoRow>(known(req.params.name)), req.query, { hasActive: false })),
  );
  route('GET', '/api/v1/demo/datasets/:name/:id', (req) => {
    const row = find<DemoRow>(known(req.params.name), req.params.id ?? '');
    return row ? json(row) : notFound();
  });
  route('GET', '/api/v1/demo/datasets/:name/summary', (req) =>
    json(SUMMARIES[req.params.name ?? '']?.(all<DemoRow>(known(req.params.name))) ?? []),
  );
  route('POST', '/api/v1/demo/datasets/bookings/:id/status', (req) => {
    const row = find<DemoRow>('demo:bookings', req.params.id ?? '');
    if (!row) return notFound('booking');
    const next = text(bodyOf(req).status);
    const from = text(row.status);
    if (!BOOKING_MOVES[from]?.includes(next)) {
      throw new MockError(
        422,
        'STATUS_NOT_ALLOWED',
        `A ${from.toLowerCase()} booking can’t become ${next.toLowerCase()}.`,
      );
    }
    return json(replace<DemoRow>('demo:bookings', { ...row, status: next }));
  });
}
