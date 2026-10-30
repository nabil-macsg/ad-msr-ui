import { describe, expect, it } from 'vitest';
import { accessWith } from '../../../test/render-app';
import { adminMenu, mainMenu } from './menu';
import { WEB_PAGES } from './registry';

describe('the sidebar follows the original demo menu, filtered by view rights', () => {
  it('PROMPT-2.7 shows only the groups and pages the access payload grants', () => {
    const menu = mainMenu(
      accessWith({ 'booking.dashboard': ['view'], 'booking.bookings': ['view', 'edit'] }),
    );
    expect(menu.groups.map((g) => g.label)).toEqual(['People Logistics']);
    expect(
      menu.groups[0]?.sections.map((s) => [s.area, s.items.map((i) => [i.label, i.route])]),
    ).toEqual([
      [
        'Booking',
        [
          ['Booking Dashboard', '/booking'],
          ['Bookings', '/booking/my-bookings'],
        ],
      ],
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

  it('keeps the original order: People Logistics (with Reporting), POB Tracking, Helideck', () => {
    const everything = Object.fromEntries(WEB_PAGES.map((p) => [p.key, ['view']]));
    const menu = mainMenu(accessWith(everything));
    expect(menu.groups.map((g) => g.label)).toEqual([
      'People Logistics',
      'POB Tracking',
      'Helideck Inspection & Tests',
    ]);
    expect(menu.groups[0]?.sections.map((s) => s.area)).toEqual([
      'Scheduling',
      'Booking',
      'Dispatch',
      'Terminal',
      'Reporting',
    ]);
    expect(menu.administration?.route).toBe('/admin');
  });

  it('Administration has its own groups, in the original order', () => {
    const access = accessWith({ 'admin.audit-log': ['view'], 'admin.users': ['view', 'edit'] });
    expect(adminMenu(access).map((s) => s.area)).toEqual(['Access Control', 'Governance']);
    expect(mainMenu(access).administration?.route).toBe('/admin/users');
  });

  it('PROMPT-4.2 sidebar entries never carry route parameters', () => {
    const everything = Object.fromEntries(WEB_PAGES.map((p) => [p.key, ['view']]));
    const menu = mainMenu(accessWith(everything));
    const routes = [
      ...menu.groups.flatMap((g) => g.sections.flatMap((s) => s.items.map((i) => i.route))),
      ...adminMenu(accessWith(everything)).flatMap((s) => s.items.map((i) => i.route)),
    ];
    expect(routes.length).toBeGreaterThan(90);
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
