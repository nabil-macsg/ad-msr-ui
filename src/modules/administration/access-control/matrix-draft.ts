import type { MatrixRight, RoleMatrix, SaveMatrix } from './matrix-api';

/** The matrix columns, in order (PROMPT §2.7). */
export const RIGHTS: readonly MatrixRight[] = [
  'view',
  'create',
  'edit',
  'deactivate',
  'delete',
  'export',
  'reopen',
];
/** Rights only admin-tier roles may hold. */
export const ADMIN_TIER_RIGHTS: readonly MatrixRight[] = ['delete', 'reopen'];

/** Is this right held by the admin tier only on a page that opens `openRights` to others? */
export const tierOnly = (right: MatrixRight, openRights: readonly MatrixRight[] = []) =>
  ADMIN_TIER_RIGHTS.includes(right) && !openRights.includes(right);

/** The role's grants while they are being edited. A capability present here is granted. */
export interface Draft {
  readonly modules: Readonly<Record<string, boolean>>;
  readonly pages: Readonly<Record<string, readonly MatrixRight[]>>;
  readonly capabilities: Readonly<Record<string, readonly string[] | null>>;
}

export function draftOf(matrix: RoleMatrix): Draft {
  return {
    modules: Object.fromEntries(matrix.modules.map((m) => [m.key, m.enabled])),
    pages: Object.fromEntries(
      matrix.modules
        .flatMap((m) => m.pages)
        .filter((p) => p.granted.length > 0)
        .map((p) => [p.key, p.granted]),
    ),
    capabilities: Object.fromEntries(
      matrix.capabilities.filter((c) => c.granted).map((c) => [c.key, c.locationIds]),
    ),
  };
}

/** What a save sends: the whole role, as edited. */
export function bodyOf(draft: Draft): SaveMatrix {
  return {
    modules: { ...draft.modules },
    pages: Object.fromEntries(Object.entries(draft.pages).map(([k, v]) => [k, [...v]])),
    capabilities: Object.entries(draft.capabilities).map(([key, ids]) => ({
      key,
      locationIds: ids === null ? null : [...ids],
    })),
  };
}

/**
 * Turns one right on or off. Any right brings View; taking View away takes everything away;
 * delete and reopen stay off for roles outside the admin tier (PROMPT §2.7), unless the page
 * opens them (`openRights`, from the API).
 */
export function toggleRight(
  draft: Draft,
  pageKey: string,
  right: MatrixRight,
  on: boolean,
  options: {
    available: readonly MatrixRight[];
    adminTier: boolean;
    openRights?: readonly MatrixRight[];
  },
): Draft {
  if (!options.available.includes(right)) return draft;
  if (on && tierOnly(right, options.openRights) && !options.adminTier) return draft;
  const current = new Set(draft.pages[pageKey] ?? []);
  if (on) {
    current.add(right);
    current.add('view');
  } else if (right === 'view') {
    current.clear();
  } else {
    current.delete(right);
  }
  const rights = RIGHTS.filter((r) => current.has(r));
  const others = Object.fromEntries(Object.entries(draft.pages).filter(([k]) => k !== pageKey));
  return { ...draft, pages: rights.length === 0 ? others : { ...others, [pageKey]: rights } };
}

export function setModule(draft: Draft, key: string, enabled: boolean): Draft {
  return { ...draft, modules: { ...draft.modules, [key]: enabled } };
}

/** Grants (locations: null for everywhere) or removes (undefined) a capability. */
export function setCapability(
  draft: Draft,
  key: string,
  grant: readonly string[] | null | undefined,
): Draft {
  const others = Object.fromEntries(Object.entries(draft.capabilities).filter(([k]) => k !== key));
  return { ...draft, capabilities: grant === undefined ? others : { ...others, [key]: grant } };
}

export function sameDraft(a: Draft, b: Draft): boolean {
  const canonical = (d: Draft) =>
    JSON.stringify({
      modules: Object.entries(d.modules).sort(),
      pages: Object.entries(d.pages).sort(),
      capabilities: Object.entries(d.capabilities)
        .map(([k, v]) => [k, v === null ? null : [...v].sort()])
        .sort(),
    });
  return canonical(a) === canonical(b);
}
