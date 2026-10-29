import { Plane, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { runtimeConfig } from '../app/config';
import { Field } from '../shared/ui/field';
import { ApprovalChain } from '../shared/ui/approval-chain';
import { Banner } from '../shared/ui/banner';
import { Button } from '../shared/ui/button';
import { CalendarMonth, CalendarWeek } from '../shared/ui/calendar';
import { ConfirmDialog } from '../shared/ui/confirm-dialog';
import { DataTable } from '../shared/ui/data-table';
import { DonutChart } from '../shared/ui/donut-chart';
import { EmptyState } from '../shared/ui/empty-state';
import { EntityFormModal } from '../shared/ui/entity-form-modal';
import { FileDropzone } from '../shared/ui/file-dropzone';
import { FilterBar } from '../shared/ui/filter-bar';
import { LiveTicker } from '../shared/ui/live-ticker';
import { MapView } from '../shared/ui/map-view';
import { ProvenanceChip } from '../shared/ui/provenance-chip';
import { SeatMap, type SeatState } from '../shared/ui/seat-map';
import { StatCard } from '../shared/ui/stat-card';
import { StatusPill } from '../shared/ui/status-pill';
import { Stepper } from '../shared/ui/stepper';
import { Timeline } from '../shared/ui/timeline';
import { type CapturedWeight, UnitInput } from '../shared/ui/unit-input';
import { useListParams } from '../shared/lists/list-params';
import { DemoMasterPage } from './DemoMasterPage';

interface Booking {
  ref: string;
  passenger: string;
  route: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
}
const BOOKINGS: Booking[] = [
  {
    ref: 'BK-2026-0001',
    passenger: 'Ahmed Al Mansoori',
    route: 'Abu Dhabi → Das Island',
    status: 'Confirmed',
  },
  {
    ref: 'BK-2026-0002',
    passenger: 'Fatima Al Hashimi',
    route: 'Abu Dhabi → Zirku',
    status: 'Pending',
  },
  {
    ref: 'BK-2026-0003',
    passenger: 'Rashed Al Marri',
    route: 'Das Island → Abu Dhabi',
    status: 'Cancelled',
  },
];
const TONE = { Confirmed: 'success', Pending: 'warning', Cancelled: 'danger' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-1 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Every design-system component with demo data (synthetic). Local dev server only. */
export default function Gallery() {
  const list = useListParams();
  const [seats, setSeats] = useState<Record<string, SeatState>>({
    '1A': 'taken',
    '2C': 'blocked',
    '3B': 'taken',
  });
  const [weight, setWeight] = useState<CapturedWeight | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [month, setMonth] = useState(new Date('2026-10-13T06:00:00Z'));
  const map = runtimeConfig().map;
  const now = new Date('2026-10-13T06:00:00Z');
  const events = [
    { id: 'e1', start: '2026-10-13T03:30:00Z', title: 'AH-001 Das Island', tone: 'info' as const },
    {
      id: 'e2',
      start: '2026-10-14T05:00:00Z',
      title: 'INS-2026-0012 Umm Shaif',
      tone: 'warning' as const,
    },
    { id: 'e3', start: '2026-10-16T08:00:00Z', title: 'Muster drill', tone: 'danger' as const },
  ];

  return (
    <main className="mx-auto max-w-content space-y-10 p-8">
      <header>
        <h1 className="text-3xl font-bold text-ink">Component gallery</h1>
        <p className="text-ink-secondary">
          Design-system components (PROMPT §4.2) with synthetic data. Local dev server only.
        </p>
      </header>

      <Section title="StatCard and StatusPill">
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Awaiting your approval"
            value={7}
            subline="2 over quota"
            tone="warning"
            icon={<Users className="size-5" />}
          />
          <StatCard
            title="Today's departures"
            value={12}
            subline="5 gone · 7 still to go"
            icon={<Plane className="size-5" />}
          />
          <StatCard title="Boarding now" value={0} subline="No gate open" />
          <StatCard
            title="Waitlisted today"
            value={0}
            subline="Everybody booked has a seat"
            tone="success"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success">Arrived</StatusPill>
          <StatusPill tone="info">Check-in</StatusPill>
          <StatusPill tone="warning">Awaiting approval</StatusPill>
          <StatusPill tone="danger">Expired</StatusPill>
          <StatusPill tone="neutral">Not recorded</StatusPill>
          <StatusPill tone="accent">Visitor</StatusPill>
        </div>
      </Section>

      <Section title="Banner, ProvenanceChip and EmptyState">
        <Banner tone="info" title="Cut-off">
          Bookings for tomorrow close at 14:00 GST.
        </Banner>
        <Banner tone="warning">HSE Passport expires in 12 days.</Banner>
        <Banner tone="danger" title="Helideck not serviceable">
          Friction test expired on 30 Sep 2026.
        </Banner>
        <div className="flex gap-2">
          <ProvenanceChip source="sap" syncedAt="2026-10-13T02:00:00Z" />
          <ProvenanceChip source="fieldglass" />
          <ProvenanceChip source="hse-passport" />
          <ProvenanceChip source="manual" />
        </div>
        <EmptyState
          title="No bookings yet"
          body="Bookings you create or that are made for you appear here."
        />
      </Section>

      <Section title="FilterBar and DataTable">
        <FilterBar
          q={list.params.q}
          onQChange={(q) => list.update({ q })}
          onClear={() => list.update({ q: '', filters: {} })}
        />
        <DataTable<Booking>
          caption="Bookings"
          columns={[
            { id: 'ref', header: 'Reference', cell: (b) => b.ref, sortField: 'ref' },
            {
              id: 'passenger',
              header: 'Passenger',
              cell: (b) => b.passenger,
              sortField: 'passenger',
            },
            { id: 'route', header: 'Route', cell: (b) => b.route },
            {
              id: 'status',
              header: 'Status',
              cell: (b) => <StatusPill tone={TONE[b.status]}>{b.status}</StatusPill>,
            },
          ]}
          rows={BOOKINGS.filter((b) =>
            b.passenger.toLowerCase().includes(list.params.q.toLowerCase()),
          )}
          total={BOOKINGS.length}
          rowKey={(b) => b.ref}
          params={list.params}
          onParamsChange={list.update}
          deactivatedToggle
          exports={{ allowed: true, onExport: () => undefined }}
        />
      </Section>

      <Section title="Timeline and ApprovalChain">
        <ApprovalChain
          now={now}
          stages={[
            {
              id: 's1',
              name: 'Line Manager',
              status: 'approved',
              approver: 'Saeed Al Kaabi',
              decidedAt: '2026-10-12T05:00:00Z',
            },
            {
              id: 's2',
              name: 'Aviation Team',
              status: 'pending',
              slaDueAt: '2026-10-13T10:00:00Z',
            },
            { id: 's3', name: 'Seat confirmation', status: 'waiting' },
          ]}
        />
        <Timeline
          title="What has happened"
          entries={[
            {
              id: 't2',
              at: '2026-10-12T05:00:00Z',
              title: 'Approved by Line Manager',
              actor: 'Saeed Al Kaabi',
              tone: 'success',
            },
            {
              id: 't1',
              at: '2026-10-11T08:30:00Z',
              title: 'Booking submitted',
              actor: 'Ahmed Al Mansoori',
              tone: 'info',
            },
          ]}
        />
      </Section>

      <Section title="DonutChart, SeatMap and MapView">
        <div className="flex flex-wrap items-start gap-10">
          <DonutChart
            title="Decks"
            slices={[
              { label: 'Current', value: 18, tone: 'success' },
              { label: 'Expiring soon', value: 4, tone: 'warning' },
              { label: 'Expired', value: 2, tone: 'danger' },
              { label: 'None', value: 1, tone: 'neutral' },
            ]}
          />
          <SeatMap
            layout={{ rows: 4, columns: ['A', 'B', '', 'C', 'D'] }}
            seats={seats}
            onSelect={(seat) =>
              setSeats((s) => ({ ...s, [seat]: s[seat] === 'selected' ? 'free' : 'selected' }))
            }
          />
        </div>
        <MapView
          tiles={{ url: map.tileUrl, attribution: map.attribution }}
          markers={[
            { id: 'das', lat: 25.15, lng: 52.87, label: 'Das Island', tone: 'success' },
            { id: 'zirku', lat: 24.88, lng: 53.07, label: 'Zirku Island', tone: 'warning' },
            { id: 'usc', lat: 25.05, lng: 53.55, label: 'Umm Shaif', tone: 'danger' },
          ]}
        />
      </Section>

      <Section title="Forms: Stepper, UnitInput, FileDropzone, EntityFormModal, ConfirmDialog">
        <Stepper
          steps={[
            { id: 'journey', label: 'Journey' },
            { id: 'review', label: 'Review & Submit' },
          ]}
          current={1}
        />
        <UnitInput label="Baggage weight" defaultUnit="lb" value={weight} onChange={setWeight} />
        <FileDropzone
          accept={['application/pdf', 'image/jpeg', 'image/png']}
          acceptLabel="PDF, JPG or PNG"
          maxSizeMb={20}
          multiple
          onFiles={(list) => setFiles(list.map((f) => f.name))}
        />
        {files.length > 0 && <p className="text-sm">Chosen: {files.join(', ')}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit location
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Cancel booking
          </Button>
        </div>
        <EntityFormModal
          open={editing}
          onOpenChange={setEditing}
          title="Edit location"
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
          }}
        >
          <Field label="Name" defaultValue="Das Island" />
          <Field label="Code" defaultValue="DAS" />
        </EntityFormModal>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Cancel booking BK-2026-0002?"
          body="The passenger and the approvers are notified."
          confirmLabel="Cancel booking"
          onConfirm={() => undefined}
        />
      </Section>

      <Section title="CalendarMonth, CalendarWeek and LiveTicker">
        <LiveTicker
          items={[
            { id: 'l1', text: 'AH-001 departed Abu Dhabi 07:05 GST', tone: 'success' },
            { id: 'l2', text: 'Friction test due at Umm Shaif', tone: 'warning' },
            { id: 'l3', text: 'Muster drill on Das Island on Thursday', tone: 'info' },
          ]}
        />
        <CalendarMonth month={month} events={events} onMonthChange={setMonth} now={now} />
        <CalendarWeek week={month} events={events} onWeekChange={setMonth} now={now} />
      </Section>

      <Section title="Master page pattern (Administration)">
        <DemoMasterPage />
      </Section>
    </main>
  );
}
