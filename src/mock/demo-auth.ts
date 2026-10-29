import type { Me, MyAccess, PageKey, Right } from '../app/access/registry';
import { RIGHTS } from '../api/registry.generated';
import { WEB_PAGES } from '../app/access/registry';

/**
 * Demo session only. The demo login (src/app/auth) opens the screens as one of these static
 * users; this tab's sessionStorage keeps which one (never a password), so closing the tab ends
 * it. There are no tokens or calls to the MASAR authentication service.
 */
const SESSION_KEY = 'masar-demo:session';
/** Fallback when storage is blocked (private windows): the session lasts until a reload. */
let inMemory: string | null = null;

export interface DemoPersona {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly me: Me;
  readonly access: MyAccess;
}

const scope = {
  allLocations: true,
  zones: [],
  locations: [],
  serviceProvider: null,
  departments: [],
  moduleKeys: null,
  self: false,
  lineManagerOf: false,
};

const person = (
  id: string,
  displayName: string,
  email: string,
  role: { code: string; name: string },
  extra: Partial<Me> = {},
): Me => ({
  id,
  displayName,
  email,
  isExternal: false,
  authMethod: 'sso',
  personnelNo: id.slice(-6),
  source: 'sap',
  company: 'ADNOC Offshore',
  department: 'Logistics',
  designation: role.name,
  approvalTier: null,
  lastSignInAt: '2026-10-27T05:30:00.000Z',
  roles: [{ ...role, validTo: null, scope }],
  ...extra,
});

const ALL_MODULES: MyAccess['modules'] = [
  'people-logistics',
  'pob',
  'helideck',
  'aviation-compliance',
  'reporting',
  'administration',
];

function access(rightsFor: (key: PageKey, module: string) => readonly Right[]): MyAccess {
  const pages: Record<string, Right[]> = {};
  for (const page of WEB_PAGES) {
    const rights = rightsFor(page.key, page.module);
    if (rights.length > 0) pages[page.key] = [...rights];
  }
  return { matrixVersion: 1, modules: ALL_MODULES, pages, capabilities: [] };
}

const VIEW: readonly Right[] = ['view', 'export'];
const EDIT: readonly Right[] = ['view', 'create', 'edit', 'export'];

export const PERSONAS: readonly DemoPersona[] = [
  {
    key: 'admin',
    title: 'Super Admin',
    summary: 'Every module and every Administration master, with all rights.',
    me: person(
      '00000000-0000-4000-8000-000000000001',
      'Mariam Al Hammadi',
      'm.alhammadi@masar.demo',
      { code: 'super-admin', name: 'Super Admin' },
      { department: 'IT & Digital', approvalTier: 5 },
    ),
    access: access(() => RIGHTS),
  },
  {
    key: 'planner',
    title: 'People Logistics Planner',
    summary: 'Scheduling, booking and dispatch; edits Fleet, Routes and Recurring Schedules.',
    me: person(
      '00000000-0000-4000-8000-000000000002',
      'Khalid Al Mazrouei',
      'k.almazrouei@masar.demo',
      { code: 'pl-power-user', name: 'People Logistics Power User' },
    ),
    access: access((key, module) => {
      if (module === 'people-logistics' || module === 'shared') return EDIT;
      if (['admin.fleet', 'admin.routes', 'admin.quotas'].includes(key)) return EDIT;
      if (module === 'administration')
        return key.startsWith('admin.') &&
          !key.startsWith('admin.access') &&
          key !== 'admin.users' &&
          key !== 'admin.roles'
          ? ['view']
          : [];
      return VIEW;
    }),
  },
  {
    key: 'viewer',
    title: 'Read-only Viewer',
    summary: 'Sees every screen; cannot create, edit or delete.',
    me: person(
      '00000000-0000-4000-8000-000000000003',
      'Fatima Al Suwaidi',
      'f.alsuwaidi@masar.demo',
      { code: 'viewer', name: 'Master Data Viewer' },
      { department: 'HSE' },
    ),
    access: access(() => ['view']),
  },
];

export function currentPersona(): DemoPersona | undefined {
  let key = inMemory;
  try {
    key = sessionStorage.getItem(SESSION_KEY) ?? inMemory;
  } catch {
    // Storage blocked: use the in-memory session.
  }
  return PERSONAS.find((p) => p.key === key);
}

export function signInAs(key: string): void {
  inMemory = key;
  try {
    sessionStorage.setItem(SESSION_KEY, key);
  } catch {
    // Storage blocked: the in-memory session is used.
  }
}

export function signOutDemo(): void {
  inMemory = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}
