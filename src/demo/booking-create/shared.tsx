import type { DemoPassenger } from '../../mock/data/demo-booking-create';
import { StatusPill } from '../../shared/ui/status-pill';
import type { Tone } from '../../shared/ui/tone';
import { TONE_TEXT } from '../../shared/ui/tone';
import { cn } from '../../shared/lib/cn';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** `20 Oct 26`, as the original's tables show certificate dates. */
export const shortDate = (iso: string) =>
  day(iso).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });

/** `7 Oct 2026`. */
export const longDate = (iso: string) =>
  day(iso).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const SOON_DAYS = 30;
const daysBetween = (from: string, to: string) =>
  Math.round((day(to).getTime() - day(from).getTime()) / 86_400_000);

export type CertState = 'valid' | 'soon' | 'expired';
export function certState(expiry: string, travelDate: string): CertState {
  if (expiry < travelDate) return 'expired';
  return daysBetween(travelDate, expiry) <= SOON_DAYS ? 'soon' : 'valid';
}
const CERT_TONE: Record<CertState, Tone> = { valid: 'success', soon: 'warning', expired: 'danger' };

export interface Compliance {
  /** An expired HSE Passport blocks the booking. */
  blocked: boolean;
  /** T-BOSIT / T-HUET expired: recorded, not blocking. */
  trainingExpired: boolean;
  soon: boolean;
}

export function compliance(p: DemoPassenger, travelDate: string): Compliance {
  const states = [p.hseExpiry, p.securityExpiry, p.bositExpiry, p.huetExpiry].map((d) =>
    certState(d, travelDate),
  );
  return {
    blocked: states[0] === 'expired',
    trainingExpired: states[2] === 'expired' || states[3] === 'expired',
    soon: states.includes('soon'),
  };
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join('');

export function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary-subtle text-xs font-semibold text-primary"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Avatar, name, VIP marker and the second line the original shows. */
export function PassengerCell({ p, sub }: { p: DemoPassenger; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={p.name} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium text-ink">
          {p.name}
          {p.vip && <StatusPill tone="accent">VIP</StatusPill>}
        </p>
        <p className="text-xs text-ink-muted">{sub ?? `${p.nationality} · ${p.gender}`}</p>
      </div>
    </div>
  );
}

/** HSE / Security / T-BOSIT / T-HUET dates, coloured by state on the travel date. */
export function CertDates({ p, travelDate }: { p: DemoPassenger; travelDate: string }) {
  const certs = [
    ['HSE', 'HSE Passport', p.hseExpiry],
    ['Security', 'Security', p.securityExpiry],
    ['T-BOSIT', 'T-BOSIT', p.bositExpiry],
    ['T-HUET', 'T-HUET', p.huetExpiry],
  ] as const;
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {certs.map(([key, label, date]) => (
        <div key={key} className="flex gap-1">
          <dt className="text-ink-muted">{label}:</dt>
          <dd className={cn('font-medium', TONE_TEXT[CERT_TONE[certState(date, travelDate)]])}>
            {shortDate(date)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const PRIORITY_TONE: Record<string, Tone> = {
  Normal: 'neutral',
  Urgent: 'warning',
  Critical: 'danger',
};

/** A small labelled value for summary cards. */
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

export const chargeLabel = (c: { code: string; description: string }) =>
  `${c.code} — ${c.description}`;
