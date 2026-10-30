import { bodyOf, json, MockError, notFound, text } from '../core/http';
import { listRows, type ListSpec } from '../core/list';
import { route } from '../core/router';
import { all, find, insert, newId, replace, seed } from '../core/store';
import {
  CREW_TYPES,
  EVAC_CATEGORIES,
  type Frequency,
  matchesDefinition,
  type PobPerson,
  pobPeople,
  RECIPIENTS,
  REPORT_DATE,
  REPORT_DEFINITIONS,
  REPORT_SCHEDULES,
  REPORT_SITES,
  type ReportDefinition,
  type ReportFormat,
  type ReportSchedule,
  type ResidenceRow,
  residenceRows,
} from './demo-pob-reports-data';

/**
 * Demo pob reports: Normal / Emergency POB, Residence Duration, Report Builder and Report
 * Scheduler, under /api/v1/demo/pob/reports/.
 */
const BASE = '/api/v1/demo/pob/reports';
const DEFS = 'demo-pob:report-definitions';
const SCHEDULES = 'demo-pob:report-schedules';

export interface SiteReportRow {
  id: string;
  site: string;
  zone: string;
  pob: number;
  onSite: number;
  afloat: number;
  male: number;
  female: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  resident: number;
  contractor: number;
  visitor: number;
  status: 'Normal' | 'Emergency';
  order: number;
}

function siteRows(): SiteReportRow[] {
  const people = pobPeople();
  return REPORT_SITES.map((site, order) => {
    const here = people.filter((p) => p.siteCode === site.code);
    const count = (test: (p: PobPerson) => boolean) => here.filter(test).length;
    const afloat = count((p) => p.afloat);
    return {
      id: site.code,
      site: site.name,
      zone: site.zone,
      pob: here.length,
      onSite: here.length - afloat,
      afloat,
      male: count((p) => p.gender === 'Male'),
      female: count((p) => p.gender === 'Female'),
      t1: count((p) => p.category === EVAC_CATEGORIES[0]),
      t2: count((p) => p.category === EVAC_CATEGORIES[1]),
      t3: count((p) => p.category === EVAC_CATEGORIES[2]),
      t4: count((p) => p.category === EVAC_CATEGORIES[3]),
      resident: count((p) => p.crewType === CREW_TYPES[0]),
      contractor: count((p) => p.crewType === CREW_TYPES[1]),
      visitor: count((p) => p.crewType === CREW_TYPES[2]),
      status: 'Normal',
      order,
    };
  });
}

const SITE_SPEC: ListSpec<SiteReportRow> = {
  search: (r) => [r.site, r.zone],
  defaultSort: 'order:asc',
  hasActive: false,
};

const RESIDENCE_SPEC: ListSpec<ResidenceRow> = {
  search: (r) => [r.person, r.optima],
  filters: {
    classification: (r, v) =>
      v === 'stays'
        ? r.classification === 'Stay'
        : v === 'trips'
          ? r.classification === 'Day trip'
          : true,
  },
  sorts: { person: (r) => r.person },
  defaultSort: 'arrived:desc',
  hasActive: false,
};

const PEOPLE_SPEC: ListSpec<PobPerson> = {
  search: (r) => [r.name, r.optima, r.company],
  hasActive: false,
};

/** The same query without paging: the rows a summary or an export covers. */
function unpaged(query: URLSearchParams): URLSearchParams {
  const copy = new URLSearchParams(query);
  copy.delete('page');
  copy.delete('pageSize');
  return copy;
}

const cell = (v: unknown) => {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csv(name: string, header: readonly string[], rows: readonly (readonly unknown[])[]) {
  const body = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="${name}-${REPORT_DATE}.csv"`,
    },
  });
}

const definitions = () => all<ReportDefinition>(DEFS);
const schedules = () => all<ReportSchedule>(SCHEDULES);

function definitionRow(d: ReportDefinition) {
  const people = pobPeople().filter((p) => matchesDefinition(p, d));
  const active = schedules().filter((s) => s.reportId === d.id && s.isActive);
  const parts = [d.asset || d.zone, d.crewType, d.category.split(' - ')[0], d.gender].filter(
    Boolean,
  );
  return {
    ...d,
    includes: parts.length ? parts.join(' · ') : 'Everybody offshore',
    rowsToday: people.length,
    scheduled: active.map((s) => s.frequency).join(', '),
    scheduleCount: active.length,
  };
}

const FORMATS: readonly ReportFormat[] = ['Excel', 'CSV', 'PDF'];
const FREQUENCIES: readonly Frequency[] = ['Daily', 'Weekly', 'Monthly'];

function definitionFrom(body: Record<string, unknown>): Omit<ReportDefinition, 'id' | 'isActive'> {
  const name = text(body.name).trim();
  if (!name) {
    throw new MockError(422, 'VALIDATION_FAILED', 'Enter a report name.', {
      fields: { name: 'Enter a report name.' },
    });
  }
  const format = text(body.format) as ReportFormat;
  return {
    name,
    zone: text(body.zone),
    asset: text(body.asset),
    crewType: text(body.crewType),
    category: text(body.category),
    gender: text(body.gender),
    format: FORMATS.includes(format) ? format : 'Excel',
  };
}

function scheduleFrom(body: Record<string, unknown>): Omit<ReportSchedule, 'id' | 'isActive'> {
  const reportId = text(body.reportId);
  const recipients = Array.isArray(body.recipients)
    ? body.recipients.filter((r): r is string => RECIPIENTS.includes(r as never))
    : [];
  const fields: Record<string, string> = {};
  if (!find<ReportDefinition>(DEFS, reportId)) fields.reportId = 'Select a saved report.';
  if (recipients.length === 0) fields.recipients = 'Choose at least one recipient.';
  if (Object.keys(fields).length) {
    throw new MockError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fields });
  }
  const frequency = text(body.frequency) as Frequency;
  const format = text(body.format) as ReportFormat;
  return {
    reportId,
    frequency: FREQUENCIES.includes(frequency) ? frequency : 'Daily',
    format: FORMATS.includes(format) ? format : 'Excel',
    recipients,
  };
}

const PERSON_HEADER = [
  'Person',
  'Optima number',
  'Company',
  'Site',
  'Crew type',
  'Evacuation category',
  'Gender',
];
const personCells = (p: PobPerson) => [
  p.name,
  p.optima,
  p.company,
  p.site,
  p.crewType,
  p.category,
  p.gender,
];

export function registerPobReports(): void {
  seed(DEFS, () => REPORT_DEFINITIONS);
  seed(SCHEDULES, () => REPORT_SCHEDULES);

  // Normal / Emergency POB
  route('GET', `${BASE}/pob`, (req) => json(listRows(siteRows(), req.query, SITE_SPEC)));
  route('GET', `${BASE}/pob/summary`, (req) => {
    const rows = listRows(siteRows(), unpaged(req.query), SITE_SPEC).items;
    const sum = (k: 'pob' | 'male' | 'female') => rows.reduce((t, r) => t + r[k], 0);
    return json({
      date: REPORT_DATE,
      sites: rows.length,
      pob: sum('pob'),
      male: sum('male'),
      female: sum('female'),
      emergency: rows.filter((r) => r.status === 'Emergency').length,
    });
  });
  route('GET', `${BASE}/pob/export`, (req) => {
    const rows = listRows(siteRows(), unpaged(req.query), SITE_SPEC).items;
    return csv(
      'pob-report',
      [
        'Site',
        'Zone',
        'POB',
        'On site',
        'Afloat',
        'Male',
        'Female',
        'T1',
        'T2',
        'T3',
        'T4',
        'Resident',
        'Contractor',
        'Visitor',
        'Status',
      ],
      rows.map((r) => [
        r.site,
        r.zone,
        r.pob,
        r.onSite,
        r.afloat,
        r.male,
        r.female,
        r.t1,
        r.t2,
        r.t3,
        r.t4,
        r.resident,
        r.contractor,
        r.visitor,
        r.status,
      ]),
    );
  });

  // Residence Duration
  route('GET', `${BASE}/residence`, (req) =>
    json(listRows(residenceRows(), req.query, RESIDENCE_SPEC)),
  );
  route('GET', `${BASE}/residence/summary`, (req) => {
    const rows = listRows(residenceRows(), unpaged(req.query), RESIDENCE_SPEC).items;
    const stays = rows.filter((r) => r.classification === 'Stay');
    const bySite = new Map<string, number>();
    for (const r of stays) bySite.set(r.site, (bySite.get(r.site) ?? 0) + r.days);
    return json({
      date: REPORT_DATE,
      days: stays.reduce((t, r) => t + r.days, 0),
      stays: stays.length,
      dayTrips: rows.length - stays.length,
      people: new Set(stays.map((r) => r.optima)).size,
      bySite: [...bySite].map(([site, days]) => ({ site, days })).sort((a, b) => b.days - a.days),
    });
  });
  route('GET', `${BASE}/residence/export`, (req) => {
    const rows = listRows(residenceRows(), unpaged(req.query), RESIDENCE_SPEC).items;
    return csv(
      'residence-duration',
      [
        'Person',
        'Optima number',
        'Company',
        'Site',
        'Arrived',
        'Departed',
        'Classification',
        'Days',
      ],
      rows.map((r) => [
        r.person,
        r.optima,
        r.company,
        r.site,
        r.arrived,
        r.departed ?? 'still there',
        r.classification,
        r.days,
      ]),
    );
  });

  // Report Builder
  route('GET', `${BASE}/definitions`, (req) =>
    json(
      listRows(definitions().map(definitionRow), req.query, {
        search: (r) => [r.name, r.includes],
        defaultSort: 'name:asc',
      }),
    ),
  );
  route('GET', `${BASE}/definitions/count`, (req) =>
    json({
      rows: pobPeople().filter((p) =>
        matchesDefinition(p, {
          zone: req.query.get('zone') ?? '',
          asset: req.query.get('asset') ?? '',
          crewType: req.query.get('crewType') ?? '',
          category: req.query.get('category') ?? '',
          gender: req.query.get('gender') ?? '',
        }),
      ).length,
    }),
  );
  route('POST', `${BASE}/definitions`, (req) =>
    json(insert(DEFS, { id: newId(), isActive: true, ...definitionFrom(bodyOf(req)) }), 201),
  );
  route('PUT', `${BASE}/definitions/:id`, (req) => {
    const row = find<ReportDefinition>(DEFS, req.params.id ?? '');
    if (!row) return notFound('report');
    return json(replace(DEFS, { ...row, ...definitionFrom(bodyOf(req)) }));
  });
  for (const [action, isActive] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${BASE}/definitions/:id/${action}`, (req) => {
      const row = find<ReportDefinition>(DEFS, req.params.id ?? '');
      if (!row) return notFound('report');
      return json(replace(DEFS, { ...row, isActive }));
    });
    route('POST', `${BASE}/schedules/:id/${action}`, (req) => {
      const row = find<ReportSchedule>(SCHEDULES, req.params.id ?? '');
      if (!row) return notFound('schedule');
      return json(replace(SCHEDULES, { ...row, isActive }));
    });
  }
  route('GET', `${BASE}/definitions/:id/rows`, (req) => {
    const def = find<ReportDefinition>(DEFS, req.params.id ?? '');
    if (!def) return notFound('report');
    return json(
      listRows(
        pobPeople().filter((p) => matchesDefinition(p, def)),
        req.query,
        PEOPLE_SPEC,
      ),
    );
  });
  route('GET', `${BASE}/definitions/:id/export`, (req) => {
    const def = find<ReportDefinition>(DEFS, req.params.id ?? '');
    if (!def) return notFound('report');
    const rows = pobPeople().filter((p) => matchesDefinition(p, def));
    const file = def.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return csv(file, PERSON_HEADER, rows.map(personCells));
  });

  // Report Scheduler
  route('GET', `${BASE}/schedules`, (req) => {
    const names = new Map(definitions().map((d) => [d.id, d.name]));
    const rows = schedules().map((s) => ({ ...s, report: names.get(s.reportId) ?? s.reportId }));
    return json(
      listRows(rows, req.query, {
        search: (r) => [r.report, r.frequency, ...r.recipients],
        defaultSort: 'report:asc',
      }),
    );
  });
  route('POST', `${BASE}/schedules`, (req) =>
    json(insert(SCHEDULES, { id: newId(), isActive: true, ...scheduleFrom(bodyOf(req)) }), 201),
  );
  route('PUT', `${BASE}/schedules/:id`, (req) => {
    const row = find<ReportSchedule>(SCHEDULES, req.params.id ?? '');
    if (!row) return notFound('schedule');
    return json(replace(SCHEDULES, { ...row, ...scheduleFrom(bodyOf(req)) }));
  });
}
