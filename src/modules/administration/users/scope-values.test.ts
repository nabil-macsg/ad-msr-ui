import { describe, expect, it } from 'vitest';
import { cleanScope, defaultScope, scopeOf } from './scope-values';

const Z = '00000000-0000-4000-8000-0000000000a1';

describe('PROMPT-2.7 scope values for the editor', () => {
  it('drops empty lists and cleared flags, so the API sees an explicit scope', () => {
    expect(
      cleanScope({ allLocations: undefined, zoneIds: [], locationIds: [Z], self: undefined }),
    ).toEqual({ locationIds: [Z] });
  });

  it('turns a summary back into ids', () => {
    expect(
      scopeOf({
        allLocations: false,
        zones: [{ id: Z, code: 'DAS', name: 'Das Island' }],
        locations: [],
        serviceProvider: { id: Z, code: 'FAL', name: 'Falcon Aviation' },
        departments: [],
        moduleKeys: ['pob'],
        self: true,
        lineManagerOf: false,
      }),
    ).toEqual({ zoneIds: [Z], serviceProviderId: Z, moduleKeys: ['pob'], self: true });
  });

  it('starts a platform role everywhere and a self role on own records', () => {
    expect(defaultScope('platform')).toEqual({ allLocations: true });
    expect(defaultScope('self')).toEqual({ self: true });
    expect(defaultScope('zone')).toEqual({});
  });
});
