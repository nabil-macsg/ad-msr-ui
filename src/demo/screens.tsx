import { DemoModulePage, type DemoScreen } from './DemoModulePage';

const MODES = ['Fixed Wing', 'Rotary Wing', 'Vessel / Boat'];

const BOOKINGS: DemoScreen = {
  dataset: 'bookings',
  title: 'Bookings',
  subtitle:
    'Passenger bookings across fixed wing, rotary wing and marine services. Open one to see it or change its status.',
  noun: 'bookings',
  search: 'Search by reference, passenger or personnel number',
  columns: [
    { field: 'reference', header: 'Reference', kind: 'mono' },
    { field: 'passenger', header: 'Passenger' },
    { field: 'category', header: 'Category' },
    { field: 'route', header: 'Route', sortable: false },
    { field: 'mode', header: 'Mode' },
    { field: 'serviceDate', header: 'Travel date', kind: 'date' },
    { field: 'status', header: 'Status', kind: 'status' },
  ],
  filters: [
    {
      field: 'status',
      label: 'Status',
      options: ['Confirmed', 'Pending approval', 'Waitlisted', 'Checked in', 'Cancelled'],
    },
    { field: 'mode', label: 'Mode', options: MODES },
  ],
  label: (r) => `${String(r.reference)} · ${String(r.passenger)}`,
  defaultSort: { field: 'serviceDate', dir: 'asc' },
  statusActions: true,
};

const DISPATCH: DemoScreen = {
  dataset: 'departures',
  title: 'Dispatch Dashboard',
  subtitle: 'Today’s departures by flight or voyage, with bookings and check-in progress.',
  noun: 'departures',
  search: 'Search by flight, route or fleet unit',
  columns: [
    { field: 'flightNumber', header: 'Flight / voyage', kind: 'mono' },
    { field: 'mode', header: 'Mode' },
    { field: 'route', header: 'Route', sortable: false },
    { field: 'fleet', header: 'Fleet unit' },
    { field: 'departure', header: 'Departs' },
    { field: 'booked', header: 'Booked', kind: 'number' },
    { field: 'checkedIn', header: 'Checked in', kind: 'number' },
    { field: 'status', header: 'Status', kind: 'status' },
  ],
  filters: [
    { field: 'mode', label: 'Mode', options: MODES },
    {
      field: 'status',
      label: 'Status',
      options: ['Scheduled', 'Check-in open', 'Boarding', 'Departed', 'Arrived', 'Delayed'],
    },
  ],
  label: (r) => `${String(r.flightNumber)} · ${String(r.route)}`,
  defaultSort: { field: 'departure', dir: 'asc' },
};

const POB: DemoScreen = {
  dataset: 'pob',
  title: 'POB Dashboard',
  subtitle: 'Persons on board at each offshore location against its limit.',
  noun: 'locations',
  search: 'Search by location or code',
  columns: [
    { field: 'location', header: 'Location' },
    { field: 'zone', header: 'Zone' },
    { field: 'type', header: 'Type' },
    { field: 'pob', header: 'POB', kind: 'number' },
    { field: 'limit', header: 'Limit', kind: 'number' },
    { field: 'utilisation', header: 'Utilisation', kind: 'percent' },
    { field: 'overstays', header: 'Overstays', kind: 'number' },
    { field: 'status', header: 'Status', kind: 'status' },
  ],
  filters: [{ field: 'status', label: 'Status', options: ['Normal', 'Near limit', 'Over limit'] }],
  label: (r) => String(r.location),
  defaultSort: { field: 'utilisation', dir: 'desc' },
};

const HELIDECK: DemoScreen = {
  dataset: 'helidecks',
  title: 'Helideck Dashboard',
  subtitle: 'Each helideck’s D-value, T-value and inspection status.',
  noun: 'helidecks',
  search: 'Search by installation or location',
  columns: [
    { field: 'installation', header: 'Installation' },
    { field: 'location', header: 'Location' },
    { field: 'deckClass', header: 'Class' },
    { field: 'dValue', header: 'D-value (m)', kind: 'number' },
    { field: 'tValue', header: 'T-value (t)', kind: 'number' },
    { field: 'nextInspection', header: 'Next inspection', kind: 'date' },
    { field: 'status', header: 'Status', kind: 'status' },
  ],
  filters: [
    {
      field: 'status',
      label: 'Status',
      options: ['Valid', 'Due within 30 days', 'With limitations', 'Overdue'],
    },
  ],
  label: (r) => String(r.installation),
  defaultSort: { field: 'nextInspection', dir: 'asc' },
};

const REPORTS: DemoScreen = {
  dataset: 'reports',
  title: 'Executive Summary',
  subtitle: 'Monthly passenger movement, punctuality and utilisation across all transport modes.',
  noun: 'months',
  search: 'Search by month',
  columns: [
    { field: 'month', header: 'Month', sortable: false },
    { field: 'passengers', header: 'Passengers', kind: 'number' },
    { field: 'flights', header: 'Flights', kind: 'number' },
    { field: 'voyages', header: 'Voyages', kind: 'number' },
    { field: 'onTime', header: 'On time', kind: 'percent' },
    { field: 'cancellations', header: 'Cancellations', kind: 'number' },
    { field: 'seatUtilisation', header: 'Seat utilisation', kind: 'percent' },
  ],
  filters: [],
  label: (r) => String(r.month),
};

export const BookingsScreen = () => <DemoModulePage screen={BOOKINGS} />;
export const BookingDashboardScreen = () => (
  <DemoModulePage
    screen={{
      ...BOOKINGS,
      title: 'Booking Dashboard',
      subtitle: 'Bookings for the next ten days, by status and mode.',
    }}
  />
);
export const DispatchScreen = () => <DemoModulePage screen={DISPATCH} />;
export const PobScreen = () => <DemoModulePage screen={POB} />;
export const HelideckScreen = () => <DemoModulePage screen={HELIDECK} />;
export const ReportsScreen = () => <DemoModulePage screen={REPORTS} />;
