import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { GstClock } from '../../app/layouts/layouts';
import { cn } from '../../shared/lib/cn';
import { BrandLogo } from '../../shared/ui/brand-logo';
import { useDataset } from '../demo-api';
import { num, str } from '../dispatch/DeparturePicker';

/** Board colours: the airport convention of a dark board with coloured status chips. */
const STATUS_CHIP: Readonly<Record<string, string>> = {
  Arrived: 'bg-brand-medium-blue/25 text-brand-bright-blue',
  Departed: 'bg-brand-medium-blue/25 text-brand-bright-blue',
  Boarding: 'bg-brand-medium-green/25 text-brand-bright-green',
  'Check-in open': 'bg-brand-medium-green/25 text-brand-bright-green',
  'Closed for Boarding': 'bg-brand-medium-teal/25 text-brand-bright-teal',
  'Closed for Dispatch': 'bg-white/10 text-white/70',
  Scheduled: 'bg-white/10 text-white/80',
  Delayed: 'bg-brand-medium-orange/25 text-brand-bright-yellow',
  Cancelled: 'bg-brand-medium-red/25 text-brand-bright-red',
};
const TH =
  'px-4 py-3 text-start text-xs font-semibold tracking-widest text-fids-highlight uppercase';
/** A delayed departure's new time: half an hour to two hours later. */
const estimate = (time: string, i: number) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = h * 60 + m + 30 + (i % 4) * 30;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** FIDS: the terminal's departures and arrivals board. */
export default function FidsPage() {
  const [board, setBoard] = useState<'departures' | 'arrivals'>('departures');
  const rows =
    useDataset('departures', { page: 1, pageSize: 500, sort: 'departure:asc' }).data?.items ?? [];
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-6 border-b border-white/10 px-8 py-5">
        <BrandLogo on="dark" shape="portrait" className="h-10" />
        <div className="me-auto">
          <p className="text-xl font-semibold tracking-wide uppercase">
            ADNOC Offshore — Flight Information
          </p>
          <p className="text-xs text-white/50">Abu Dhabi Offshore Airport</p>
        </div>
        <div className="flex rounded-lg bg-white/10 p-1" role="group" aria-label="Board">
          {(['departures', 'arrivals'] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={board === b}
              onClick={() => setBoard(b)}
              className="rounded-md px-4 py-1.5 text-sm font-medium text-white/60 capitalize transition-colors hover:text-white aria-pressed:bg-primary aria-pressed:text-white"
            >
              {b}
            </button>
          ))}
        </div>
        <div className="text-end">
          <GstClock className="block font-mono text-3xl font-bold text-white tabular-nums" />
          <p className="text-xs text-white/50">{today}</p>
        </div>
        <Link
          to={routeOf('terminal.kiosk-portal')}
          aria-label="Back to Terminal"
          className="text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
      </header>

      <div className="flex-1 overflow-x-auto px-8 py-6">
        <table className="w-full min-w-[56rem]">
          <caption className="sr-only">
            {board === 'departures' ? 'Departures' : 'Arrivals'}
          </caption>
          <thead>
            <tr className="border-b border-white/10">
              {[
                'Flight / Voyage',
                board === 'departures' ? 'Destination' : 'Origin',
                'Aircraft',
                'Scheduled',
                'Estimated',
                'Status',
                'Gate',
              ].map((h) => (
                <th key={h} scope="col" className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => {
              const status = str(d.status);
              const delayed = status === 'Delayed';
              const fixedWing = d.mode === 'Fixed Wing';
              return (
                <tr key={d.id} className="border-b border-white/5 odd:bg-fids-row-alt">
                  <td className="px-4 py-4 font-mono text-lg font-bold">{str(d.flightNumber)}</td>
                  <td className="px-4 py-4 text-lg">
                    {str(board === 'departures' ? d.to : d.from)}
                  </td>
                  <td className="px-4 py-4 text-white/60">{str(d.fleetType)}</td>
                  <td className="px-4 py-4 font-mono text-lg">{str(d.departure)}</td>
                  <td
                    className={cn(
                      'px-4 py-4 font-mono text-lg',
                      delayed ? 'font-semibold text-fids-highlight' : 'text-white/40',
                    )}
                  >
                    {delayed ? estimate(str(d.departure), i) : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase',
                        STATUS_CHIP[status] ?? 'bg-white/10 text-white/80',
                      )}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-lg">
                    {fixedWing ? `A${String(1 + ((num(d.capacity) + i) % 6))}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
