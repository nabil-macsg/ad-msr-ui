import { describe, expect, it } from 'vitest';
import { accessWith } from '../../../test/render-app';
import { ADMIN_AREAS, adminMenu, mainMenu } from './menu';
import { WEB_PAGES } from './registry';

describe('PROMPT-4.2 the sidebar is generated from the registry and view rights', () => {
  it('PROMPT-2.7 shows only the groups and pages the access payload grants', () => {
    const menu = mainMenu(
      accessWith({ 'booking.dashboard': ['view'], 'booking.bookings': ['view', 'edit'] }),
    );
    expect(menu.groups.map((g) => g.label)).toEqual(['PEOPLE LOGISTICS']);
    expect(menu.groups[0]?.sections).toEqual([
      {
        area: 'BOOKING',
        items: [
          { key: 'booking.dashboard', label: 'Booking Dashboard', route: '/booking' },
          { key: 'booking.bookings', label: 'Bookings', route: '/booking/my-bookings' },
        ],
      },
    ]);
    expect(menu.administration).toBeNull();
    expect(menu.home?.route).toBe('/dashboard');
  });

  it('PROMPT-2.7 a right other than view does not show a page', () => {
    const menu = mainMenu(accessWith({ 'pob.dashboard': ['export'] as never }));
    expect(menu.groups).toEqual([]);
  });

  it('PROMPT-2.7 a user with no rights sees no groups, no Home and no Administration', () => {
    const menu = mainMenu({ matrixVersion: 1, modules: [], pages: {}, capabilities: [] });
    expect(menu).toEqual({ home: null, groups: [], support: null, administration: null });
  });

  it('PROMPT-4.2 module groups keep the demo order whatever the grant order', () => {
    const menu = mainMenu(
      accessWith({
        'reports.executive-summary': ['view'],
        'pob.dashboard': ['view'],
        'scheduling.dashboard': ['view'],
      }),
    );
    expect(menu.groups.map((g) => g.module)).toEqual(['people-logistics', 'pob', 'reporting']);
  });

  it('PROMPT-4.2 Administration opens its own sidebar, grouped in the demo order', () => {
    const access = accessWith({
      'admin.audit-log': ['view'],
      'admin.users': ['view', 'edit'],
    });
    const sections = adminMenu(access);
    expect(sections.map((s) => s.area)).toEqual(['ACCESS CONTROL', 'GOVERNANCE']);
    expect(mainMenu(access).administration?.route).toBe('/admin/users');
    expect(ADMIN_AREAS).toContain('SHARED MASTERS');
  });

  it('PROMPT-4.2 sidebar entries are list pages, never detail routes with parameters', () => {
    const everything = Object.fromEntries(WEB_PAGES.map((p) => [p.key, ['view']]));
    const menu = mainMenu(accessWith(everything));
    const routes = [
      ...menu.groups.flatMap((g) => g.sections.flatMap((s) => s.items.map((i) => i.route))),
      ...adminMenu(accessWith(everything)).flatMap((s) => s.items.map((i) => i.route)),
    ];
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.filter((r) => r.includes(':'))).toEqual([]);
  });
});

describe('PROMPT-2.7 every web registry page has one route', () => {
  it('PROMPT-4.2 routes are present and unique', () => {
    const routes = WEB_PAGES.map((p) => p.route);
    expect(routes.every((r) => typeof r === 'string' && r.startsWith('/'))).toBe(true);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
