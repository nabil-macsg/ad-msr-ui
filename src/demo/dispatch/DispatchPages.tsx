import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Package } from 'lucide-react';
import type { DemoRow } from '../../mock/data/modules';
import { Button } from '../../shared/ui/button';
import { datasetKey, updateRow, useDataset } from '../demo-api';
import { DeparturePicker, GONE, num, str, waitingBadge } from './DeparturePicker';

const HUBS = ['Abu Dhabi', 'Das Island', 'Zirku Island'];

export function ManifestConfirmationPage() {
  return (
    <DeparturePicker
      title="Manifest Confirmation"
      subtitle="Settle who is on a departure, seat them, and confirm it to everyone on the list"
      hint="Pick the departure whose manifest you are settling."
      note="A departure that has already gone can be opened, but its manifest is settled — work it on Flight Dispatch."
      badge={waitingBadge}
      actions={(d) => [
        {
          label: 'Confirm manifest',
          patch: { status: 'Closed for Boarding' },
          disabled: GONE.includes(str(d.status)),
        },
      ]}
    />
  );
}

export function QuickAddPage() {
  return (
    <DeparturePicker
      title="Quick Add"
      subtitle="Fill a departure's spare seats from the waiting list and from other journeys the same day"
      hint="Pick the departure with seats to fill."
      note="Only departures that can still take somebody are listed — once boarding is closed the manifest is fixed, and once a journey has gone there is nothing to move anybody onto."
      include={(d) =>
        ['Scheduled', 'Check-in open', 'Boarding', 'Delayed'].includes(str(d.status)) &&
        num(d.booked) < num(d.capacity)
      }
      badge={waitingBadge}
      actions={(d) => [
        {
          label: 'Add one from the waiting list',
          patch: { booked: num(d.booked) + 1, waiting: Math.max(0, num(d.waiting) - 1) },
          disabled: num(d.waiting) === 0 || num(d.booked) >= num(d.capacity),
        },
        {
          label: 'Add a passenger',
          variant: 'secondary',
          patch: { booked: num(d.booked) + 1 },
          disabled: num(d.booked) >= num(d.capacity),
        },
      ]}
    />
  );
}

export function FlightDispatchPage() {
  return (
    <DeparturePicker
      title="Flight Dispatch"
      subtitle="Work a departure on the day — check-in, offload, payload and crew handover"
      hint="Pick the departure you are working."
      badge={waitingBadge}
      actions={(d) => [
        {
          label: 'Check everyone in',
          patch: { checkedIn: num(d.booked) },
          disabled: num(d.checkedIn) >= num(d.booked),
        },
        {
          label: 'Close for dispatch',
          variant: 'secondary',
          patch: { status: 'Closed for Dispatch' },
          disabled: GONE.includes(str(d.status)),
        },
      ]}
    />
  );
}

export function StatusUpdatePage() {
  return (
    <DeparturePicker
      title="Status Update"
      subtitle="Final times, closure, delays and cancellations — the record of what actually ran"
      hint="Pick the journey you are reporting on."
      badge={waitingBadge}
      actions={(d) =>
        (['Departed', 'Arrived', 'Delayed', 'Cancelled'] as const).map((status) => ({
          label: status === 'Cancelled' ? 'Cancel' : `Mark ${status.toLowerCase()}`,
          variant: status === 'Departed' ? ('primary' as const) : ('secondary' as const),
          patch: { status },
          disabled: d.status === status,
        }))
      }
    />
  );
}

/** Cargo Transfer's panel: the payload left, and consignments that can go on this departure. */
function FreightToLoad({ d, refresh }: { d: DemoRow; refresh: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const freight =
    useDataset('freight', { page: 1, pageSize: 100, sort: 'note:asc' }).data?.items ?? [];
  const limit = num(d.payloadLimit);
  const left = limit ? limit - num(d.payloadKg) : null;
  const open = freight.filter((f) => !f.loadedOn && f.receivedAt === null);
  const load = async (f: DemoRow) => {
    await updateRow('freight', f.id, { loadedOn: str(d.flightNumber) });
    await updateRow('departures', d.id, { payloadKg: num(d.payloadKg) + num(f.weightKg) });
    await queryClient.invalidateQueries({ queryKey: datasetKey('freight') });
    await refresh();
  };
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
        Freight to load
        {left !== null && (
          <span className="ms-2 normal-case tracking-normal text-ink-secondary">
            · {left.toLocaleString('en')} kg payload left
          </span>
        )}
      </h3>
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {open.map((f) => {
          const fits = left === null || num(f.weightKg) <= left;
          return (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <Package className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {str(f.cargo)}{' '}
                  <span className="font-mono text-xs text-ink-muted">{str(f.note)}</span>
                </p>
                <p className="text-xs text-ink-muted">
                  {num(f.weightKg).toLocaleString('en')} kg · to {str(f.destination)}
                </p>
              </div>
              <Button variant="secondary" disabled={!fits} onClick={() => void load(f)}>
                {fits ? 'Load' : 'Too heavy'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CargoTransferPage() {
  return (
    <DeparturePicker
      title="Cargo Transfer"
      subtitle="Assign freight to a departure against the payload it has left"
      hint="Pick the departure you are loading."
      note="Only departures that have not gone are listed — cargo cannot be loaded onto a journey that has left or been cancelled."
      include={(d) => !GONE.includes(str(d.status))}
      actions={() => []}
      extra={(d, refresh) => <FreightToLoad d={d} refresh={refresh} />}
    />
  );
}

export function HubArrivalsPage() {
  return (
    <DeparturePicker
      title="HUB Arrivals"
      subtitle="Check passengers in off an inbound flight and put them on their onward transport"
      hint="Pick the inbound flight you are receiving."
      note="Only journeys that have landed at a hub are listed — nobody is taken on anywhere until the aircraft is down."
      include={(d) =>
        ['Arrived', 'Closed for Dispatch'].includes(str(d.status)) && HUBS.includes(str(d.to))
      }
      seats={(d) => `${str(d.booked)} aboard`}
      badge={(d) =>
        num(d.booked) > 0 && num(d.checkedIn) < num(d.booked) ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning-fg">
            <MapPin className="size-3" aria-hidden />
            {num(d.checkedIn)} of {num(d.booked)} checked in
          </span>
        ) : null
      }
      actions={(d) => [
        {
          label: 'Check everyone in for onward travel',
          patch: { checkedIn: num(d.booked) },
          disabled: num(d.checkedIn) >= num(d.booked),
        },
      ]}
    />
  );
}
