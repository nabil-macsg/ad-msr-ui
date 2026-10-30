import { bodyOf, json, MockError, noContent, notFound, text } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, find, insert, removeRow, replace, seed } from '../core/store';
import {
  BOARDINGS,
  type BoardingSeed,
  CREW_MASTER,
  CREW_RECORDS,
  type CrewSeed,
  OVERRIDE_PEOPLE,
  OVERRIDES,
  type OverrideSeed,
  RECORDS_TODAY,
  VESSELS,
  type VesselSeed,
} from './demo-pob-records-data';
import locationSeeds from './seeds/locations.json';

/** Demo pob (records screens): vessel / barge check-in, crew entry and location override. */
const API = '/api/v1/demo/pob/records';
const STORE = {
  vessels: 'demo-pob:vessels',
  boardings: 'demo-pob:vessel-boardings',
  crew: 'demo-pob:crew',
  overrides: 'demo-pob:location-overrides',
} as const;

/** Offshore sites people are recorded at (the Locations master, without the onshore base). */
const SITES = locationSeeds
  .filter((l) => l.type !== 'BASE')
  .map((l) => ({ code: l.code, name: l.name }));
const siteName = (code: string) => SITES.find((s) => s.code === code)?.name ?? code;

/** Days offshore past which a crew record shows as over the limit. */
const OFFSHORE_LIMIT_DAYS = 56;
const DAY_MS = 86_400_000;
const daysSince = (iso: string) =>
  Math.max(0, Math.round((Date.parse(RECORDS_TODAY) - Date.parse(iso.slice(0, 10))) / DAY_MS));

const crewMember = (optima: string) => CREW_MASTER.find((c) => c.optima === optima);

function validation(fields: Record<string, string>): void {
  if (Object.keys(fields).length > 0) {
    throw new MockError(422, 'VALIDATION_FAILED', 'Some fields need attention.', { fields });
  }
}

/** Everybody the screens can look up: crew, people aboard vessels and people recorded on site. */
function people() {
  const byOptima = new Map<string, { optima: string; name: string; detail: string }>();
  for (const c of CREW_MASTER) {
    byOptima.set(c.optima, { optima: c.optima, name: c.name, detail: `${c.employer} · ${c.role}` });
  }
  for (const b of all<BoardingSeed>(STORE.boardings)) {
    if (!byOptima.has(b.optima)) {
      byOptima.set(b.optima, {
        optima: b.optima,
        name: b.name,
        detail: `${b.company} · ${b.role}`,
      });
    }
  }
  for (const p of OVERRIDE_PEOPLE) {
    if (!byOptima.has(p.optima)) {
      byOptima.set(p.optima, {
        optima: p.optima,
        name: p.name,
        detail: `Currently ${siteName(p.locationCode)}`,
      });
    }
  }
  return [...byOptima.values()];
}

/** Closes wherever somebody was recorded before (other vessels, an open crew record). */
function closeElsewhere(optima: string): void {
  for (const b of all<BoardingSeed>(STORE.boardings).filter((r) => r.optima === optima)) {
    removeRow(STORE.boardings, b.id);
  }
  for (const c of all<CrewSeed>(STORE.crew).filter((r) => r.optima === optima)) {
    removeRow(STORE.crew, c.id);
  }
}

interface AboardRow {
  id: string;
  kind: 'boarding' | 'crew';
  name: string;
  optima: string;
  company: string;
  role: string;
  boardedAt: string;
  recordedBy: string;
}

function aboard(vessel: VesselSeed): AboardRow[] {
  const passengers = all<BoardingSeed>(STORE.boardings)
    .filter((b) => b.vesselId === vessel.id)
    .map((b): AboardRow => ({ ...b, kind: 'boarding' }));
  const crew = all<CrewSeed>(STORE.crew)
    .filter((c) => c.vessel === vessel.name)
    .map((c): AboardRow => {
      const m = crewMember(c.optima);
      return {
        id: c.id,
        kind: 'crew',
        name: m?.name ?? c.optima,
        optima: c.optima,
        company: m?.employer ?? '',
        role: m?.role ?? '',
        boardedAt: c.onBoardAt,
        recordedBy: 'Crew entry',
      };
    });
  return [...passengers, ...crew];
}

const vesselView = (v: VesselSeed) => ({
  ...v,
  locationName: siteName(v.locationCode),
  aboard: aboard(v).length,
});

function crewView(c: CrewSeed) {
  const m = crewMember(c.optima);
  const days = daysSince(c.onBoardAt);
  return {
    ...c,
    name: m?.name ?? c.optima,
    role: m?.role ?? '',
    employer: m?.employer ?? '',
    category: m?.category ?? '',
    nationality: m?.nationality ?? '',
    hsePassportExpiry: m?.hsePassportExpiry ?? '',
    locationName: siteName(c.locationCode),
    daysOffshore: days,
    overLimit: days > OFFSHORE_LIMIT_DAYS,
    overdue: c.until < RECORDS_TODAY,
  };
}

export function registerPobRecords(): void {
  seed(STORE.vessels, () => VESSELS);
  seed(STORE.boardings, () => BOARDINGS);
  seed(STORE.crew, () => CREW_RECORDS);
  seed(STORE.overrides, () => OVERRIDES);

  route('GET', `${API}/sites`, () => json(SITES));
  route('GET', `${API}/today`, () => json({ today: RECORDS_TODAY }));
  route('GET', `${API}/people`, (req) => {
    const q = req.query.get('q')?.trim().toLowerCase() ?? '';
    const rows = people().filter(
      (p) => !q || `${p.name} ${p.optima} ${p.detail}`.toLowerCase().includes(q),
    );
    return json(rows.slice(0, 40));
  });

  // Vessel / barge check-in
  route('GET', `${API}/vessels`, () => json(all<VesselSeed>(STORE.vessels).map(vesselView)));
  route('GET', `${API}/vessels/:id/aboard`, (req) => {
    const vessel = find<VesselSeed>(STORE.vessels, req.params.id ?? '');
    if (!vessel) return notFound('vessel');
    return json(
      listRows(aboard(vessel), req.query, {
        search: (r) => [r.name, r.optima, r.company, r.role],
        hasActive: false,
      }),
    );
  });
  route('POST', `${API}/vessels/:id/move`, (req) => {
    const vessel = find<VesselSeed>(STORE.vessels, req.params.id ?? '');
    if (!vessel) return notFound('vessel');
    const code = text(bodyOf(req).locationCode);
    validation(SITES.some((s) => s.code === code) ? {} : { locationCode: 'Choose a location.' });
    return json(vesselView(replace(STORE.vessels, { ...vessel, locationCode: code })));
  });
  route('POST', `${API}/vessels/:id/aboard`, (req) => {
    const vessel = find<VesselSeed>(STORE.vessels, req.params.id ?? '');
    if (!vessel) return notFound('vessel');
    const body = bodyOf(req);
    const optima = text(body.optima);
    const date = text(body.date);
    const time = text(body.time);
    const person = people().find((p) => p.optima === optima);
    validation({
      ...(person ? {} : { optima: 'Choose who is boarding.' }),
      ...(date ? {} : { date: 'A boarding date is required.' }),
    });
    if (!person) return notFound('person');
    const member = crewMember(optima);
    const known = all<BoardingSeed>(STORE.boardings).find((b) => b.optima === optima);
    closeElsewhere(optima);
    const [company, role] = member
      ? [member.employer, member.role]
      : [known?.company ?? '', known?.role ?? ''];
    const row: BoardingSeed = {
      id: `vb-${String(Date.now())}`,
      vesselId: vessel.id,
      name: person.name,
      optima,
      company,
      role,
      boardedAt: time ? `${date}T${time}` : date,
      recordedBy: 'Marine Focal Point',
    };
    return json(insert(STORE.boardings, row), 201);
  });
  route('DELETE', `${API}/vessels/:id/aboard/:rowId`, (req) => {
    const id = req.params.rowId ?? '';
    if (find<BoardingSeed>(STORE.boardings, id)) removeRow(STORE.boardings, id);
    else if (find<CrewSeed>(STORE.crew, id)) removeRow(STORE.crew, id);
    else return notFound('record');
    return noContent();
  });

  // Crew entry
  route('GET', `${API}/crew-members`, () => json(CREW_MASTER));
  route('GET', `${API}/crew`, (req) =>
    json(
      listRows(all<CrewSeed>(STORE.crew).map(crewView), req.query, {
        search: (r) => [r.name, r.optima, r.role, r.employer, r.vessel, r.locationName],
        defaultSort: 'locationName:asc',
        hasActive: false,
      }),
    ),
  );
  route('GET', `${API}/crew/:id`, (req) => {
    const row = find<CrewSeed>(STORE.crew, req.params.id ?? '');
    return row ? json(crewView(row)) : notFound('crew record');
  });
  route('POST', `${API}/crew`, (req) => {
    const body = bodyOf(req);
    const optima = text(body.optima);
    const locationCode = text(body.locationCode);
    const vessel = text(body.vessel);
    const date = text(body.date);
    const time = text(body.time);
    const until = text(body.until);
    validation({
      ...(crewMember(optima) ? {} : { optima: 'A crew member is required.' }),
      ...(SITES.some((s) => s.code === locationCode)
        ? {}
        : { locationCode: 'A location is required.' }),
      ...(date ? {} : { date: 'A date on board is required.' }),
      ...(until ? {} : { until: 'An until-when date is required.' }),
      ...(until && date && until < date ? { until: 'Until must be on or after the date.' } : {}),
    });
    closeElsewhere(optima);
    const row: CrewSeed = {
      id: `crew-${String(Date.now())}`,
      optima,
      locationCode,
      vessel,
      onBoardAt: time ? `${date}T${time}` : date,
      until,
      recordedBy: 'Marine Focal Point',
    };
    return json(crewView(insert(STORE.crew, row)), 201);
  });
  route('DELETE', `${API}/crew/:id`, (req) => {
    const id = req.params.id ?? '';
    if (!find<CrewSeed>(STORE.crew, id)) return notFound('crew record');
    removeRow(STORE.crew, id);
    return noContent();
  });

  // Location override
  route('GET', `${API}/overrides`, (req) =>
    json(
      listRows(
        all<OverrideSeed>(STORE.overrides).map((o) => ({
          ...o,
          locationName: siteName(o.locationCode),
        })),
        req.query,
        {
          search: (r) => [r.name, r.optima, r.locationName, r.comment],
          defaultSort: 'date:desc',
          hasActive: false,
        },
      ),
    ),
  );
  route('GET', `${API}/override-people`, (req) => {
    const q = req.query.get('q')?.trim().toLowerCase() ?? '';
    const latest = new Map<string, string>();
    for (const o of all<OverrideSeed>(STORE.overrides)) {
      if (!latest.has(o.optima)) latest.set(o.optima, o.locationCode);
    }
    return json(
      OVERRIDE_PEOPLE.map((p) => {
        const code = latest.get(p.optima) ?? p.locationCode;
        return { ...p, locationCode: code, locationName: siteName(code) };
      }).filter((p) => !q || `${p.name} ${p.optima}`.toLowerCase().includes(q)),
    );
  });
  route('POST', `${API}/overrides`, (req) => {
    const body = bodyOf(req);
    const optima = text(body.optima);
    const locationCode = text(body.locationCode);
    const date = text(body.date);
    const comment = text(body.comment).trim();
    const person = OVERRIDE_PEOPLE.find((p) => p.optima === optima);
    validation({
      ...(person ? {} : { optima: 'A passenger is required.' }),
      ...(SITES.some((s) => s.code === locationCode)
        ? {}
        : { locationCode: 'A location is required.' }),
      ...(date ? {} : { date: 'A date is required.' }),
      ...(comment
        ? {}
        : { comment: 'A comment is required — it is the record of why this override was made.' }),
    });
    const row: OverrideSeed = {
      id: `lo-${String(Date.now())}`,
      name: person?.name ?? optima,
      optima,
      locationCode,
      date,
      comment,
      recordedBy: 'Site Focal Point',
    };
    return json(insert(STORE.overrides, row), 201);
  });
}
