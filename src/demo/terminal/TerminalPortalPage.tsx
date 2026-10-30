import { ArrowLeft, ArrowRight, CreditCard, type LucideIcon, ScanLine, Tv } from 'lucide-react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { formatGstLongDay, gstDayKey } from '../../shared/time/format';
import { BrandLogo } from '../../shared/ui/brand-logo';

const TILES: readonly {
  key: Parameters<typeof routeOf>[0];
  icon: LucideIcon;
  title: string;
  body: string;
  bg: string;
}[] = [
  {
    key: 'terminal.kiosk',
    icon: ScanLine,
    title: 'Kiosk Check-In',
    body: 'Passenger self-service check-in via QR code or Optima ID',
    bg: 'from-brand-medium-blue to-brand-dark-blue',
  },
  {
    key: 'terminal.fids',
    icon: Tv,
    title: 'Flight Info Display',
    body: 'Real-time departure board for the terminal and helipad displays (FIDS)',
    bg: 'from-brand-medium-teal to-brand-dark-teal',
  },
  {
    key: 'terminal.boarding-pass',
    icon: CreditCard,
    title: 'Boarding Pass',
    body: 'Print or display boarding pass for departing passengers',
    bg: 'from-brand-medium-green to-brand-dark-green',
  },
];

/** Terminal: the departure lounge's dedicated screens, launched from here. */
export default function TerminalPortalPage() {
  return (
    <div className="-m-8 flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,var(--color-brand-medium-blue)_0%,var(--color-kiosk-background)_55%)] text-base">
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div className="flex items-center gap-3">
          <BrandLogo on="dark" shape="portrait" className="h-10" />
          <div>
            <p className="text-sm font-semibold">ADNOC Offshore</p>
            <p className="text-2xs tracking-widest text-white/50 uppercase">
              Terminal · Departure Lounge
            </p>
          </div>
        </div>
        <Link
          to={routeOf('dispatch.dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to Dispatch
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-white p-2 shadow-overlay">
          <BrandLogo shape="portrait" className="h-11" />
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Terminal</h1>
        <p className="mt-3 max-w-md text-sm text-white/60">
          Dedicated terminal interfaces for the departure lounge. Select one to launch.
        </p>
        <div className="mt-12 grid w-full max-w-4xl gap-5 sm:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.key}
              to={routeOf(t.key)}
              className={`group flex flex-col rounded-2xl bg-gradient-to-br ${t.bg} p-7 text-start shadow-overlay ring-1 ring-white/10 transition-all hover:-translate-y-1 hover:ring-white/30 focus-visible:outline-2 focus-visible:outline-white`}
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-white/15">
                <t.icon className="size-6" aria-hidden />
              </span>
              <span className="mt-6 text-xl font-semibold">{t.title}</span>
              <span className="mt-2 flex-1 text-sm text-white/70">{t.body}</span>
              <span className="mt-6 inline-flex items-center gap-1 text-xs text-white/60 transition-colors group-hover:text-white">
                Tap to launch
                <ArrowRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-white/40">
        ADNOC Offshore LMS · Dispatch Module · {formatGstLongDay(gstDayKey(new Date()))}
      </p>
    </div>
  );
}
