import { useQueryClient } from '@tanstack/react-query';
import { Ambulance, Plus } from 'lucide-react';
import { useState } from 'react';
import { CONTROL as BASE } from '../../shared/ui/control-styles';
import { gstDayKey } from '../../shared/time/format';
import { buttonVariants } from '../../shared/ui/button-variants';
import { Button } from '../../shared/ui/button';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { createRow, datasetKey, useDataset } from '../demo-api';
import { str } from './DeparturePicker';

const CONTROL = `${BASE} min-h-touch w-full px-3`;

const LABEL = 'space-y-1.5 text-sm font-medium text-ink-secondary';
const Req = () => <span className="text-danger-fg"> *</span>;
const EMPTY = {
  patient: '',
  from: '',
  to: '',
  date: '',
  departs: '',
  arrives: '',
  aircraft: '',
  notes: '',
};

function NewHemsFlight({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const people =
    useDataset('passengers', { page: 1, pageSize: 500, sort: 'name:asc' }).data?.items ?? [];
  const departures = useDataset('departures', { page: 1, pageSize: 500 }).data?.items ?? [];
  const places = [...new Set(departures.flatMap((d) => [str(d.from), str(d.to)]))].sort();
  const aircraft = [
    ...new Map(
      departures
        .filter((d) => d.mode === 'Rotary Wing')
        .map((d) => [str(d.fleet), `${str(d.fleet)} · ${str(d.fleetType)}`]),
    ),
  ];
  const [form, setForm] = useState({ ...EMPTY, date: gstDayKey(new Date()) });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const ready =
    people.some((p) => p.name === form.patient) &&
    form.from &&
    form.to &&
    form.from !== form.to &&
    form.date &&
    form.departs &&
    form.arrives;

  const raise = async () => {
    setBusy(true);
    try {
      await createRow('hems', {
        ref: `HEMS-${String(Date.now()).slice(-5)}`,
        patient: form.patient,
        from: form.from,
        to: form.to,
        date: form.date,
        departs: form.departs,
        arrives: form.arrives,
        aircraft: form.aircraft || 'To be assigned',
        notes: form.notes,
        status: 'Raised',
      });
      await queryClient.invalidateQueries({ queryKey: datasetKey('hems') });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="New HEMS flight" size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void raise();
        }}
      >
        <label className={`${LABEL} block`}>
          <span>
            Patient
            <Req />
          </span>
          <input
            list="hems-patients"
            value={form.patient}
            onChange={set('patient')}
            placeholder="Search and select the patient…"
            className={`${CONTROL} border-dashed`}
          />
          <datalist id="hems-patients">
            {people.map((p) => (
              <option key={p.id} value={str(p.name)}>
                {str(p.optima)} · {str(p.employer)}
              </option>
            ))}
          </datalist>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['from', 'to'] as const).map((k) => (
            <label key={k} className={LABEL}>
              <span>
                {k === 'from' ? 'From' : 'To'}
                <Req />
              </span>
              <select value={form[k]} onChange={set(k)} className={CONTROL}>
                <option value="">— Select —</option>
                {places.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={LABEL}>
            <span>
              Date
              <Req />
            </span>
            <input type="date" value={form.date} onChange={set('date')} className={CONTROL} />
          </label>
          <label className={LABEL}>
            <span>
              Departure
              <Req />
            </span>
            <input type="time" value={form.departs} onChange={set('departs')} className={CONTROL} />
          </label>
          <label className={LABEL}>
            <span>
              Arrival
              <Req />
            </span>
            <input type="time" value={form.arrives} onChange={set('arrives')} className={CONTROL} />
          </label>
        </div>
        <label className={`${LABEL} block`}>
          <span>Aircraft</span>
          <select value={form.aircraft} onChange={set('aircraft')} className={CONTROL}>
            <option value="">— Select an aircraft —</option>
            {aircraft.map(([reg, label]) => (
              <option key={reg} value={reg}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={`${LABEL} block`}>
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Optional — clinical or operational notes"
            className={`${CONTROL} py-2`}
          />
        </label>
        <p className="flex items-center gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg">
          <Ambulance className="size-4 shrink-0" aria-hidden />A HEMS flight is not published to the
          schedule and cannot be booked onto.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready || busy}>
            <Ambulance className="size-4" aria-hidden />
            Raise HEMS flight
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** HEMS Flights: medical evacuation flights, raised outside the published schedule. */
export default function HemsFlightsPage() {
  const [creating, setCreating] = useState(false);
  const flights = useDataset('hems', { page: 1, pageSize: 100 }).data?.items ?? [];
  return (
    <div className="space-y-5">
      <PageHeader
        title="HEMS Flights"
        subtitle="Medical evacuation flights — raised on demand, never published for booking"
        actions={
          <button
            type="button"
            className={buttonVariants({ variant: 'primary' })}
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" aria-hidden />
            New HEMS flight
          </button>
        }
      />
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {flights.length === 0 ? (
          <EmptyState
            icon={<Ambulance className="size-6" aria-hidden />}
            title="No HEMS flights today"
            body="Raise one when a medical evacuation is called."
          />
        ) : (
          <ul className="divide-y divide-border">
            {[...flights].reverse().map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5">
                <span className="font-mono text-sm font-bold text-ink">{str(f.ref)}</span>
                <span className="font-mono text-sm text-ink-muted">
                  {str(f.departs)}–{str(f.arrives)}
                </span>
                <Ambulance className="size-4 text-danger-fg" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  <span className="font-medium">{str(f.patient)}</span>
                  <span className="text-ink-muted">
                    {' '}
                    · {str(f.from)} → {str(f.to)}
                  </span>
                </span>
                <span className="text-xs text-ink-secondary">{str(f.aircraft)}</span>
                <StatusPill tone="danger">{str(f.status)}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </section>
      {creating && <NewHemsFlight onClose={() => setCreating(false)} />}
    </div>
  );
}
