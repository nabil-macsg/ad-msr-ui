import { Anchor, Helicopter, Plane } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import type { DemoRow } from '../../mock/data/modules';
import { BrandLogo } from '../../shared/ui/brand-logo';
import { Button } from '../../shared/ui/button';
import { buttonVariants } from '../../shared/ui/button-variants';
import { CONTROL } from '../../shared/ui/control-styles';
import { useDataset } from '../demo-api';
import { str } from '../dispatch/DeparturePicker';

const MODE_ICON: Readonly<Record<string, typeof Plane>> = {
  'Fixed Wing': Plane,
  'Rotary Wing': Helicopter,
  'Vessel / Boat': Anchor,
};
const SIZE = 25;

/** A QR-style code drawn from the booking reference: three finder squares and a seeded pattern. */
function QrCode({ value }: { value: string }) {
  let seed = 7;
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  const next = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed % 100;
  };
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= SIZE - 7 && y < 7) || (x < 7 && y >= SIZE - 7);
  const cells: [number, number][] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) if (!finder(x, y) && next() < 48) cells.push([x, y]);
  const eye = (x: number, y: number) => (
    <g key={`${String(x)}-${String(y)}`}>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  );
  return (
    <svg
      viewBox={`-1 -1 ${String(SIZE + 2)} ${String(SIZE + 2)}`}
      className="size-36 text-ink"
      role="img"
      aria-label={`Code for ${value}`}
    >
      <rect x={-1} y={-1} width={SIZE + 2} height={SIZE + 2} fill="white" />
      {cells.map(([x, y]) => (
        <rect
          key={`${String(x)}-${String(y)}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill="currentColor"
        />
      ))}
      {eye(0, 0)}
      {eye(SIZE - 7, 0)}
      {eye(0, SIZE - 7)}
    </svg>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-2xs tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={strong ? 'text-xl font-bold text-primary' : 'text-sm font-semibold text-ink'}>
        {value}
      </p>
    </div>
  );
}

/** Boarding Pass: one passenger's pass for a departure, ready to print or show. */
export default function BoardingPassPage() {
  const bookings =
    useDataset('bookings', { page: 1, pageSize: 500, sort: 'reference:asc' }).data?.items.filter(
      (b) => b.status === 'Confirmed' || b.status === 'Checked in',
    ) ?? [];
  const people = useDataset('passengers', { page: 1, pageSize: 500 }).data?.items ?? [];
  const departures = useDataset('departures', { page: 1, pageSize: 500 }).data?.items ?? [];
  const [ref, setRef] = useState('');
  const b: DemoRow | undefined = bookings.find((x) => x.reference === ref) ?? bookings[0];
  if (!b) return <p className="p-8 text-ink-muted">Loading…</p>;

  const person = people.find((p) => p.name === b.passenger);
  const [from = '', to = ''] = [str(b.route).split(' → ')[0], str(b.route).split(' → ').at(-1)];
  const leg =
    departures.find((d) => d.from === from && d.to === to) ??
    departures.find((d) => d.mode === b.mode);
  const Icon = MODE_ICON[str(b.mode)] ?? Plane;
  const departs = str(b.departs);
  const date = new Date(`${str(b.serviceDate)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const fixedWing = b.mode === 'Fixed Wing';

  return (
    <div className="-m-8 flex min-h-screen flex-col items-center gap-5 bg-canvas px-4 py-10 print:m-0 print:bg-white print:p-0">
      <label className="w-full max-w-md text-xs font-medium text-ink-secondary print:hidden">
        Passenger
        <select
          className={`${CONTROL} mt-1.5 min-h-touch w-full px-3`}
          value={str(b.reference)}
          onChange={(e) => setRef(e.target.value)}
        >
          {bookings.map((x) => (
            <option key={x.id} value={str(x.reference)}>
              {str(x.passenger)} · {str(x.reference)}
            </option>
          ))}
        </select>
      </label>

      <article className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-overlay print:shadow-none">
        <header className="flex items-center justify-between bg-primary px-6 py-4 text-on-primary">
          <span className="flex items-center gap-2.5">
            <BrandLogo on="dark" shape="portrait" className="h-7" />
            <span className="text-sm font-semibold tracking-wide">ADNOC OFFSHORE</span>
          </span>
          <span className="text-xs tracking-widest uppercase opacity-80">Boarding Pass</span>
        </header>
        <div className="space-y-5 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink">{str(b.passenger)}</h1>
              <p className="text-xs text-ink-secondary">
                {str(person?.optima)} · {str(b.company)}
              </p>
            </div>
            <div className="text-end">
              <p className="text-2xs tracking-wider text-ink-muted uppercase">
                {fixedWing ? 'Flight' : 'Voyage'}
              </p>
              <p className="font-mono text-2xl font-bold text-primary">
                {str(leg?.flightNumber) || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-2xs tracking-wider text-ink-muted uppercase">From</p>
              <p className="font-semibold text-ink">{from}</p>
              <p className="font-mono text-xs text-ink-muted">{departs}</p>
            </div>
            <div className="flex flex-1 flex-col items-center text-primary">
              <span className="flex w-full items-center gap-2">
                <span className="h-px flex-1 border-t border-dashed border-border-strong/40" />
                <Icon className="size-5" aria-hidden />
                <span className="h-px flex-1 border-t border-dashed border-border-strong/40" />
              </span>
              <span className="mt-1 text-2xs text-ink-muted">{str(b.mode)}</span>
            </div>
            <div className="text-end">
              <p className="text-2xs tracking-wider text-ink-muted uppercase">To</p>
              <p className="font-semibold text-ink">{to}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 border-t border-dashed border-border pt-4">
            <Item label="Date" value={date} />
            <Item label="Departure" value={departs} />
            <Item label="Gate" value={fixedWing ? 'A2' : '—'} />
            <Item
              label="Seat"
              value={fixedWing ? `${String(3 + (str(b.reference).length % 9))}C` : 'Open'}
              strong
            />
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-dashed border-border pt-4">
            <Item label="Aircraft" value={str(leg?.fleetType) || '—'} />
            <Item label="Bags" value="2 (14 kg)" />
            <Item label="Allowance" value={fixedWing ? '23 kg' : '30 kg'} />
          </div>
        </div>
        {/* The tear line, as on a printed card. */}
        <div className="relative border-t-2 border-dashed border-border">
          <span className="absolute -start-3 -top-3 size-6 rounded-full bg-canvas print:hidden" />
          <span className="absolute -end-3 -top-3 size-6 rounded-full bg-canvas print:hidden" />
        </div>
        <div className="flex flex-col items-center gap-2 px-6 py-5">
          <QrCode value={str(b.reference)} />
          <p className="font-mono text-xs tracking-wider text-ink-muted">{str(b.reference)}</p>
        </div>
      </article>

      <div className="grid w-full max-w-md grid-cols-2 gap-3 print:hidden">
        <Link
          to={routeOf('terminal.kiosk-portal')}
          className={buttonVariants({ variant: 'secondary' })}
        >
          Back to Terminal
        </Link>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
    </div>
  );
}
