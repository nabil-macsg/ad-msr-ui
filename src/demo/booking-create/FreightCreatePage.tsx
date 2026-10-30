import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { routeOf } from '../../app/access/registry';
import {
  CARGO_TYPES,
  PRIORITIES,
  TRANSPORT_MODES,
  type DemoPassenger,
} from '../../mock/data/demo-booking-create';
import { cn } from '../../shared/lib/cn';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { type Column, DataTable } from '../../shared/ui/data-table';
import { Field, Input, SelectField, TextAreaField } from '../../shared/ui/field';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { bookingCreateKey, createFreight, fieldErrors, useOptions, usePassengers } from './api';
import { useLocalList } from './local-list';
import { Avatar, PRIORITY_TONE, chargeLabel } from './shared';

interface Form {
  cargoType: string;
  weightKg: string;
  dimensions: [string, string, string];
  hazmat: boolean;
  unNumber: string;
  notes: string;
  origin: string;
  destination: string;
  requestedDate: string;
  priority: string;
  transportMode: string;
  chargeCode: string;
}

/** What still blocks the request, in the original's wording. */
function missing(form: Form, person: DemoPassenger | null): string[] {
  const out: string[] = [];
  if (!person) out.push('A responsible person is required');
  if (!form.cargoType) out.push('Cargo type is required');
  if (!(Number(form.weightKg) > 0)) out.push('Valid weight is required');
  if (form.origin === form.destination) out.push('Origin and destination must differ');
  if (!form.requestedDate) out.push('Requested date is required');
  if (!form.transportMode) out.push('Select a transport mode');
  if (!form.chargeCode) out.push('Cost object / WBS is required');
  return out;
}

const card = 'space-y-4 rounded-xl border border-border bg-card p-5';

/** Create Freight Booking: cargo, route, transport mode, responsible person and cost object. */
export default function FreightCreatePage() {
  const options = useOptions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>({
    cargoType: '',
    weightKg: '',
    dimensions: ['', '', ''],
    hazmat: false,
    unNumber: '',
    notes: '',
    origin: 'Abu Dhabi',
    destination: 'Das Island',
    requestedDate: '2026-10-06',
    priority: 'Normal',
    transportMode: '',
    chargeCode: '',
  });
  const [person, setPerson] = useState<DemoPassenger | null>(null);
  const [picking, setPicking] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const locations = options.data?.locations ?? [];
  const code = (name: string) => locations.find((l) => l.name === name)?.code ?? name;
  const blockers = missing(form, person);

  const submit = useMutation({
    mutationFn: () =>
      createFreight({
        ...form,
        weightKg: Number(form.weightKg),
        dimensions: form.dimensions.map(Number),
        recordedAgainst: person?.id ?? '',
      }),
    onSuccess: async (f) => {
      await queryClient.invalidateQueries({ queryKey: bookingCreateKey });
      void navigate(routeOf('freight.requests'), { state: { created: f.reference } });
    },
  });
  const errors = fieldErrors(submit.error);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create Freight Booking"
        subtitle="Request cargo and goods transport to offshore installations"
        actions={
          <Button variant="secondary" asChild>
            <Link to={routeOf('freight.requests')}>
              <ArrowLeft className="size-4" aria-hidden /> Back to Requests
            </Link>
          </Button>
        }
      />
      {submit.isError && (
        <Banner tone="danger" title={submit.error.message}>
          {Object.values(errors).join(' · ')}
        </Banner>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className={card}>
            <h2 className="text-base font-semibold text-ink">Cargo Information</h2>
            <SelectField
              label="Cargo Type"
              required
              value={form.cargoType}
              error={errors.cargoType}
              onChange={(e) =>
                set({
                  cargoType: e.target.value,
                  hazmat: form.hazmat || e.target.value === 'HAZMAT',
                })
              }
            >
              <option value="">— Select type —</option>
              {CARGO_TYPES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <Field
              label="Weight (kg)"
              type="number"
              min={0}
              required
              placeholder="e.g. 250"
              value={form.weightKg}
              error={errors.weightKg}
              onChange={(e) => set({ weightKg: e.target.value })}
            />
            <fieldset className="space-y-1.5">
              <legend className="text-label text-ink-secondary">Dimensions (cm) — L × W × H</legend>
              <div className="flex items-center gap-2">
                {(['Length', 'Width', 'Height'] as const).map((label, i) => (
                  <div key={label} className="flex flex-1 items-center gap-2">
                    {i > 0 && <span className="text-ink-muted">×</span>}
                    <Input
                      type="number"
                      min={0}
                      aria-label={label}
                      placeholder={label}
                      value={form.dimensions[i]}
                      onChange={(e) => {
                        const d: Form['dimensions'] = [...form.dimensions];
                        d[i] = e.target.value;
                        set({ dimensions: d });
                      }}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={form.hazmat}
                onChange={(e) => set({ hazmat: e.target.checked })}
              />
              <span>
                <span className="font-medium">Dangerous Goods / HAZMAT</span>
                <span className="block text-xs text-ink-muted">Requires special handling</span>
              </span>
            </label>
            {form.hazmat && (
              <Field
                label="UN Number / Class"
                placeholder="e.g. 1791 · 8 – Corrosives"
                value={form.unNumber}
                onChange={(e) => set({ unNumber: e.target.value })}
              />
            )}
            <TextAreaField
              label="Notes / Special Instructions"
              placeholder="Fragile, keep upright, temperature sensitive, etc."
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </section>
          <section className={card}>
            <h2 className="text-base font-semibold text-ink">Route & Schedule</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Origin"
                required
                value={form.origin}
                error={errors.origin}
                onChange={(e) => set({ origin: e.target.value })}
              >
                {locations.map((l) => (
                  <option key={l.code}>{l.name}</option>
                ))}
              </SelectField>
              <SelectField
                label="Destination"
                required
                value={form.destination}
                error={
                  errors.destination ??
                  (form.origin === form.destination
                    ? 'Choose a destination other than the origin.'
                    : undefined)
                }
                onChange={(e) => set({ destination: e.target.value })}
              >
                {locations
                  .filter((l) => l.name !== 'Abu Dhabi')
                  .map((l) => (
                    <option key={l.code}>{l.name}</option>
                  ))}
              </SelectField>
              <Field
                label="Requested Date"
                type="date"
                required
                value={form.requestedDate}
                error={errors.requestedDate}
                onChange={(e) => set({ requestedDate: e.target.value })}
              />
              <fieldset className="space-y-1.5">
                <legend className="text-label text-ink-secondary after:ms-0.5 after:text-danger-fg after:content-['*']">
                  Priority
                </legend>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <Button
                      key={p}
                      variant={form.priority === p ? 'primary' : 'secondary'}
                      aria-pressed={form.priority === p}
                      onClick={() => set({ priority: p })}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
          <section className={card}>
            <h2 className="text-base font-semibold text-ink after:ms-0.5 after:text-danger-fg after:content-['*']">
              Transport Mode
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {TRANSPORT_MODES.map((m) => {
                const active = form.transportMode === m.name;
                return (
                  <button
                    key={m.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ transportMode: m.name })}
                    className={cn(
                      'rounded-lg border p-4 text-start transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary',
                      active ? 'border-primary bg-primary-subtle' : 'border-border bg-card',
                    )}
                  >
                    <p className="font-semibold text-ink">{m.name}</p>
                    <p className="text-xs text-ink-muted">{m.hint}</p>
                  </button>
                );
              })}
            </div>
            {errors.transportMode && (
              <p role="alert" className="text-xs text-danger-fg">
                {errors.transportMode}
              </p>
            )}
          </section>
        </div>
        <div className="space-y-5">
          <section className={card}>
            <h2 className="text-base font-semibold text-ink">Responsible Person</h2>
            <p className="text-label text-ink-secondary after:ms-0.5 after:text-danger-fg after:content-['*']">
              Recorded Against
            </p>
            {person ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={person.name} />
                  <div>
                    <p className="text-sm font-medium text-ink">{person.name}</p>
                    <p className="text-xs text-ink-muted">
                      {person.optimaId} · {person.company}
                    </p>
                  </div>
                </div>
                <Button variant="link" onClick={() => setPicking(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Button variant="secondary" block onClick={() => setPicking(true)}>
                <Search className="size-4" aria-hidden /> Search and select a person…
              </Button>
            )}
            <p className="text-xs text-ink-muted">
              The person responsible for this cargo. They are not required to travel with it.
            </p>
          </section>
          <section className={card}>
            <h2 className="text-base font-semibold text-ink">Cost & Billing</h2>
            <SelectField
              label="Cost Object (WBS / CC)"
              required
              value={form.chargeCode}
              error={errors.chargeCode}
              onChange={(e) => set({ chargeCode: e.target.value })}
            >
              <option value="">Select a charge code…</option>
              {(options.data?.chargeCodes ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {chargeLabel(c)}
                </option>
              ))}
            </SelectField>
            <p className="text-xs text-ink-muted">Codes for {form.origin}, the originating site.</p>
          </section>
          <section className="space-y-2 rounded-xl border border-border bg-surface-muted p-5 text-sm">
            <h2 className="font-semibold text-ink">Booking Summary</h2>
            {[
              ['Cargo Type', form.cargoType || 'Not set'],
              ['Weight', Number(form.weightKg) > 0 ? `${form.weightKg} kg` : 'Not set'],
              ['Route', `${code(form.origin)} → ${code(form.destination)}`],
              ['Transport Mode', form.transportMode || 'Not set'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-ink-muted">{k}</span>
                <span className="text-end text-ink">{v}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-ink-muted">Priority</span>
              <StatusPill tone={PRIORITY_TONE[form.priority] ?? 'neutral'}>
                {form.priority}
              </StatusPill>
            </div>
          </section>
          <Button
            block
            disabled={blockers.length > 0 || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit Freight Booking
          </Button>
          {blockers.length > 0 && (
            <ul className="space-y-1 text-xs text-danger-fg">
              {blockers.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <PersonPicker
        open={picking}
        onOpenChange={setPicking}
        current={person}
        onPick={(p) => {
          setPerson(p);
          setPicking(false);
        }}
      />
    </div>
  );
}

function PersonPicker({
  open,
  onOpenChange,
  current,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: DemoPassenger | null;
  onPick: (p: DemoPassenger) => void;
}) {
  const list = useLocalList({ pageSize: 20, sort: { field: 'name', dir: 'asc' } });
  const rows = usePassengers(list.apiQuery, open);
  const [chosen, setChosen] = useState<DemoPassenger | null>(current);
  const columns: Column<DemoPassenger>[] = [
    {
      id: 'pick',
      header: '',
      cell: (p) => (
        <input
          type="radio"
          name="person"
          className="size-4 accent-primary"
          aria-label={`Choose ${p.name}`}
          checked={chosen?.id === p.id}
          onChange={() => setChosen(p)}
        />
      ),
    },
    {
      id: 'name',
      header: 'Person',
      sortField: 'name',
      cell: (p) => (
        <div>
          <p className="font-medium text-ink">{p.name}</p>
          <p className="font-mono text-xs text-ink-muted">{p.optimaId}</p>
        </div>
      ),
    },
    { id: 'department', header: 'Department', sortField: 'department', cell: (p) => p.department },
    {
      id: 'designation',
      header: 'Designation',
      sortField: 'designation',
      cell: (p) => p.designation,
    },
    {
      id: 'company',
      header: 'Company',
      sortField: 'company',
      cell: (p) => (
        <div>
          <p>{p.company}</p>
          <p className="text-xs text-ink-muted">{p.category}</p>
        </div>
      ),
    },
  ];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Who is this cargo recorded against?"
      size="lg"
    >
      <div className="space-y-3">
        <Input
          type="search"
          aria-label="Search people"
          placeholder="Search by name, ID, department, designation or company…"
          value={list.params.q}
          onChange={(e) => list.update({ q: e.target.value })}
        />
        <DataTable
          caption="People"
          columns={columns}
          rows={rows.data?.items}
          total={rows.data?.total}
          rowKey={(p) => p.id}
          params={list.params}
          onParamsChange={list.update}
          loading={rows.isFetching}
          onRowClick={setChosen}
          emptyTitle="No one matches this search."
        />
      </div>
      <ModalFooter className="justify-between">
        <span className="text-xs text-ink-muted">
          {chosen ? `Selected: ${chosen.name}` : 'No one selected yet'}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
            Use this person
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
