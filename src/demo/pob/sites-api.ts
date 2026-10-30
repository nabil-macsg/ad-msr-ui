import type { PobPerson, PobSiteStats } from '../../mock/data/demo-pob-sites';
import type { Tone } from '../../shared/ui/tone';
import { usePobQuery } from './pob-api';

export type { PobPerson, PobSiteStats };

export interface PobDashboard {
  total: number;
  matching: number;
  inScope: number;
  arrivedToday: number;
  departedToday: number;
  mix: { residents: number; contractors: number; visitors: number };
  hseExpired: number;
  hseExpiring: number;
  essential: number;
  nationalities: string[];
  zones: { code: string; name: string; pob: number; sites: PobSiteStats[] }[];
}

export type PobSiteDetail = PobSiteStats & { companies: string[] };

export const useSites = () => usePobQuery<PobSiteStats[]>('/sites');

export const utilisation = (s: { pob: number; limit: number }) =>
  s.limit > 0 ? Math.round((s.pob / s.limit) * 100) : 0;

/** The map legend's bands: under 70%, 70–90%, over 90% of the POB limit. */
export const capacityTone = (pct: number): Tone =>
  pct > 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';

export const statusTone = (status: string): Tone =>
  status === 'Alert' ? 'warning' : status === 'Critical' ? 'danger' : 'success';


/** "28 Sep 2026" from an ISO date. */
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
