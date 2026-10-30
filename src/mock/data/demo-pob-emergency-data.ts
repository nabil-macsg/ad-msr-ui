import lifeboatSeeds from './seeds/lifeboats.json';
import locationSeeds from './seeds/locations.json';
import musterPointSeeds from './seeds/muster-points.json';
import passengerSeeds from './seeds/passengers.json';

/**
 * Demo pob, emergency screens: who is on each offshore site (the original demo's evacuation
 * report and asset figures), with names, muster points and lifeboats from the shared seeds so
 * they match the Locations, Muster Points and Lifeboats masters.
 */
export type Region = 'Das Region' | 'Zakum Region' | 'Umm Shaif Region' | 'Other Region';

export interface SiteFigures {
  readonly code: string;
  readonly region: Region;
  /** On the deck (counted in a muster). */
  readonly onSite: number;
  /** Aboard vessels attached to the site (not expected at a muster). */
  readonly aboardVessels: number;
  readonly residents: number;
  readonly contractors: number;
  readonly visitors: number;
  readonly male: number;
  readonly female: number;
  readonly status: 'Normal' | 'Alert' | 'Emergency';
}

const fig = (
  code: string,
  region: Region,
  onSite: number,
  aboardVessels: number,
  [residents, contractors, visitors]: [number, number, number],
  [male, female]: [number, number],
  status: SiteFigures['status'] = 'Normal',
): SiteFigures => ({
  code,
  region,
  onSite,
  aboardVessels,
  residents,
  contractors,
  visitors,
  male,
  female,
  status,
});

/** In the original's order (Emergency Muster's location list and the report's regions). */
export const SITE_FIGURES: readonly SiteFigures[] = [
  fig('DAS', 'Das Region', 208, 10, [108, 98, 12], [205, 13]),
  fig('ZRK', 'Das Region', 141, 11, [64, 81, 7], [138, 14]),
  fig('UZ', 'Zakum Region', 115, 6, [63, 51, 7], [107, 14], 'Alert'),
  fig('LZ', 'Zakum Region', 70, 6, [34, 37, 5], [71, 5]),
  fig('US', 'Umm Shaif Region', 90, 8, [52, 41, 5], [91, 7]),
  fig('ACPT', 'Zakum Region', 41, 0, [16, 24, 1], [37, 4]),
  fig('NASR', 'Umm Shaif Region', 48, 0, [21, 25, 2], [46, 2]),
  fig('ABK', 'Das Region', 29, 0, [14, 14, 1], [28, 1]),
  fig('ZRK-Z1', 'Das Region', 18, 0, [9, 8, 1], [17, 1]),
  fig('ZRK-Z2', 'Das Region', 14, 0, [6, 8, 0], [12, 2]),
  fig('BHS', 'Other Region', 47, 0, [26, 20, 1], [44, 3]),
  fig('GHF', 'Other Region', 132, 0, [49, 78, 5], [123, 9]),
  fig('HAIL', 'Other Region', 24, 0, [16, 8, 0], [23, 1]),
  fig('UAS', 'Other Region', 8, 0, [5, 3, 0], [7, 1]),
  fig('BLB', 'Other Region', 11, 0, [6, 5, 0], [11, 0]),
  fig('STH', 'Other Region', 17, 0, [7, 10, 0], [15, 2]),
  fig('SRB', 'Other Region', 29, 0, [15, 14, 0], [25, 4]),
  fig('UAD', 'Other Region', 41, 0, [14, 21, 6], [38, 3]),
  fig('CSM', 'Other Region', 6, 0, [4, 2, 0], [5, 1]),
];

export const REGIONS: readonly Region[] = [
  'Das Region',
  'Zakum Region',
  'Umm Shaif Region',
  'Other Region',
];

/** The original's fleet-wide evacuation categories (sampled personnel). */
export const EVACUATION_CATEGORIES = [
  { code: 'T1', label: 'T1 - Essential Ops', count: 451, tone: 'danger' },
  { code: 'T2', label: 'T2 - Non-Essential', count: 468, tone: 'warning' },
  { code: 'T3', label: 'T3 - Visitor / Temp', count: 170, tone: 'info' },
  { code: 'T4', label: 'T4 - Medical', count: 41, tone: 'accent' },
] as const;

interface LocationSeed {
  code: string;
  name: string;
  type: string;
  pobLimit?: number;
}
const LOCATIONS = new Map((locationSeeds as LocationSeed[]).map((l) => [l.code, l]));

export const siteName = (code: string): string => LOCATIONS.get(code)?.name ?? code;
export const siteType = (code: string): string =>
  (LOCATIONS.get(code)?.type ?? 'FIELD').toLowerCase();

export interface MusterPointRef {
  readonly code: string;
  readonly name: string;
  readonly capacity: number | null;
}
export const musterPointsOf = (code: string): MusterPointRef[] =>
  musterPointSeeds
    .filter((m) => m.location === code)
    .map((m) => ({ code: m.code, name: m.name, capacity: m.capacity ?? null }));

export interface LifeboatCover {
  /** Seats in boats in service. */
  readonly capacity: number;
  readonly boats: number;
  /** Boats out of service (held back). */
  readonly heldBack: number;
}
/** Lifeboat seats in service at a site, or null when it has no lifeboats recorded. */
export function lifeboatsOf(code: string): LifeboatCover | null {
  const boats = lifeboatSeeds.filter((b) => b.location === code);
  if (boats.length === 0) return null;
  const inService = boats.filter((b) => !('outOfService' in b && b.outOfService));
  return {
    capacity: inService.reduce((total, b) => total + b.ratedCapacity, 0),
    boats: boats.length,
    heldBack: boats.length - inService.length,
  };
}

export type PersonGroup = 'Resident' | 'Contractor' | 'Visitor';
export interface SitePerson {
  readonly id: string;
  readonly name: string;
  readonly personnelNo: string;
  readonly company: string;
  readonly group: PersonGroup;
  readonly gender: 'M' | 'F';
  /** The muster point the person is assigned to. */
  readonly homePoint: string;
  readonly homePointName: string;
}

const FIRST: string[] = [];
const LAST: string[] = [];
for (const p of passengerSeeds) {
  const [first, ...rest] = p.name.split(' ');
  if (first && !FIRST.includes(first)) FIRST.push(first);
  const last = rest.join(' ');
  if (last && !LAST.includes(last)) LAST.push(last);
}
const CONTRACTORS = [
  'Gulf Offshore Engineering LLC',
  'Gulf Deck Services LLC',
  'ADNOC Marine Logistics',
];
const VISITOR_COMPANIES = ['Abu Dhabi Aviation', 'Falcon Aviation'];

/** The people on a site's deck, generated the same way every time from the seed names. */
export function peopleOnSite(code: string): SitePerson[] {
  const site = SITE_FIGURES.find((s) => s.code === code);
  if (!site) return [];
  const points = musterPointsOf(code);
  const salt = SITE_FIGURES.indexOf(site) * 13;
  const used = new Set<string>();
  const people: SitePerson[] = [];
  const residents = Math.round((site.residents * site.onSite) / (site.onSite + site.aboardVessels));
  const visitors = Math.round((site.visitors * site.onSite) / (site.onSite + site.aboardVessels));
  const femaleEvery = site.female === 0 ? 0 : Math.max(2, Math.floor(site.onSite / site.female));
  for (let i = 0; people.length < site.onSite; i += 1) {
    const name = `${FIRST[(i * 7 + salt) % FIRST.length] ?? 'Ali'} ${
      LAST[(i * 11 + salt + Math.floor(i / LAST.length)) % LAST.length] ?? 'Al Hammadi'
    }`;
    if (used.has(name)) continue;
    used.add(name);
    const n = people.length;
    const group: PersonGroup =
      n < residents ? 'Resident' : n < site.onSite - visitors ? 'Contractor' : 'Visitor';
    const company =
      group === 'Resident'
        ? 'ADNOC Offshore'
        : group === 'Contractor'
          ? (CONTRACTORS[n % CONTRACTORS.length] ?? 'Gulf Deck Services LLC')
          : (VISITOR_COMPANIES[n % VISITOR_COMPANIES.length] ?? 'Falcon Aviation');
    const point = points.length > 0 ? points[n % points.length] : undefined;
    people.push({
      id: `${code}-${String(n + 1).padStart(4, '0')}`,
      name,
      personnelNo: `${group === 'Resident' ? 'DH' : group === 'Contractor' ? 'CT' : 'VS'}-${String(
        31000 + salt * 10 + n,
      )}`,
      company,
      group,
      gender: femaleEvery > 0 && n % femaleEvery === femaleEvery - 1 ? 'F' : 'M',
      homePoint: point?.code ?? '',
      homePointName: point?.name ?? 'Not assigned',
    });
  }
  return people;
}
