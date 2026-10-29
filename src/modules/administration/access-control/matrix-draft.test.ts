import { describe, expect, it } from 'vitest';
import {
  bodyOf,
  type Draft,
  sameDraft,
  setCapability,
  setModule,
  toggleRight,
} from './matrix-draft';

const EMPTY: Draft = { modules: { pob: false }, pages: {}, capabilities: {} };
const ALL = ['view', 'create', 'edit', 'deactivate', 'delete', 'export'] as const;

describe('PROMPT-2.7 editing a role on the matrix', () => {
  it('brings View with any right, and takes everything with View', () => {
    let d = toggleRight(EMPTY, 'admin.zones', 'edit', true, { available: ALL, adminTier: false });
    expect(d.pages['admin.zones']).toEqual(['view', 'edit']);
    d = toggleRight(d, 'admin.zones', 'export', true, { available: ALL, adminTier: false });
    d = toggleRight(d, 'admin.zones', 'edit', false, { available: ALL, adminTier: false });
    expect(d.pages['admin.zones']).toEqual(['view', 'export']);
    d = toggleRight(d, 'admin.zones', 'view', false, { available: ALL, adminTier: false });
    expect(d.pages).toEqual({});
  });

  it('keeps delete and reopen to the admin tier, and rights to those the page has', () => {
    const d = toggleRight(EMPTY, 'admin.zones', 'delete', true, {
      available: ALL,
      adminTier: false,
    });
    expect(d).toBe(EMPTY);
    const reopen = toggleRight(EMPTY, 'admin.zones', 'reopen', true, {
      available: ALL,
      adminTier: true,
    });
    expect(reopen).toBe(EMPTY);
    expect(
      toggleRight(EMPTY, 'admin.zones', 'delete', true, { available: ALL, adminTier: true }).pages[
        'admin.zones'
      ],
    ).toEqual(['view', 'delete']);
  });

  it('BRD-D.3.1.7 lets a role outside the admin tier take delete where the page opens it', () => {
    const opened = { available: ALL, adminTier: false, openRights: ['delete'] as const };
    expect(
      toggleRight(EMPTY, 'admin.resource-categories', 'delete', true, opened).pages[
        'admin.resource-categories'
      ],
    ).toEqual(['view', 'delete']);
    expect(toggleRight(EMPTY, 'admin.zones', 'delete', true, { ...opened, openRights: [] })).toBe(
      EMPTY,
    );
  });

  it('switches modules and grants capabilities, and says whether anything changed', () => {
    let d = setModule(EMPTY, 'pob', true);
    d = setCapability(d, 'dispatch.offload', ['b', 'a']);
    expect(bodyOf(d)).toEqual({
      modules: { pob: true },
      pages: {},
      capabilities: [{ key: 'dispatch.offload', locationIds: ['b', 'a'] }],
    });
    expect(sameDraft(d, setCapability(d, 'dispatch.offload', ['a', 'b']))).toBe(true);
    expect(sameDraft(d, setCapability(d, 'dispatch.offload', undefined))).toBe(false);
    expect(sameDraft(EMPTY, d)).toBe(false);
  });
});
