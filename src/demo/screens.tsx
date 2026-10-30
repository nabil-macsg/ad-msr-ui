import { CircleCheckBig, Hourglass, ListOrdered, Ticket } from 'lucide-react';
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
    { field: 'route', header: 'Route', sortable: false, kind: 'route' },
    { field: 'mode', header: 'Mode', kind: 'mode' },
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
  kpiIcons: [Ticket, CircleCheckBig, Hourglass, ListOrdered],
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

export const BookingsScreen = () => <DemoModulePage screen={BOOKINGS} />;
export const PobScreen = () => <DemoModulePage screen={POB} />;
