import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CircleCheckBig } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import type { DemoBookingRequest, DemoPassenger } from '../../mock/data/demo-booking-create';
import { useListParams } from '../../shared/lists/list-params';
import { cn } from '../../shared/lib/cn';
import { ApprovalChain } from '../../shared/ui/approval-chain';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, SelectField, TextAreaField } from '../../shared/ui/field';
import { FilterBar } from '../../shared/ui/filter-bar';
import { FilterSelect } from '../../shared/ui/filter-select';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { Stepper } from '../../shared/ui/stepper';
import {
  type DayMovement,
  bookingCreateKey,
  createBooking,
  fieldErrors,
  useMovements,
  useOptions,
  usePassengers,
} from './api';
import { withFilter } from './local-list';
import {
  Avatar,
  CertDates,
  Info,
  PassengerCell,
  chargeLabel,
  compliance,
  longDate,
  shortDate,
} from './shared';
import { COMPANY_OPTIONS, GENDERS } from './options';

const STEPS = [
  { id: 'passenger', label: 'Passenger' },
  { id: 'journey', label: 'Journey' },
  { id: 'review', label: 'Review & Submit' },
];

interface Journey {
  date: string;
  from: string;
  to: string;
  mode: string;
  reason: string;
  chargeCode: string;
  movement: DayMovement | null;
}

/** Create Booking: one passenger, one published movement, review, then submit for approval. */
export default function CreateBookingPage() {
  const options = useOptions();
  const today = options.data?.today ?? '2026-10-07';
  const [step, setStep] = useState(0);
  const [passenger, setPassenger] = useState<DemoPassenger | null>(null);
  const [journey, setJourney] = useState<Journey>({
    date: '',
    from: 'Abu Dhabi',
    to: '',
    mode: '',
    reason: 'Duty',
    chargeCode: '',
    movement: null,
  });
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<DemoBookingRequest | null>(null);
  const travelDate = journey.date || today;

  const reset = () => {
    setStep(0);
    setPassenger(null);
    setJourney((j) => ({ ...j, to: '', mode: '', chargeCode: '', movement: null, date: '' }));
    setNotes('');
    setErrors({});
    setDone(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create Booking"
        subtitle="Book aviation or marine transportation for offshore travel"
      />
      {done && passenger ? (
        <DoneStep booking={done} passenger={passenger} onAnother={reset} />
      ) : (
        <>
          <Stepper steps={STEPS} current={step} />
          {step === 0 && (
            <PassengerStep
              selected={passenger}
              travelDate={travelDate}
              error={errors.passenger}
              onSelect={(p) => {
                setPassenger(p);
                setErrors({});
              }}
              onNext={() => {
                if (!passenger) setErrors({ passenger: 'Select a passenger to continue.' });
                else setStep(1);
              }}
            />
          )}
          {step === 1 && passenger && (
            <JourneyStep
              passenger={passenger}
              journey={journey}
              today={today}
              errors={errors}
              onChange={(patch) => {
                setJourney((j) => ({ ...j, ...patch }));
                setErrors({});
              }}
              onBack={() => setStep(0)}
              onNext={() => {
                const e: Record<string, string> = {};
                if (!journey.reason) e.reason = 'Reason for travel is required.';
                if (!journey.chargeCode) e.chargeCode = 'Charge / cost code is required.';
                if (travelDate < today) e.date = 'Choose today or a later date.';
                if (!journey.movement) e.movement = 'Select a movement to continue.';
                setErrors(e);
                if (Object.keys(e).length === 0) setStep(2);
              }}
            />
          )}
          {step === 2 && passenger && journey.movement && (
            <ReviewStep
              passenger={passenger}
              journey={journey}
              movement={journey.movement}
              notes={notes}
              onNotes={setNotes}
              onBack={() => setStep(1)}
              onEdit={setStep}
              onDone={setDone}
            />
          )}
        </>
      )}
    </div>
  );
}

function PassengerStep({
  selected,
  travelDate,
  error,
  onSelect,
  onNext,
}: {
  selected: DemoPassenger | null;
  travelDate: string;
  error: string | undefined;
  onSelect: (p: DemoPassenger) => void;
  onNext: () => void;
}) {
  const list = useListParams({ sort: { field: 'name', dir: 'asc' } });
  const rows = usePassengers(list.apiQuery);
  const options = useOptions();
  const setFilter = (name: string, value: string | undefined) =>
    list.update({ filters: withFilter(list.params.filters, name, value) });

  const columns: Column<DemoPassenger>[] = [
    { id: 'name', header: 'Passenger', sortField: 'name', cell: (p) => <PassengerCell p={p} /> },
    {
      id: 'department',
      header: 'Department / Designation',
      sortField: 'department',
      cell: (p) => (
        <span>
          {p.department} <span className="text-ink-muted">{p.designation}</span>
        </span>
      ),
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
    {
      id: 'select',
      header: '',
      align: 'right',
      cell: (p) =>
        selected?.id === p.id ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success-fg">
            <Check className="size-4" aria-hidden /> Selected
          </span>
        ) : (
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p);
            }}
          >
            Select
          </Button>
        ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Select Passenger</h2>
          <p className="text-sm text-ink-muted">
            Choose who you are booking for. Filter by category, company or gender.
          </p>
        </div>
        <Button onClick={onNext}>
          Next: Journey Details <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}
      {selected && <SelectedPassenger p={selected} travelDate={travelDate} />}
      <FilterBar
        q={list.params.q}
        onQChange={(q) => list.update({ q })}
        placeholder="Search name, Optima ID, company..."
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
          allLabel="All"
          value={list.params.filters.company}
          options={COMPANY_OPTIONS}
          onChange={(v) => setFilter('company', v)}
        />
        <FilterSelect
          label="Gender"
          allLabel="All Genders"
          value={list.params.filters.gender}
          options={GENDERS}
          onChange={(v) => setFilter('gender', v)}
        />
      </FilterBar>
      <DataTable
        caption="Passengers"
        columns={columns}
        rows={rows.data?.items}
        total={rows.data?.total}
        rowKey={(p) => p.id}
        params={list.params}
        onParamsChange={list.update}
        loading={rows.isFetching}
        onRowClick={onSelect}
        emptyTitle="No passengers match these filters."
      />
    </section>
  );
}

function SelectedPassenger({ p, travelDate }: { p: DemoPassenger; travelDate: string }) {
  const c = compliance(p, travelDate);
  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-primary-subtle/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <PassengerCell
          p={p}
          sub={`${p.optimaId} · ${p.company} · ${p.department} · ${p.designation}`}
        />
        <StatusPill tone="success">Clear</StatusPill>
      </div>
      <p className="text-xs text-ink-secondary">
        Training Compliance via Optima as of {longDate(travelDate)}
      </p>
      <CertDates p={p} travelDate={travelDate} />
      {c.blocked && (
        <Banner tone="danger">
          HSE Passport has expired for this travel date — this passenger cannot be booked.
        </Banner>
      )}
    </div>
  );
}

function JourneyStep({
  passenger,
  journey,
  today,
  errors,
  onChange,
  onBack,
  onNext,
}: {
  passenger: DemoPassenger;
  journey: Journey;
  today: string;
  errors: Record<string, string>;
  onChange: (patch: Partial<Journey>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const options = useOptions();
  const date = journey.date || today;
  const movements = useMovements({
    date,
    from: journey.from,
    to: journey.to,
    'filter[mode]': journey.mode,
    pageSize: 100,
  });
  const c = compliance(passenger, date);
  const locations = options.data?.locations ?? [];
  const origin = journey.movement?.stops[0] ?? (journey.from || 'Abu Dhabi');
  const items = movements.data?.items ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Journey Details</h2>
          <p className="text-sm text-ink-muted">
            Pick a published movement from Scheduling. Routes with connections are shown as
            authored.
          </p>
        </div>
        <Button onClick={onNext} disabled={c.blocked}>
          Next: Review <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="grid gap-4 rounded-lg border border-border bg-surface-muted p-4 sm:grid-cols-2">
        <SelectField
          label="Reason for Travel"
          required
          value={journey.reason}
          error={errors.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
        >
          <option value="">Select a reason…</option>
          {(options.data?.reasons ?? []).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectField>
        <div className="space-y-1">
          <SelectField
            label="Charge / Cost Code"
            required
            value={journey.chargeCode}
            error={errors.chargeCode}
            onChange={(e) => onChange({ chargeCode: e.target.value })}
          >
            <option value="">Select a charge code…</option>
            {(options.data?.chargeCodes ?? []).map((cc) => (
              <option key={cc.code} value={cc.code}>
                {chargeLabel(cc)}
              </option>
            ))}
          </SelectField>
          <p className="text-xs text-ink-muted">Codes for {origin}, the originating site.</p>
        </div>
      </div>
      <p className="text-sm text-ink-secondary">
        Bookings for this service close at 14:00 GST on the day of travel.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <Field
            label="Travel Date"
            type="date"
            min={today}
            value={date}
            error={errors.date}
            onChange={(e) => onChange({ date: e.target.value, movement: null })}
          />
          {date === today && (
            <p className="text-xs text-warning-fg">
              Today’s cut-off has passed — the earliest bookable date is tomorrow.
            </p>
          )}
        </div>
        <SelectField
          label="From"
          value={journey.from}
          onChange={(e) =>
            onChange({
              from: e.target.value,
              to: e.target.value === journey.to ? '' : journey.to,
              movement: null,
            })
          }
        >
          <option value="">Any origin</option>
          {locations.map((l) => (
            <option key={l.code}>{l.name}</option>
          ))}
        </SelectField>
        <SelectField
          label="To"
          value={journey.to}
          onChange={(e) => onChange({ to: e.target.value, movement: null })}
        >
          <option value="">Any destination</option>
          {locations
            .filter((l) => l.name !== journey.from)
            .map((l) => (
              <option key={l.code}>{l.name}</option>
            ))}
        </SelectField>
        <SelectField
          label="Mode"
          value={journey.mode}
          onChange={(e) => onChange({ mode: e.target.value, movement: null })}
        >
          <option value="">All modes</option>
          {(options.data?.modes ?? []).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </SelectField>
      </div>
      <p className="text-xs text-ink-muted">
        Seats are committed on approval. Pending requests do not hold a seat.
      </p>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-muted">
          {items.length} movements available — click to select
        </p>
        {errors.movement && (
          <p role="alert" className="text-xs text-danger-fg">
            {errors.movement}
          </p>
        )}
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map((m) => {
            const active = journey.movement?.id === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ movement: m })}
                className={cn(
                  'flex items-center gap-4 rounded-lg border bg-card px-4 py-3 text-start transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary',
                  active ? 'border-primary bg-primary-subtle' : 'border-border',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold text-ink">{m.flightNo}</p>
                  <p className="text-xs text-ink-muted">
                    {m.stops.join(' → ')}
                    {m.stops.length > 2 && ' · multi-stop'}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{m.aircraft}</p>
                  <p className="text-xs text-ink-muted">
                    {m.departure} → {m.arrival} · {m.quota.reduce((a, b) => a + b, 0)}-seat
                  </p>
                </div>
                <div className="text-end text-sm">
                  <p className="text-ink">{m.available} seats free</p>
                  {m.status === 'Delayed' && <StatusPill tone="warning">Delayed</StatusPill>}
                </div>
                {active && <CircleCheckBig className="size-5 text-primary" aria-hidden />}
              </button>
            );
          })}
        </div>
        {items.length === 0 && !movements.isFetching && (
          <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-ink-muted">
            No published movements match this route and mode.
          </p>
        )}
      </div>
      <div className="space-y-3">
        {journey.movement && (
          <p className="text-sm text-ink">
            {journey.movement.baggageKg === null
              ? `Baggage allowance: not recorded in Fleet Master (${journey.movement.aircraft})`
              : `Baggage allowance: ${journey.movement.baggageKg} kg — per Fleet Master (${journey.movement.aircraft})`}
          </p>
        )}
        <Banner tone={c.blocked ? 'danger' : c.soon || c.trainingExpired ? 'warning' : 'success'}>
          <p className="font-medium">
            {c.blocked
              ? `HSE Passport has expired as of ${longDate(date)} — this booking cannot proceed.`
              : c.soon
                ? `Certificates valid for ${longDate(date)}, but at least one expires soon.`
                : `All certificates valid for ${longDate(date)}.`}
          </p>
          {c.trainingExpired && (
            <p className="text-xs">
              T-BOSIT / T-HUET have expired. These are recorded but do not block a booking.
            </p>
          )}
          <div className="mt-1">
            <CertDates p={passenger} travelDate={date} />
          </div>
        </Banner>
      </div>
      <Button variant="secondary" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Button>
    </section>
  );
}

function ReviewStep({
  passenger,
  journey,
  movement,
  notes,
  onNotes,
  onBack,
  onEdit,
  onDone,
}: {
  passenger: DemoPassenger;
  journey: Journey;
  movement: DayMovement;
  notes: string;
  onNotes: (v: string) => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  onDone: (b: DemoBookingRequest) => void;
}) {
  const options = useOptions();
  const queryClient = useQueryClient();
  const charge = options.data?.chargeCodes.find((c) => c.code === journey.chargeCode);
  const submit = useMutation({
    mutationFn: () =>
      createBooking({
        passengerId: passenger.id,
        movementId: movement.movementId,
        reason: journey.reason,
        chargeCode: journey.chargeCode,
        specialRequirements: notes,
      }),
    onSuccess: async (b) => {
      onDone(b);
      await queryClient.invalidateQueries({ queryKey: bookingCreateKey });
    },
  });
  const fields = fieldErrors(submit.error);

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Review & Submit</h2>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          Submit Booking Request
        </Button>
      </div>
      {submit.isError && (
        <Banner tone="danger" title={submit.error.message}>
          {Object.values(fields).join(' ') || 'Check the details and try again.'}
        </Banner>
      )}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar name={passenger.name} />
          <div>
            <p className="font-semibold text-ink">{passenger.name}</p>
            <p className="text-xs text-ink-muted">
              {passenger.optimaId} · {passenger.company} · {passenger.category} ·{' '}
              {passenger.department}
            </p>
          </div>
        </div>
        <Button variant="link" onClick={() => onEdit(0)}>
          Change
        </Button>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-secondary">Journey</h3>
          <Button variant="link" onClick={() => onEdit(1)}>
            Change
          </Button>
        </div>
        <p className="font-semibold text-ink">
          {movement.stops.join(' → ')} · {movement.mode}
        </p>
        <p className="text-xs text-ink-muted">
          {movement.movementId} · {movement.aircraft} · Departs {movement.departure} → Arrives{' '}
          {movement.arrival}
        </p>
        <p className="text-xs text-ink-muted">
          {movement.travelDate} · Baggage allowance:{' '}
          {movement.baggageKg === null ? 'not recorded' : `${movement.baggageKg} kg`}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Reason">
          <StatusPill tone="info">{journey.reason}</StatusPill>
        </Info>
        <Info label="Charge">
          {charge ? `${charge.code} ${charge.description}` : journey.chargeCode}
        </Info>
        <Info label="Originating site">{movement.stops[0]}</Info>
        <Info label="Will be">
          <StatusPill tone="warning">Pending approval</StatusPill>
        </Info>
      </div>
      <TextAreaField
        label="Special Requirements (optional)"
        placeholder="e.g., heavy equipment, medical requirements, urgent travel..."
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
      />
      <Banner tone="info">
        After submission your request follows the applicable approval workflow, then the Aviation
        Team assigns your seat and issues a boarding pass.
      </Banner>
      <Button variant="secondary" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Button>
    </section>
  );
}

function DoneStep({
  booking,
  passenger,
  onAnother,
}: {
  booking: DemoBookingRequest;
  passenger: DemoPassenger;
  onAnother: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6 text-center">
      <CircleCheckBig className="mx-auto size-10 text-success-fg" aria-hidden />
      <div>
        <h2 className="text-lg font-semibold text-ink">Booking Submitted!</h2>
        <p className="text-sm text-ink-muted">
          Your travel request is now moving through approval.
        </p>
      </div>
      <p className="font-mono text-xl font-semibold text-ink">{booking.reference}</p>
      <div className="space-y-1 rounded-lg bg-surface-muted p-4 text-start">
        <p className="text-xs font-semibold text-ink-muted">Travel Summary</p>
        <p className="text-ink">{booking.route}</p>
        <p className="text-xs text-ink-muted">
          Travel date: {booking.travelDate} · Passenger: {passenger.name}
        </p>
      </div>
      <div className="space-y-2 text-start">
        <p className="text-xs font-semibold text-ink-muted">Approval Chain</p>
        <p className="text-xs text-ink-muted">Standard Booking Approval</p>
        <ApprovalChain
          stages={[
            { id: 'submitted', name: 'Submitted', status: 'approved' },
            { id: 'line-manager', name: 'Line Manager', status: 'pending' },
            { id: 'aviation', name: 'Aviation Team', status: 'waiting' },
          ]}
        />
      </div>
      <div className="flex justify-center gap-2">
        <Button asChild>
          <Link to={routeOf('booking.bookings')}>View Bookings</Link>
        </Button>
        <Button variant="secondary" onClick={onAnother}>
          Create Another
        </Button>
      </div>
    </section>
  );
}
