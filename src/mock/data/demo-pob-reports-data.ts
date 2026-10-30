import companySeeds from './seeds/companies.json';
import locationSeeds from './seeds/locations.json';
import zoneSeeds from './seeds/zones.json';

/**
 * Demo pob reports: the people on board on the report date and their stays, generated once from
 * the original demo's per-site headcounts (POB, afloat, male/female, T1–T4) so every report
 * (Normal / Emergency POB, Residence Duration, Report Builder runs) adds up the same way.
 * Site names and zones come from the Locations master seed.
 */

/** The reports' "as at" date, as in the original demo. */
export const REPORT_DATE = '2026-10-06';

export const EVAC_CATEGORIES = [
  'T1 - Essential Ops',
  'T2 - Non-Essential',
  'T3 - Visitor / Temp',
  'T4 - Medical',
] as const;
export const CREW_TYPES = ['Resident', 'Contractor', 'Visitor'] as const;

/** Per-site headcounts from the original's Normal / Emergency POB report. */
const SITE_COUNTS: readonly [
  code: string,
  pob: number,
  afloat: number,
  female: number,
  t: number[],
][] = [
  ['DAS', 218, 10, 13, [64, 104, 41, 9]],
  ['ZRK', 152, 11, 14, [57, 62, 27, 6]],
  ['UZ', 121, 6, 14, [55, 49, 12, 5]],
  ['LZ', 76, 6, 5, [26, 38, 10, 2]],
  ['US', 98, 8, 7, [41, 43, 10, 4]],
  ['ACPT', 41, 0, 4, [17, 17, 6, 1]],
  ['NASR', 48, 0, 2, [19, 17, 9, 3]],
  ['ABK', 29, 0, 1, [11, 12, 6, 0]],
  ['ZRK-Z1', 18, 0, 1, [10, 3, 5, 0]],
  ['ZRK-Z2', 14, 0, 2, [6, 5, 3, 0]],
  ['BHS', 47, 0, 3, [17, 21, 6, 3]],
  ['GHF', 132, 0, 9, [63, 48, 16, 5]],
  ['HAIL', 24, 0, 1, [13, 10, 1, 0]],
  ['UAS', 8, 0, 1, [4, 2, 2, 0]],
  ['BLB', 11, 0, 0, [5, 4, 2, 0]],
  ['STH', 17, 0, 2, [9, 5, 1, 2]],
  ['SRB', 29, 0, 4, [11, 12, 6, 0]],
  ['UAD', 41, 0, 3, [18, 16, 6, 1]],
  ['CSM', 6, 0, 1, [5, 0, 1, 0]],
];

const zoneName = new Map(zoneSeeds.map((z) => [z.code, z.name]));
const locationByCode = new Map(locationSeeds.map((l) => [l.code, l]));

export interface ReportSite {
  code: string;
  name: string;
  zone: string;
  pobLimit: number | null;
}

/** The reporting sites, in the original's order, named as in the Locations master. */
export const REPORT_SITES: readonly ReportSite[] = SITE_COUNTS.map(([code]) => {
  const location = locationByCode.get(code);
  return {
    code,
    name: location?.name ?? code,
    zone: zoneName.get(location?.zone ?? 'OTHER') ?? 'Other',
    pobLimit: location && 'pobLimit' in location ? (location.pobLimit ?? null) : null,
  };
});

/** Zones that have a reporting site, alphabetically (the reports' zone filter). */
export const REPORT_ZONES = [...new Set(REPORT_SITES.map((s) => s.zone))].sort();

export interface PobPerson {
  id: string;
  optima: string;
  name: string;
  company: string;
  siteCode: string;
  site: string;
  zone: string;
  crewType: (typeof CREW_TYPES)[number];
  category: (typeof EVAC_CATEGORIES)[number];
  gender: 'Male' | 'Female';
  afloat: boolean;
  /** Arrival on the current stay (ISO date). */
  arrived: string;
}

export interface ResidenceRow {
  id: string;
  person: string;
  optima: string;
  company: string;
  siteCode: string;
  site: string;
  arrived: string;
  /** Null while the person is still there. */
  departed: string | null;
  classification: 'Stay' | 'Day trip';
  days: number;
}

const MALE = [
  'Ahmad',
  'Ali',
  'Anil',
  'Antonio',
  'Arun',
  'Carlos',
  'Chen',
  'David',
  'Edgar',
  'Ferdinand',
  'Hassan',
  'Ibrahim',
  'James',
  'John',
  'Jomar',
  'Khalid',
  'Michael',
  'Mohammed',
  'Omar',
  'Rajesh',
  'Ramon',
  'Ravi',
  'Robert',
  'Roberto',
  'Saeed',
  'Suresh',
  'Tariq',
  'Vijay',
  'Wei',
  'Yousuf',
];
const FEMALE = [
  'Aisha',
  'Anjali',
  'Fatima',
  'Grace',
  'Hessa',
  'Latifa',
  'Maria',
  'Mariam',
  'Priya',
];
const SURNAMES = [
  'Al Blooshi',
  'Al Dhaheri',
  'Al Hosani',
  'Al Kaabi',
  'Al Mansoori',
  'Al Mazrouei',
  'Al Shamsi',
  'Brown',
  'Dela Cruz',
  'Garcia',
  'Johnson',
  'Kumar',
  'Li',
  'Menon',
  'Nair',
  'Okafor',
  'Patel',
  'Pillai',
  'Rivera',
  'Santos',
  'Sharma',
  'Singh',
  'Smith',
  'Taylor',
  'Wang',
  'Williams',
];
const ADNOC = companySeeds.find((c) => c.code === 'ADNOC-OFF')?.name ?? 'ADNOC Offshore';
const RESIDENT_COMPANIES = [ADNOC, ADNOC, ADNOC, 'ADNOC Drilling'];
const CONTRACTOR_COMPANIES = [
  'NPCC',
  'Schlumberger',
  'Weatherford',
  companySeeds.find((c) => c.code === 'GOE')?.name ?? 'Gulf Offshore Engineering LLC',
  'Gulf Marine Services',
];
const VISITOR_COMPANIES = ['Target Engineering', 'Lloyd’s Register'];

/** A small seeded generator, so the demo shows the same people on every load. */
function generator(seedValue: number) {
  let state = seedValue;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  return {
    next,
    int: (max: number) => Math.floor(next() * max),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T,
  };
}

const DAY = 86_400_000;
export const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

let cache: { people: PobPerson[]; residence: ResidenceRow[] } | null = null;

function build() {
  if (cache) return cache;
  const rnd = generator(20_261_006);
  const people: PobPerson[] = [];
  const usedOptima = new Set<number>();
  const optima = () => {
    let n = 10_000 + rnd.int(90_000);
    while (usedOptima.has(n)) n = 10_000 + rnd.int(90_000);
    usedOptima.add(n);
    return `OPT-${String(n)}`;
  };
  SITE_COUNTS.forEach(([code, pob, afloat, female, t]) => {
    const site = REPORT_SITES.find((s) => s.code === code) as ReportSite;
    const categories = t.flatMap((n, i) => Array<number>(n).fill(i));
    for (let i = 0; i < pob; i += 1) {
      const gender = i < pob - female ? 'Male' : 'Female';
      const category = EVAC_CATEGORIES[categories[i] ?? 1] ?? EVAC_CATEGORIES[1];
      // T3 are visitors and temporary staff; the rest split between residents and contractors.
      const roll = rnd.next();
      const crewType: PobPerson['crewType'] =
        categories[i] === 2 && roll < 0.35 ? 'Visitor' : roll < 0.52 ? 'Contractor' : 'Resident';
      const company =
        crewType === 'Resident'
          ? rnd.pick(RESIDENT_COMPANIES)
          : crewType === 'Contractor'
            ? rnd.pick(CONTRACTOR_COMPANIES)
            : rnd.pick(VISITOR_COMPANIES);
      const id = optima();
      people.push({
        id,
        optima: id,
        name: `${rnd.pick(gender === 'Male' ? MALE : FEMALE)} ${rnd.pick(SURNAMES)}`,
        company,
        siteCode: code,
        site: site.name,
        zone: site.zone,
        crewType,
        category,
        gender,
        afloat: i >= pob - female - afloat && i < pob - female,
        arrived: addDays(REPORT_DATE, -rnd.int(crewType === 'Visitor' ? 6 : 36)),
      });
    }
  });

  const residence: ResidenceRow[] = [];
  const days = (from: string, to: string) =>
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
  people.forEach((p) => {
    residence.push({
      id: `${p.id}-now`,
      person: p.name,
      optima: p.optima,
      company: p.company,
      siteCode: p.siteCode,
      site: p.site,
      arrived: p.arrived,
      departed: null,
      classification: 'Stay',
      days: days(p.arrived, REPORT_DATE),
    });
  });
  // Earlier rotations in the period (stays that ended) and same-day trips.
  for (let i = 0; i < 306; i += 1) {
    const p = rnd.pick(people);
    const site =
      i % 3 === 0 ? rnd.pick(REPORT_SITES) : REPORT_SITES.find((s) => s.code === p.siteCode);
    const dayTrip = i < 98;
    const departed = addDays(p.arrived, -(1 + rnd.int(20)));
    const arrived = dayTrip ? departed : addDays(departed, -(3 + rnd.int(25)));
    residence.push({
      id: `${p.id}-r${String(i)}`,
      person: p.name,
      optima: p.optima,
      company: p.company,
      siteCode: site?.code ?? p.siteCode,
      site: site?.name ?? p.site,
      arrived,
      departed,
      classification: dayTrip ? 'Day trip' : 'Stay',
      days: dayTrip ? 0 : days(arrived, departed),
    });
  }
  cache = { people, residence };
  return cache;
}

export const pobPeople = (): readonly PobPerson[] => build().people;
export const residenceRows = (): readonly ResidenceRow[] => build().residence;

// ---- Saved report definitions and schedules (Report Builder / Report Scheduler) ----

export type ReportFormat = 'Excel' | 'CSV' | 'PDF';
export type Frequency = 'Daily' | 'Weekly' | 'Monthly';

export interface ReportDefinition {
  id: string;
  name: string;
  /** '' means all. */
  zone: string;
  asset: string;
  crewType: string;
  category: string;
  gender: string;
  format: ReportFormat;
  isActive: boolean;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'rpt-daily',
    name: 'Daily POB — all sites',
    zone: '',
    asset: '',
    crewType: '',
    category: '',
    gender: '',
    format: 'Excel',
    isActive: true,
  },
  {
    id: 'rpt-contractors',
    name: 'Contractors by site',
    zone: '',
    asset: '',
    crewType: 'Contractor',
    category: '',
    gender: '',
    format: 'CSV',
    isActive: true,
  },
  {
    id: 'rpt-das-essential',
    name: 'Das Island — essential ops',
    zone: '',
    asset: 'Das Island',
    crewType: '',
    category: 'T1 - Essential Ops',
    gender: '',
    format: 'PDF',
    isActive: false,
  },
  {
    id: 'rpt-female',
    name: 'Female POB by zone',
    zone: '',
    asset: '',
    crewType: '',
    category: '',
    gender: 'Female',
    format: 'Excel',
    isActive: true,
  },
];

export const RECIPIENTS = ['MC Control', 'Site Manager', 'Vice President'] as const;

export interface ReportSchedule {
  id: string;
  reportId: string;
  frequency: Frequency;
  format: ReportFormat;
  recipients: string[];
  isActive: boolean;
}

export const REPORT_SCHEDULES: ReportSchedule[] = [
  {
    id: 'sch-daily',
    reportId: 'rpt-daily',
    frequency: 'Daily',
    format: 'Excel',
    recipients: ['MC Control', 'Site Manager'],
    isActive: true,
  },
  {
    id: 'sch-weekly',
    reportId: 'rpt-contractors',
    frequency: 'Weekly',
    format: 'CSV',
    recipients: ['Site Manager'],
    isActive: false,
  },
  {
    id: 'sch-monthly',
    reportId: 'rpt-female',
    frequency: 'Monthly',
    format: 'PDF',
    recipients: ['Vice President'],
    isActive: true,
  },
];

/** Whether a person matches a saved report's include filters. */
export const matchesDefinition = (
  p: PobPerson,
  d: Pick<ReportDefinition, 'zone' | 'asset' | 'crewType' | 'category' | 'gender'>,
) =>
  (!d.zone || p.zone === d.zone) &&
  (!d.asset || p.site === d.asset) &&
  (!d.crewType || p.crewType === d.crewType) &&
  (!d.category || p.category === d.category) &&
  (!d.gender || p.gender === d.gender);
