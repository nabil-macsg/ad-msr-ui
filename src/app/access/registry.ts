import {
  MODULES,
  PAGES,
  RIGHTS,
  type ModuleKey,
  type PageKey as RegistryPageKey,
  type RegistryPage,
  type Right,
} from '../../api/registry.generated';
import type { components } from '../../api/schema';

export type { ModuleKey, Right };

/**
 * Demo: screens of the original ADNOC LMS demo that MASAR's registry has no page for. They join
 * the registry's pages so routes, menus and rights treat them alike.
 */
const DEMO_EXTRA = [
  {
    key: 'demo.admin-home',
    module: 'administration',
    area: 'ADMINISTRATION',
    label: 'Administration',
    route: '/admin',
    layout: 'admin',
  },
  {
    key: 'demo.reports-mode-analysis',
    module: 'reporting',
    area: 'REPORTING',
    label: 'Mode Analysis',
    route: '/reports/mode-analysis',
    layout: 'main',
  },
  {
    key: 'demo.helideck-test-checklist-builder',
    module: 'helideck',
    area: 'PLANNING',
    label: 'Test Checklist Builder',
    route: '/helideck/test-checklist-builder',
    layout: 'main',
  },
  {
    key: 'demo.helideck-inspections',
    module: 'helideck',
    area: 'EXECUTION',
    label: 'Inspections & Tests List',
    route: '/helideck/inspections',
    layout: 'main',
  },
  {
    key: 'demo.helideck-assessment-inspector',
    module: 'helideck',
    area: 'EXECUTION',
    label: 'Crew Assessment — Inspector',
    route: '/helideck/assessment-inspector',
    layout: 'main',
  },
  {
    key: 'demo.helideck-assessment-crew',
    module: 'helideck',
    area: 'EXECUTION',
    label: 'Crew Assessment (Crew View)',
    route: '/helideck/assessment-crew',
    layout: 'main',
  },
  {
    key: 'demo.maintenance',
    module: 'aviation-compliance',
    area: 'MAINTENANCE',
    label: 'Maintenance',
    route: '/maintenance',
    layout: 'main',
  },
  {
    key: 'demo.briefing',
    module: 'people-logistics',
    area: 'TERMINAL',
    label: 'Safety Briefing',
    route: '/dispatch/briefing',
    layout: 'main',
  },
] as const;
export type DemoPageKey = (typeof DEMO_EXTRA)[number]['key'];
export type PageKey = RegistryPageKey | DemoPageKey;

/** Demo route changes: `/` is the landing page, and menu pages need a route without parameters. */
const DEMO_ROUTES: Partial<Record<string, string>> = {
  home: '/dashboard',
  'terminal.boarding-pass': '/dispatch/boarding-pass',
  'asp.checklist': '/aviation/asp/checklist',
  'pob.asset': '/pob/asset',
};
export type MyAccess = components['schemas']['MyAccess'];
export type Me = components['schemas']['Me'];

export interface Page extends RegistryPage {
  readonly key: PageKey;
}

const DEMO_PAGES: readonly Page[] = [
  ...PAGES.map((p): Page => {
    const route = DEMO_ROUTES[p.key];
    return route ? { ...p, route } : p;
  }),
  ...DEMO_EXTRA.map((p): Page => ({
    ...p,
    channel: 'web',
    rights: RIGHTS,
    menu: true,
    heldBy: null,
  })),
];

const BY_KEY = new Map<PageKey, Page>(DEMO_PAGES.map((p) => [p.key, p]));

export function pageOf(key: PageKey): Page {
  const page = BY_KEY.get(key);
  if (!page) throw new Error(`Unknown page ${key}`);
  return page;
}

/** The web route of a registry page; links use this rather than literal paths. */
export function routeOf(key: PageKey, params: Record<string, string> = {}): string {
  const route = pageOf(key).route;
  if (route === null) throw new Error(`${key} has no web route`);
  return route.replace(/:([A-Za-z]+)/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? ''),
  );
}

export const WEB_PAGES: readonly Page[] = DEMO_PAGES.filter((p) => p.channel === 'web');

export const MODULE_SIDEBAR = new Map<ModuleKey, string>(MODULES.map((m) => [m.key, m.sidebar]));

/** Whether the user holds a right on a page (PROMPT §2.7). No entry means no access. */
export function can(access: MyAccess | undefined, key: PageKey, right: Right = 'view'): boolean {
  return access?.pages[key]?.includes(right) ?? false;
}
