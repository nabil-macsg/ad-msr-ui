import {
  type ModuleKey,
  MODULE_SIDEBAR,
  type MyAccess,
  type Page,
  can,
  WEB_PAGES,
} from './registry';

export interface MenuItem {
  readonly key: Page['key'];
  readonly label: string;
  readonly route: string;
}
export interface MenuSection {
  readonly area: string;
  readonly items: readonly MenuItem[];
}
export interface MenuGroup {
  readonly module: ModuleKey;
  readonly label: string;
  readonly sections: readonly MenuSection[];
}

/** Sidebar order (PROMPT §4.2). */
const MAIN_GROUPS: readonly ModuleKey[] = [
  'people-logistics',
  'pob',
  'helideck',
  'aviation-compliance',
  'reporting',
];

/** The admin sidebar's groups, in order (PROMPT §4.2). */
export const ADMIN_AREAS = [
  'ACCESS CONTROL',
  'ENGINES',
  'GOVERNANCE',
  'SHARED MASTERS',
  'PEOPLE LOGISTICS',
  'POB TRACKING',
  'HELIDECK',
  'AVIATION COMPLIANCE',
] as const;

const item = (p: Page): MenuItem => ({ key: p.key, label: p.label, route: p.route ?? '/' });

/** Visible menu pages: on the web, in the sidebar, and viewable by this user. */
function visible(access: MyAccess | undefined, filter: (p: Page) => boolean): Page[] {
  return WEB_PAGES.filter((p) => p.menu && filter(p) && can(access, p.key));
}

function sections(pages: readonly Page[], order?: readonly string[]): MenuSection[] {
  const byArea = new Map<string, MenuItem[]>();
  for (const p of pages) byArea.set(p.area, [...(byArea.get(p.area) ?? []), item(p)]);
  const areas = order ? order.filter((a) => byArea.has(a)) : [...byArea.keys()];
  return areas.map((area) => ({ area, items: byArea.get(area) ?? [] }));
}

export interface MainMenu {
  readonly home: MenuItem | null;
  readonly groups: readonly MenuGroup[];
  readonly support: MenuItem | null;
  /** The first administration page this user may open, if any. */
  readonly administration: MenuItem | null;
}

/** The main sidebar, generated from the registry and filtered by view rights. */
export function mainMenu(access: MyAccess | undefined): MainMenu {
  const shared = visible(access, (p) => p.module === 'shared');
  const groups = MAIN_GROUPS.flatMap((module): MenuGroup[] => {
    const pages = visible(access, (p) => p.module === module && p.layout === 'main');
    if (pages.length === 0) return [];
    return [{ module, label: MODULE_SIDEBAR.get(module) ?? module, sections: sections(pages) }];
  });
  const sharedItem = (key: Page['key']): MenuItem | null => {
    const page = shared.find((p) => p.key === key);
    return page ? item(page) : null;
  };
  return {
    home: sharedItem('home'),
    groups,
    support: sharedItem('support'),
    administration: adminMenu(access)[0]?.items[0] ?? null,
  };
}

/** The administration sidebar: its own groups, then "Back to MASAR". */
export function adminMenu(access: MyAccess | undefined): MenuSection[] {
  return sections(
    visible(access, (p) => p.module === 'administration'),
    ADMIN_AREAS,
  );
}
