import { json } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, seed } from '../core/store';
import {
  APPROVALS_WAITING,
  DASHBOARD_APPROVALS,
  DASHBOARD_FLIGHTS,
  DASHBOARD_NOTICES,
  type FlightStatus,
  SUPPORT_CONTACTS,
  SUPPORT_GUIDES,
  SUPPORT_QUESTIONS,
  SUPPORT_TECHNICAL,
  type SupportContact,
  WAITLISTED_TODAY,
} from '../data/demo-core';
import { gstDate } from '../data/ids';

const BASE = '/api/v1/demo/core';
const CONTACTS = 'demo-core:support-contacts';

/** A flight has gone once it is closed for dispatch or further on. */
const GONE: ReadonlySet<FlightStatus> = new Set(['Arrived', 'Closed for Dispatch']);

function dashboard() {
  const flights = DASHBOARD_FLIGHTS;
  const gone = flights.filter((f) => GONE.has(f.status)).length;
  return {
    today: gstDate(),
    kpis: {
      approvals: APPROVALS_WAITING,
      departures: flights.length,
      gone,
      toGo: flights.length - gone,
      boarding: flights.filter((f) => f.status === 'Boarding').length,
      waitlisted: WAITLISTED_TODAY,
    },
    flights,
    approvals: {
      total: APPROVALS_WAITING,
      items: DASHBOARD_APPROVALS.map((a) => ({ ...a, date: gstDate(a.dayOffset) })),
    },
    notices: DASHBOARD_NOTICES,
  };
}

/** Mock API for the demo core screens (src/demo/core). */
export function registerDemoCore(): void {
  seed(CONTACTS, () => SUPPORT_CONTACTS.map((c) => ({ ...c })));

  route('GET', `${BASE}/dashboard`, () => json(dashboard()));

  route('GET', `${BASE}/support`, () =>
    json({ technical: SUPPORT_TECHNICAL, questions: SUPPORT_QUESTIONS, guides: SUPPORT_GUIDES }),
  );

  route('GET', `${BASE}/support/contacts`, (req) =>
    json(
      listRows(all<SupportContact>(CONTACTS), req.query, {
        search: (c) => [c.site, c.name, c.email],
        defaultSort: 'site:asc',
        hasActive: false,
      }),
    ),
  );
}
