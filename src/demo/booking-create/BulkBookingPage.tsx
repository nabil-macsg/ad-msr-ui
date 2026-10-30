import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CircleCheckBig, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import {
  CATEGORIES,
  type DemoAdHocRequest,
  type DemoBookingRequest,
  type DemoPassenger,
} from '../../mock/data/demo-booking-create';
import { RowActions } from '../../modules/administration/masters/master-page';
import { useListParams } from '../../shared/lists/list-params';
import { cn } from '../../shared/lib/cn';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { CONTROL } from '../../shared/ui/control-styles';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, SelectField } from '../../shared/ui/field';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { Stepper } from '../../shared/ui/stepper';
import {
  type DayMovement,
  bookingCreateKey,
  createAdHocRequest,
  createBulkBooking,
  fetchAllPassengers,
  fieldErrors,
  useMovements,
  useOptions,
  usePassengers,
} from './api';
import { useLocalList, withFilter } from './local-list';
import { COMPANY_OPTIONS, GENDERS } from './options';
import { Info, PassengerCell, chargeLabel, compliance, shortDate } from './shared';

const STEPS = [
  { id: 'passengers', label: 'Select Passengers' },
  { id: 'journey', label: 'Select Journey' },
  { id: 'review', label: 'Review Manifest' },
  { id: 'done', label: 'Confirmed' },
];

const countBy = (people: readonly DemoPassenger[]) =>
  CATEGORIES.map((c) => [c, people.filter((p) => p.category === c).length] as const).filter(
    ([, n]) => n > 0,
  );

function CategoryCounts({ people }: { people: readonly DemoPassenger[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {countBy(people).map(([c, n]) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <StatusPill tone="neutral">{c}</StatusPill>
          <span className="text-sm font-semibold text-ink">{n}</span>
        </span>
      ))}
    </div>
  );
}

/** Bulk Booking: many passengers on one published movement, reviewed as a manifest. */
export default function BulkBookingPage() {
  const options = useOptions();
  const today = options.data?.today ?? '2026-10-07';
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<DemoPassenger[]>([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('Duty');
  const [movement, setMovement] = useState<DayMovement | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DemoBookingRequest[] | null>(null);
  const travelDate = date || today;

  const restart = () => {
    setStep(0);
    setSelected([]);
    setMovement(null);
    setCodes({});
    setDone(null);
    setError(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bulk Booking"
        subtitle="Select multiple passengers and assign them to a single flight or vessel in one operation"
      />
      <Stepper steps={STEPS} current={done ? 3 : step} />
      {error && <Banner tone="danger">{error}</Banner>}
      {done && movement ? (
        <DoneStep bookings={done} people={selected} movement={movement} onNew={restart} />
      ) : step === 0 ? (
        <PassengersStep
          selected={selected}
          travelDate={travelDate}
          onChange={(s) => {
            setSelected(s);
            setError(null);
          }}
          onNext={() => {
            if (selected.length === 0) setError('Select at least one passenger to continue.');
            else {
              setError(null);
              setStep(1);
            }
          }}
        />
      ) : step === 1 ? (
        <JourneyStep
          group={selected.length}
          today={today}
          date={travelDate}
          onDate={(d) => {
            setDate(d);
            setMovement(null);
          }}
          reason={reason}
          onReason={setReason}
          movement={movement}
          onMovement={(m) => {
            setMovement(m);
            setError(null);
          }}
          onBack={() => setStep(0)}
          onNext={() => {
            if (!reason) setError('Reason for travel is required.');
            else if (!movement) setError('Select a flight or vessel to continue.');
            else {
              setError(null);
              setStep(2);
            }
          }}
        />
      ) : movement ? (
        <ReviewStep
          people={selected}
          movement={movement}
          reason={reason}
          codes={codes}
          onCodes={setCodes}
          onRemove={(ids) => setSelected((s) => s.filter((p) => !ids.includes(p.id)))}
          onBack={() => setStep(1)}
          onDone={setDone}
        />
      ) : null}
    </div>
  );
}

function PassengersStep({
  selected,
  travelDate,
  onChange,
  onNext,
}: {
  selected: DemoPassenger[];
  travelDate: string;
  onChange: (s: DemoPassenger[]) => void;
  onNext: () => void;
}) {
  const list = useListParams({ sort: { field: 'name', dir: 'asc' } });
  const rows = usePassengers(list.apiQuery);
  const options = useOptions();
  const ids = new Set(selected.map((p) => p.id));
  const blocked = selected.filter((p) => compliance(p, travelDate).blocked).length;
  const setFilter = (name: string, value: string | undefined) =>
    list.update({ filters: withFilter(list.params.filters, name, value) });
  const toggle = (p: DemoPassenger) =>
    onChange(ids.has(p.id) ? selected.filter((s) => s.id !== p.id) : [...selected, p]);
  const selectAll = async () => {
    const query = { ...list.apiQuery };
    delete query.page;
    delete query.pageSize;
    const everyone = await fetchAllPassengers(query);
    onChange([...selected, ...everyone.filter((p) => !ids.has(p.id))]);
  };

  const columns: Column<DemoPassenger>[] = [
    {
      id: 'pick',
      header: '',
      cell: (p) => (
        <input
          type="checkbox"
          className="size-4 accent-primary"
          aria-label={`Select ${p.name}`}
          checked={ids.has(p.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle(p)}
        />
      ),
    },
    {
      id: 'name',
      header: 'Passenger',
      sortField: 'name',
      cell: (p) => <PassengerCell p={p} sub={p.nationality} />,
    },
    {
      id: 'department',
      header: 'Department / Designation',
      sortField: 'department',
      cell: (p) => `${p.department} ${p.designation}`,
    },
    {
      id: 'optimaId',
      header: 'Optima ID',
      sortField: 'optimaId',
      cell: (p) => <span className="font-mono text-sm">{p.optimaId}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      sortField: 'category',
      cell: (p) => <StatusPill tone="neutral">{p.category}</StatusPill>,
    },
    { id: 'company', header: 'Company', sortField: 'company', cell: (p) => p.company },
    { id: 'rotation', header: 'Rotation', sortField: 'rotation', cell: (p) => p.rotation ?? '—' },
    {
      id: 'hseExpiry',
      header: 'HSE Expiry',
      sortField: 'hseExpiry',
      cell: (p) => (
        <span className={cn(p.hseExpiry < travelDate && 'font-medium text-danger-fg')}>
          {shortDate(p.hseExpiry)}
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Select Passengers</h2>
          <p className="text-sm text-ink-muted">
            Filter and select the crew/group travelling together.
          </p>
        </div>
        <Button onClick={onNext}>
          Next: Select Journey <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <FilterBar
        q={list.params.q}
        onQChange={(q) => list.update({ q })}
        placeholder="Search name, Optima ID, company…"
        activeCount={Object.keys(list.params.filters).length}
        onClear={() => list.update({ q: '', filters: {} })}
      >
        <FilterSelect
          label="Category"
          allLabel="All Categories"
          value={list.params.filters.category}
          options={(options.data?.categories ?? []).map((c) => ({ value: c, label: c }))}
          onChange={(v) => setFilter('category', v)}
        />
        <FilterSelect
          label="Company"
          allLabel="All Companies"
          value={list.params.filters.company}
          options={[...COMPANY_OPTIONS].sort((a, b) => a.label.localeCompare(b.label))}
          onChange={(v) => setFilter('company', v)}
        />
        <FilterSelect
          label="Gender"
          allLabel="All Genders"
          value={list.params.filters.gender}
          options={GENDERS}
          onChange={(v) => setFilter('gender', v)}
        />
        <Button variant="secondary" onClick={() => void selectAll()}>
          Select all ({rows.data?.total ?? 0})
        </Button>
        {selected.length > 0 && (
          <Button variant="ghost" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </FilterBar>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/40 bg-primary-subtle/40 px-4 py-3">
          <p className="font-semibold text-ink">{selected.length} passengers selected</p>
          <CategoryCounts people={selected} />
          {blocked > 0 && (
            <p className="text-sm font-semibold text-danger-fg">
              {blocked} blocked by an expired HSE Passport
            </p>
          )}
        </div>
      )}
      <DataTable
        caption="Passengers"
        columns={columns}
        rows={rows.data?.items}
        total={rows.data?.total}
        rowKey={(p) => p.id}
        params={list.params}
        onParamsChange={list.update}
        loading={rows.isFetching}
        onRowClick={toggle}
        emptyTitle="No passengers match these filters."
      />
    </section>
  );
}

function JourneyStep({
  group,
  today,
  date,
  onDate,
  reason,
  onReason,
  movement,
  onMovement,
  onBack,
  onNext,
}: {
  group: number;
  today: string;
  date: string;
  onDate: (d: string) => void;
  reason: string;
  onReason: (r: string) => void;
  movement: DayMovement | null;
  onMovement: (m: DayMovement) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const options = useOptions();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [adHoc, setAdHoc] = useState(false);
  const [requested, setRequested] = useState<DemoAdHocRequest | null>(null);
  const list = useLocalList();
  const mode = list.params.filters.mode;
  const movements = useMovements({ date, from, to, minSeats: group, ...list.apiQuery });
  const counts = movements.data?.modeCounts ?? {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const locations = options.data?.locations ?? [];

  const columns: Column<DayMovement>[] = [
    {
      id: 'pick',
      header: '',
      cell: (m) => (
        <input
          type="radio"
          name="movement"
          className="size-4 accent-primary"
          aria-label={`Select ${m.movementId}`}
          checked={movement?.id === m.id}
          onChange={() => onMovement(m)}
        />
      ),
    },
    {
      id: 'flightNo',
      header: 'Flight / Vessel',
      sortField: 'flightNo',
      cell: (m) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink">{m.movementId}</p>
          <p className="text-xs text-ink-muted">{m.aircraft}</p>
        </div>
      ),
    },
    {
      id: 'route',
      header: 'Route',
      cell: (m) => (
        <span>
          {m.stops.join(' → ')}
          {m.stops.length > 2 && (
            <StatusPill tone="info" className="ml-1.5">
              Multi-stop
            </StatusPill>
          )}
        </span>
      ),
    },
    { id: 'departure', header: 'Departure', sortField: 'departure', cell: (m) => m.departure },
    { id: 'arrival', header: 'Arrival', sortField: 'arrival', cell: (m) => m.arrival },
    {
      id: 'available',
      header: 'Available / Quota',
      sortField: 'available',
      cell: (m) => (
        <div>
          <p className="font-medium text-ink">
            {m.available} / {m.quota.reduce((a, b) => a + b, 0)}
          </p>
          <p className="text-xs text-ink-muted">
            {CATEGORIES.map((c, i) => `${m.left[i] ?? 0} ${SHORT[c]}`).join(' · ')} left
          </p>
        </div>
      ),
    },
    { id: 'cutoff', header: 'Cutoff', cell: (m) => m.cutoff },
    {
      id: 'status',
      header: 'Status',
      cell: (m) => (
        <StatusPill tone={m.status === 'Delayed' ? 'warning' : 'info'}>{m.status}</StatusPill>
      ),
    },
  ];

  const tabs = [['', 'All', allCount] as const, ...(options.data?.modes ?? []).map((m) => [m, m, counts[m] ?? 0] as const)];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Select Journey</h2>
          <p className="text-sm text-ink-muted">
            Pick a published movement with enough room for the group.
          </p>
        </div>
        <Button onClick={onNext}>
          Next: Review Manifest <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="grid items-end gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field
          label="Travel Date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => onDate(e.target.value)}
        />
        <SelectField
          label="From"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            list.update({});
          }}
        >
          <option value="">Any origin</option>
          {locations.map((l) => (
            <option key={l.code}>{l.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="To"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            list.update({});
          }}
        >
          <option value="">Any destination</option>
          {locations.map((l) => (
            <option key={l.code}>{l.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="Reason for Travel"
          required
          value={reason}
          onChange={(e) => onReason(e.target.value)}
        >
          <option value="">Select a reason…</option>
          {(options.data?.reasons ?? []).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectField>
      </div>
      <p className="text-xs text-ink-muted">
        Showing movements with ≥ {group} available seats
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Seats are committed on approval. Pending requests do not hold a seat.
        </p>
        <Button onClick={() => setAdHoc(true)}>Request Ad Hoc Movement</Button>
      </div>
      {requested && (
        <Banner tone="success" title={`Ad hoc movement requested — ${requested.reference}`}>
          {requested.from} → {requested.to} on {requested.travelDate} for {requested.passengers}{' '}
          passengers ({requested.mode}). Scheduling will publish it when approved.
        </Banner>
      )}
      <div role="tablist" aria-label="Mode" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(([value, label, n]) => {
          const active = (mode ?? '') === value;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() =>
                list.update({ filters: withFilter(list.params.filters, 'mode', value || undefined) })
              }
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink',
              )}
            >
              {label} <span className="text-ink-muted">{n}</span>
            </button>
          );
        })}
      </div>
      <DataTable
        caption="Published movements"
        columns={columns}
        rows={movements.data?.items}
        total={movements.data?.total}
        rowKey={(m) => m.id}
        params={list.params}
        onParamsChange={list.update}
        loading={movements.isFetching}
        onRowClick={onMovement}
        emptyTitle="No movements with enough seats. Request an ad hoc movement instead."
      />
      <Button variant="secondary" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Button>
      <AdHocModal
        open={adHoc}
        onOpenChange={setAdHoc}
        defaults={{ date, from, to, group, reason }}
        onDone={(r) => {
          setRequested(r);
          setAdHoc(false);
        }}
      />
    </section>
  );
}

const SHORT: Record<string, string> = {
  VIP: 'VIP',
  EP: 'E',
  'Direct Hire': 'DH',
  'Established Position': 'EP',
  Contractor: 'C',
  'Radar/NGCPA': 'R',
  Visitor: 'VIS',
  General: 'G',
};

function AdHocModal({
  open,
  onOpenChange,
  defaults,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults: { date: string; from: string; to: string; group: number; reason: string };
  onDone: (r: DemoAdHocRequest) => void;
}) {
  const options = useOptions();
  const [form, setForm] = useState({
    travelDate: defaults.date,
    from: defaults.from || 'Abu Dhabi',
    to: defaults.to,
    mode: '',
    passengers: String(defaults.group),
    reason: defaults.reason,
  });
  const save = useMutation({
    mutationFn: () => createAdHocRequest({ ...form, passengers: Number(form.passengers) }),
    onSuccess: onDone,
  });
  const errors = fieldErrors(save.error);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const locations = options.data?.locations ?? [];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Request Ad Hoc Movement"
      description="Ask Scheduling for an extra flight or vessel when no published movement fits the group."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field
          label="Travel Date"
          type="date"
          required
          value={form.travelDate}
          error={errors.travelDate}
          onChange={(e) => set({ travelDate: e.target.value })}
        />
        <Field
          label="Passengers"
          type="number"
          min={1}
          required
          value={form.passengers}
          error={errors.passengers}
          onChange={(e) => set({ passengers: e.target.value })}
        />
        <SelectField
          label="From"
          required
          value={form.from}
          error={errors.from}
          onChange={(e) => set({ from: e.target.value })}
        >
          <option value="">Select origin…</option>
          {locations.map((l) => (
            <option key={l.code}>{l.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="To"
          required
          value={form.to}
          error={errors.to}
          onChange={(e) => set({ to: e.target.value })}
        >
          <option value="">Select destination…</option>
          {locations.map((l) => (
            <option key={l.code}>{l.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="Mode"
          required
          value={form.mode}
          error={errors.mode}
          onChange={(e) => set({ mode: e.target.value })}
        >
          <option value="">Select mode…</option>
          {(options.data?.modes ?? []).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </SelectField>
        <SelectField
          label="Reason for Travel"
          required
          value={form.reason}
          error={errors.reason}
          onChange={(e) => set({ reason: e.target.value })}
        >
          <option value="">Select a reason…</option>
          {(options.data?.reasons ?? []).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectField>
        <ModalFooter className="sm:col-span-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Send Request
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function ReviewStep({
  people,
  movement,
  reason,
  codes,
  onCodes,
  onRemove,
  onBack,
  onDone,
}: {
  people: DemoPassenger[];
  movement: DayMovement;
  reason: string;
  codes: Record<string, string>;
  onCodes: (c: Record<string, string>) => void;
  onRemove: (ids: string[]) => void;
  onBack: () => void;
  onDone: (b: DemoBookingRequest[]) => void;
}) {
  const options = useOptions();
  const queryClient = useQueryClient();
  const list = useLocalList({ pageSize: 100 });
  const date = movement.travelDate;
  const blocked = people.filter((p) => compliance(p, date).blocked);
  const soon = people.filter((p) => {
    const c = compliance(p, date);
    return !c.blocked && c.soon;
  });
  const missing = people.filter((p) => !codes[p.id]).length;
  const capacity = movement.quota.reduce((a, b) => a + b, 0);
  const chargeCodes = options.data?.chargeCodes ?? [];
  const usedCodes = [...new Set(people.map((p) => codes[p.id]).filter(Boolean))];

  const submit = useMutation({
    mutationFn: () =>
      createBulkBooking({
        movementId: movement.movementId,
        reason,
        passengers: people.map((p) => ({ passengerId: p.id, chargeCode: codes[p.id] ?? '' })),
      }),
    onSuccess: async (r) => {
      onDone(r.items);
      await queryClient.invalidateQueries({ queryKey: bookingCreateKey });
    },
  });
  const fields = fieldErrors(submit.error);

  const sorted = useMemo(() => {
    const s = list.params.sort;
    if (!s) return people;
    const key = (p: DemoPassenger) => String(p[s.field as keyof DemoPassenger] ?? '');
    return [...people].sort((a, b) => (s.dir === 'asc' ? 1 : -1) * key(a).localeCompare(key(b)));
  }, [people, list.params.sort]);

  const columns: Column<DemoPassenger>[] = [
    { id: 'n', header: '#', cell: (p) => people.indexOf(p) + 1 },
    { id: 'name', header: 'Passenger', sortField: 'name', cell: (p) => <PassengerCell p={p} sub={p.optimaId} /> },
    {
      id: 'category',
      header: 'Category',
      sortField: 'category',
      cell: (p) => <StatusPill tone="neutral">{p.category}</StatusPill>,
    },
    { id: 'company', header: 'Company', sortField: 'company', cell: (p) => p.company },
    { id: 'seat', header: 'Seat', cell: (p) => people.indexOf(p) + 1 },
    {
      id: 'baggage',
      header: 'Baggage',
      cell: () => (movement.baggageKg === null ? '—' : `${movement.baggageKg} kg`),
    },
    {
      id: 'charge',
      header: 'Charge Code',
      cell: (p) => (
        <select
          aria-label={`Charge code for ${p.name}`}
          className={cn('min-h-touch px-2 py-1.5', CONTROL)}
          aria-invalid={!codes[p.id] ? true : undefined}
          value={codes[p.id] ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onCodes({ ...codes, [p.id]: e.target.value })}
        >
          <option value="">Choose a code…</option>
          {chargeCodes.map((c) => (
            <option key={c.code} value={c.code}>
              {chargeLabel(c)}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: 'hse',
      header: 'HSE Passport',
      sortField: 'hseExpiry',
      cell: (p) => (
        <span className={cn(compliance(p, date).blocked && 'font-medium text-danger-fg')}>
          {shortDate(p.hseExpiry)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <RowActions
          label={`Actions for ${p.name}`}
          items={[{ label: 'Remove from batch', run: () => onRemove([p.id]) }]}
        />
      ),
    },
  ];

  const canConfirm = people.length > 0 && blocked.length === 0 && missing === 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Review Manifest</h2>
        <Button onClick={() => submit.mutate()} disabled={!canConfirm || submit.isPending}>
          Confirm Bulk Booking ({people.length} pax)
        </Button>
      </div>
      {submit.isError && (
        <Banner tone="danger" title={submit.error.message}>
          {Object.values(fields).join(' ')}
        </Banner>
      )}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 xl:grid-cols-7">
        <Info label="Selected Flight / Vessel">
          <span className="font-mono">{movement.movementId}</span>
          <p className="text-xs font-normal text-ink-muted">{movement.aircraft}</p>
        </Info>
        <Info label="Route">{movement.stops.join(' → ')}</Info>
        <Info label="Departure / Arrival">
          <span className="font-mono">
            {movement.departure} – {movement.arrival}
          </span>
        </Info>
        <Info label="Travel Date">{date}</Info>
        <Info label="Reason">
          <StatusPill tone="info">{reason}</StatusPill>
        </Info>
        <Info label="Charge / Cost Code">
          {missing > 0 ? (
            <span className="text-warning-fg">{missing} without a charge code</span>
          ) : (
            <span className="font-mono">{usedCodes.join(', ')}</span>
          )}
        </Info>
        <Info label="Seats remaining after booking">
          {movement.available - people.length} / {capacity}
        </Info>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c, i) => {
          const quota = movement.quota[i] ?? 0;
          const adding = people.filter((p) => p.category === c).length;
          const allocated = quota - (movement.left[i] ?? 0) + adding;
          return (
            <div
              key={c}
              className={cn(
                'rounded-lg border bg-card p-3',
                allocated > quota ? 'border-danger-border' : 'border-border',
              )}
            >
              <p className="text-xs font-semibold text-ink-secondary">{c} Quota</p>
              <p className="text-sm text-ink">
                {allocated} / {quota} allocated
              </p>
              {adding > 0 && (
                <p className="text-xs font-semibold text-primary">+{adding} being added</p>
              )}
            </div>
          );
        })}
      </div>
      {blocked.length > 0 && (
        <Banner
          tone="danger"
          title={`${blocked.length} passengers cannot travel on this date`}
          action={
            <Button variant="secondary" onClick={() => onRemove(blocked.map((p) => p.id))}>
              Remove {blocked.length} blocked passengers from this batch
            </Button>
          }
        >
          HSE Passport expired for: {blocked.map((p) => p.name).join(', ')}. Remove them from the
          batch to continue.
        </Banner>
      )}
      {soon.length > 0 && (
        <Banner tone="warning">
          Certificates expiring soon — {soon.map((p) => p.name).join(', ')}. These do not block the
          booking.
        </Banner>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <label htmlFor="apply-code" className="text-sm font-semibold text-ink">
          Apply a charge code to all passengers
        </label>
        <select
          id="apply-code"
          className={cn('min-h-touch px-2.5 py-2', CONTROL)}
          value=""
          onChange={(e) =>
            e.target.value &&
            onCodes(Object.fromEntries(people.map((p) => [p.id, e.target.value])))
          }
        >
          <option value="">Choose a code…</option>
          {chargeCodes.map((c) => (
            <option key={c.code} value={c.code}>
              {chargeLabel(c)}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-muted">
          Codes for {movement.stops[0]}, the originating site.
        </span>
        {missing > 0 && (
          <span className="text-sm font-semibold text-warning-fg">
            {missing} without a charge code
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Passenger Manifest — {people.length} pax</h3>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> Print Manifest
        </Button>
      </div>
      <DataTable
        caption="Passenger manifest"
        columns={columns}
        rows={sorted}
        total={people.length}
        rowKey={(p) => p.id}
        params={list.params}
        onParamsChange={list.update}
        emptyTitle="No passengers left in this batch."
      />
      <Button variant="secondary" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Button>
    </section>
  );
}

function DoneStep({
  bookings,
  people,
  movement,
  onNew,
}: {
  bookings: DemoBookingRequest[];
  people: DemoPassenger[];
  movement: DayMovement;
  onNew: () => void;
}) {
  const codes = [...new Set(bookings.map((b) => b.chargeCode))].join(', ');
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <CircleCheckBig className="size-8 text-success-fg" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-ink">Bulk Booking Submitted</h2>
          <p className="text-sm text-ink-muted">
            {bookings.length} passengers requested on {movement.movementId} — {movement.travelDate}
          </p>
        </div>
      </div>
      <div className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-3 xl:grid-cols-6">
        <Info label="Flight / Vessel">{movement.movementId}</Info>
        <Info label="Route">{movement.stops.join(' → ')}</Info>
        <Info label="Departure">
          <span className="font-mono">{movement.departure}</span>
        </Info>
        <Info label="Passengers">
          <CategoryCounts people={people} />
        </Info>
        <Info label="Reason">{bookings[0]?.reason}</Info>
        <Info label="Charge Code">
          <span className="font-mono">{codes}</span>
        </Info>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-ink-muted">Booking references</p>
        <p className="font-mono text-sm text-ink">
          {bookings.map((b) => `${b.reference} (${b.passengerName})`).join(' · ')}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" asChild>
          <Link to={routeOf('booking.bookings')}>View in Bookings</Link>
        </Button>
        <Button onClick={onNew}>New Bulk Booking</Button>
      </div>
    </section>
  );
}
