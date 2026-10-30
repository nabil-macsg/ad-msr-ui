import { json, notFound } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, seed } from '../core/store';
import { POB_ROSTER_ROWS, POB_SITE_SEEDS } from './demo-pob-sites-data';
import locationSeeds from './seeds/locations.json';
import zoneSeeds from './seeds/zones.json';

/** The day the original demo's sample describes ("today" for arrivals, HSE expiry, days offshore). */
export const POB_TODAY = '2026-10-06';

const CATEGORY: Record<string, string> = { R: 'Resident', C: 'Contractor', V: 'Visitor' };
const EVAC: Record<string, string> = {
  '1': 'T1 - Essential Ops',
  '2': 'T2 - Non-Essential',
  '3': 'T3 - Visitor / Temp',
  '4': 'T4 - Medical',
};
const RECORDED_BY: Record<string, string> = {
  D: 'Dispatch',
  M: 'Manual override',
  V: 'Vessel check-in',
};

export interface PobPerson {
  id: string;
  site: string;
  name: string;
  optima: string;
  company: string;
  nationality: string;
  gender: 'Male' | 'Female';
  category: string;
  evacCategory: string;
  checkIn: string;
  musterPoint: string;
  role: string;
  hseExpiry: string;
  hseStatus: 'Valid' | 'Expiring soon' | 'Expired';
  aboard: string;
  offshoreSince: string;
  recordedBy: string;
  previous: { site: string; from: string; to: string } | null;
  essential: boolean;
}

export interface PobSite {
  id: string;
  code: string;
  name: string;
  zone: string;
  zoneName: string;
  type: string;
  status: string;
  limit: number;
  lifeboat: number | null;
  focalPoint: string;
  focalEmail: string;
  conditions: string;
  arrivedToday: number;
  departedToday: number;
  lat: number;
  lng: number;
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function hseStatus(expiry: string): PobPerson['hseStatus'] {
  if (expiry < POB_TODAY) return 'Expired';
  return expiry <= addDays(POB_TODAY, 30) ? 'Expiring soon' : 'Valid';
}

function person(site: string, row: string): PobPerson {
  const f = row.split('|');
  const at = (i: number) => f[i] ?? '';
  const [prevSite, prevFrom, prevTo] = at(14).split('~');
  return {
    id: `${site}:${at(1)}`,
    site,
    name: at(0),
    optima: at(1),
    company: at(2),
    nationality: at(3),
    gender: at(4) === 'F' ? 'Female' : 'Male',
    category: CATEGORY[at(5)] ?? at(5),
    evacCategory: EVAC[at(6)] ?? at(6),
    checkIn: at(7),
    musterPoint: at(8),
    role: at(9),
    hseExpiry: at(10),
    hseStatus: hseStatus(at(10)),
    aboard: at(11),
    offshoreSince: at(12),
    recordedBy: RECORDED_BY[at(13)] ?? at(13),
    previous: prevSite && prevFrom && prevTo ? { site: prevSite, from: prevFrom, to: prevTo } : null,
    essential: at(15) === '1',
  };
}

const zoneName = (code: string) => zoneSeeds.find((z) => z.code === code)?.name ?? code;

function sites(): PobSite[] {
  return POB_SITE_SEEDS.flatMap((s) => {
    const loc = locationSeeds.find((l) => l.code === s.code);
    if (!loc) return [];
    return [
      {
        ...s,
        id: s.code,
        name: loc.name,
        zone: loc.zone,
        zoneName: zoneName(loc.zone),
        type: loc.type.toLowerCase(),
      },
    ];
  });
}

const people = () => all<PobPerson>('demo-pob:people');

/** Everybody on board, for other pob screens that need the same people. */
export const pobPeople = people;
export const pobSites = () => all<PobSite>('demo-pob:sites');

type Filter = (p: PobPerson) => boolean;

/** The dashboard's filter bar, as person filters. */
function dashboardFilter(q: URLSearchParams): Filter {
  const v = (name: string) => q.get(name) ?? '';
  const crew = v('crew');
  const gender = v('gender');
  const nationality = v('nationality');
  const evac = v('evac');
  const hse = v('hse');
  const essential = v('essential');
  return (p) =>
    (!crew || p.category === crew) &&
    (!gender || p.gender === gender) &&
    (!nationality || p.nationality === nationality) &&
    (!evac || p.evacCategory === evac) &&
    (!hse || p.hseStatus === hse) &&
    (!essential || (essential === 'essential' ? p.essential : !p.essential));
}

function siteStats(site: PobSite, crew: PobPerson[], match: Filter) {
  const count = (f: Filter) => crew.filter(f).length;
  return {
    ...site,
    pob: crew.length,
    matching: count(match),
    aboardVessels: count((p) => p.aboard !== ''),
    male: count((p) => p.gender === 'Male'),
    female: count((p) => p.gender === 'Female'),
    residents: count((p) => p.category === 'Resident'),
    contractors: count((p) => p.category === 'Contractor'),
    visitors: count((p) => p.category === 'Visitor'),
  };
}
export type PobSiteStats = ReturnType<typeof siteStats>;

export function registerPobSites(): void {
  seed('demo-pob:sites', sites);
  seed('demo-pob:people', () =>
    Object.entries(POB_ROSTER_ROWS).flatMap(([site, rows]) => rows.map((r) => person(site, r))),
  );

  route('GET', '/api/v1/demo/pob/sites', () => {
    const crew = people();
    return json(
      pobSites().map((s) =>
        siteStats(
          s,
          crew.filter((p) => p.site === s.code),
          () => true,
        ),
      ),
    );
  });

  route('GET', '/api/v1/demo/pob/dashboard', (req) => {
    const q = req.query;
    const zone = q.get('zone') ?? '';
    const siteCode = q.get('site') ?? '';
    const match = dashboardFilter(q);
    const crew = people();
    const shown = pobSites().filter(
      (s) => (!zone || s.zone === zone) && (!siteCode || s.code === siteCode),
    );
    const inScope = crew.filter((p) => shown.some((s) => s.code === p.site));
    const matching = inScope.filter(match);
    const stats = shown.map((s) =>
      siteStats(
        s,
        crew.filter((p) => p.site === s.code),
        match,
      ),
    );
    const zones = [...new Set(stats.map((s) => s.zone))].map((code) => {
      const zoneSites = stats.filter((s) => s.zone === code);
      return {
        code,
        name: zoneName(code),
        pob: zoneSites.reduce((n, s) => n + s.matching, 0),
        sites: zoneSites,
      };
    });
    const by = (f: Filter) => matching.filter(f).length;
    return json({
      total: crew.length,
      matching: matching.length,
      inScope: inScope.length,
      arrivedToday: stats.reduce((n, s) => n + s.arrivedToday, 0),
      departedToday: stats.reduce((n, s) => n + s.departedToday, 0),
      mix: {
        residents: by((p) => p.category === 'Resident'),
        contractors: by((p) => p.category === 'Contractor'),
        visitors: by((p) => p.category === 'Visitor'),
      },
      hseExpired: by((p) => p.hseStatus === 'Expired'),
      hseExpiring: by((p) => p.hseStatus === 'Expiring soon'),
      essential: by((p) => p.essential),
      nationalities: [...new Set(crew.map((p) => p.nationality))].sort(),
      zones,
    });
  });

  route('GET', '/api/v1/demo/pob/sites/:code', (req) => {
    const site = pobSites().find((s) => s.code === req.params.code);
    if (!site) return notFound('site');
    const crew = people().filter((p) => p.site === site.code);
    return json({
      ...siteStats(site, crew, () => true),
      companies: [...new Set(crew.map((p) => p.company))].sort(),
    });
  });

  route('GET', '/api/v1/demo/pob/sites/:code/people', (req) =>
    json(
      listRows(
        people().filter((p) => p.site === req.params.code),
        req.query,
        {
          search: (p) => [p.name, p.optima],
          hasActive: false,
        },
      ),
    ),
  );
}
