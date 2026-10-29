import {
  MODULES,
  PAGES,
  type ModuleKey,
  type PageKey,
  type RegistryPage,
  type Right,
} from '../../api/registry.generated';
import type { components } from '../../api/schema';

export type { ModuleKey, PageKey, Right };
export type MyAccess = components['schemas']['MyAccess'];
export type Me = components['schemas']['Me'];

export interface Page extends RegistryPage {
  readonly key: PageKey;
}

/** Demo: `/` is the public landing page, so Home lives at `/dashboard`. */
const DEMO_PAGES: readonly Page[] = PAGES.map((p) =>
  p.key === 'home' ? { ...p, route: '/dashboard' } : p,
);

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
