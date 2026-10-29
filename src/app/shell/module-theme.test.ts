import { describe, expect, it } from 'vitest';
import { MODULE_NAV_THEME, moduleOfPath } from './module-theme';

describe('module navigation theme', () => {
  it('finds the registry module that owns a path', () => {
    expect(moduleOfPath('/admin/zones')).toBe('administration');
    expect(moduleOfPath('/scheduling/recurring')).toBe('people-logistics');
    expect(moduleOfPath('/booking/create')).toBe('people-logistics');
    expect(moduleOfPath('/pob/dashboard')).toBe('pob');
    expect(moduleOfPath('/helideck')).toBe('helideck');
    expect(moduleOfPath('/')).toBe('shared');
    expect(moduleOfPath('/no/such/page')).toBe('shared');
  });

  it('gives Administration its own chrome and every other module the default', () => {
    expect(MODULE_NAV_THEME.administration).toBe('admin');
    for (const [module, theme] of Object.entries(MODULE_NAV_THEME)) {
      if (module !== 'administration') expect(theme).toBe('lms');
    }
  });
});
