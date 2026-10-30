import { bodyOf, json, MockError, notFound, required, text } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, find, insert, newId, replace, seed } from '../core/store';
import {
  EVACUATION_CATEGORIES,
  lifeboatsOf,
  musterPointsOf,
  peopleOnSite,
  REGIONS,
  SITE_FIGURES,
  siteName,
  siteType,
  type SitePerson,
} from './demo-pob-emergency-data';

/** Demo pob (emergency screens): musters, roster tick-off, headcounts, evacuation report. */
const BASE = '/api/v1/demo/pob/emergency';
const MUSTERS = 'demo-pob:musters';

export interface RosterRow extends SitePerson {
  status: 'Accounted' | 'Unaccounted';
  accountedAt: string | null;
  accountedPoint: string | null;
  accountedPointName: string | null;
}

interface Headcount {
  count: number;
  recordedAt: string;
}

interface Muster {
  id: string;
  location: string;
  declaredAt: string;
  status: 'Active' | 'Stood down';
  stoodDownAt: string | null;
  standDownReason: string | null;
  roster: RosterRow[];
  headcounts: Record<string, Headcount>;
}

const activeMuster = (location: string) =>
  all<Muster>(MUSTERS).find((m) => m.location === location && m.status === 'Active');

function summary(m: Muster) {
  const accounted = m.roster.filter((r) => r.status === 'Accounted').length;
  return {
    id: m.id,
    location: m.location,
    declaredAt: m.declaredAt,
    status: m.status,
    frozen: m.roster.length,
    accounted,
    unaccounted: m.roster.length - accounted,
    points: musterPointsOf(m.location).map((p) => ({
      ...p,
      assigned: m.roster.filter((r) => r.homePoint === p.code).length,
      accounted: m.roster.filter((r) => r.accountedPoint === p.code).length,
      headcount: m.headcounts[p.code] ?? null,
    })),
  };
}

function site(code: string) {
  const figures = SITE_FIGURES.find((s) => s.code === code);
  if (!figures) throw new MockError(404, 'NOT_FOUND', 'The location was not found.');
  const boats = lifeboatsOf(code);
  const muster = activeMuster(code);
  return {
    code,
    name: siteName(code),
    onSite: figures.onSite,
    aboardVessels: figures.aboardVessels,
    pob: figures.onSite + figures.aboardVessels,
    lifeboats: boats && { ...boats, enough: boats.capacity >= figures.onSite },
    musterPoints: musterPointsOf(code),
    muster: muster ? summary(muster) : null,
  };
}

function musterOf(id: string): Muster {
  const m = find<Muster>(MUSTERS, id);
  if (!m) throw new MockError(404, 'NOT_FOUND', 'The muster was not found.');
  return m;
}

function activeOnly(m: Muster): void {
  if (m.status !== 'Active')
    throw new MockError(409, 'CONFLICT', 'This muster has been stood down.');
}

function pointOf(m: Muster, code: string) {
  const point = musterPointsOf(m.location).find((p) => p.code === code);
  if (!point)
    throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
      fields: { point: 'Choose a muster point at this location' },
    });
  return point;
}

export function registerPobEmergency(): void {
  seed<Muster>(MUSTERS, () => []);

  route('GET', `${BASE}/sites`, () =>
    json(SITE_FIGURES.map((s) => ({ code: s.code, name: siteName(s.code) }))),
  );
  route('GET', `${BASE}/sites/:code`, (req) => json(site(req.params.code ?? '')));

  route('POST', `${BASE}/sites/:code/musters`, (req) => {
    const code = req.params.code ?? '';
    const info = site(code);
    if (info.muster)
      throw new MockError(409, 'CONFLICT', `A muster is already running at ${info.name}.`);
    const body = bodyOf(req);
    const date = required(body.date, 'date');
    const time = required(body.time, 'time');
    const declaredAt = new Date(`${date}T${time}`);
    if (Number.isNaN(declaredAt.getTime()))
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { date: 'Enter a valid date and time' },
      });
    if (declaredAt.getTime() > Date.now() + 60_000)
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { time: 'A muster cannot be declared in the future' },
      });
    const muster = insert<Muster>(MUSTERS, {
      id: newId(),
      location: code,
      declaredAt: declaredAt.toISOString(),
      status: 'Active',
      stoodDownAt: null,
      standDownReason: null,
      roster: peopleOnSite(code).map((p) => ({
        ...p,
        status: 'Unaccounted',
        accountedAt: null,
        accountedPoint: null,
        accountedPointName: null,
      })),
      headcounts: {},
    });
    return json(summary(muster), 201);
  });

  route('GET', `${BASE}/musters/:id/roster`, (req) =>
    json(
      listRows(musterOf(req.params.id ?? '').roster, req.query, {
        search: (r) => [r.name, r.personnelNo, r.company],
        filters: { point: (r, v) => r.homePoint === v || r.accountedPoint === v },
        defaultSort: 'name:asc',
        hasActive: false,
      }),
    ),
  );

  route('POST', `${BASE}/musters/:id/roster/:personId`, (req) => {
    const m = musterOf(req.params.id ?? '');
    activeOnly(m);
    const person = m.roster.find((r) => r.id === req.params.personId);
    if (!person) return notFound('person');
    const point = text(bodyOf(req).point);
    if (point) {
      const ref = pointOf(m, point);
      Object.assign(person, {
        status: 'Accounted',
        accountedAt: new Date().toISOString(),
        accountedPoint: ref.code,
        accountedPointName: ref.name,
      });
    } else {
      Object.assign(person, {
        status: 'Unaccounted',
        accountedAt: null,
        accountedPoint: null,
        accountedPointName: null,
      });
    }
    replace(MUSTERS, m);
    return json(person);
  });

  route('POST', `${BASE}/musters/:id/headcounts`, (req) => {
    const m = musterOf(req.params.id ?? '');
    activeOnly(m);
    const body = bodyOf(req);
    const ref = pointOf(m, text(body.point));
    const count = Number(text(body.count));
    if (text(body.count) === '' || !Number.isInteger(count) || count < 0)
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { count: 'Enter the number of people at the muster point' },
      });
    if (count > m.roster.length)
      throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', {
        fields: { count: `More than the ${String(m.roster.length)} people on the frozen list` },
      });
    m.headcounts[ref.code] = { count, recordedAt: new Date().toISOString() };
    replace(MUSTERS, m);
    return json(summary(m));
  });

  route('POST', `${BASE}/musters/:id/stand-down`, (req) => {
    const m = musterOf(req.params.id ?? '');
    activeOnly(m);
    m.status = 'Stood down';
    m.stoodDownAt = new Date().toISOString();
    m.standDownReason = text(bodyOf(req).reason) || null;
    replace(MUSTERS, m);
    return json(summary(m));
  });

  route('GET', `${BASE}/evacuation-report`, () => {
    const rows = SITE_FIGURES.map((s) => {
      const boats = lifeboatsOf(s.code);
      const pob = s.onSite + s.aboardVessels;
      const muster = activeMuster(s.code);
      return {
        code: s.code,
        name: siteName(s.code),
        type: siteType(s.code),
        region: s.region,
        pob,
        residents: s.residents,
        contractors: s.contractors,
        visitors: s.visitors,
        male: s.male,
        female: s.female,
        lifeboatCapacity: boats?.capacity ?? null,
        surplus: boats ? boats.capacity - pob : null,
        status: muster ? 'Emergency' : s.status,
      };
    });
    const withBoats = rows.filter((r) => r.lifeboatCapacity !== null);
    return json({
      generatedAt: new Date().toISOString(),
      totalPob: rows.reduce((t, r) => t + r.pob, 0),
      lifeboatCapacity: withBoats.reduce((t, r) => t + (r.lifeboatCapacity ?? 0), 0),
      sufficient: withBoats.every((r) => (r.surplus ?? 0) >= 0),
      assetsReporting: rows.length,
      onAlert: rows.filter((r) => r.status !== 'Normal').length,
      categories: EVACUATION_CATEGORIES,
      regions: REGIONS.map((region) => {
        const items = rows.filter((r) => r.region === region);
        return {
          region,
          pob: items.reduce((t, r) => t + r.pob, 0),
          lifeboatCapacity: items.reduce((t, r) => t + (r.lifeboatCapacity ?? 0), 0),
          rows: items,
        };
      }),
    });
  });
}
