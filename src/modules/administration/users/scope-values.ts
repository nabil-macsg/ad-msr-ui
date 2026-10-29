import type { RoleOption, RoleScope, ScopeSummary } from './users-api';

type Level = RoleOption['scopeLevel'];
/** A change to a scope: a key set to undefined is cleared. */
export type ScopePatch = { [K in keyof RoleScope]?: RoleScope[K] | undefined };

/** Drops empty lists and unset flags: the API refuses an empty list (a scope is explicit). */
export function cleanScope(scope: ScopePatch): RoleScope {
  const out: RoleScope = {};
  for (const [key, value] of Object.entries(scope)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    Object.assign(out, { [key]: value });
  }
  return out;
}

/** An assignment's scope as ids, from its summary (to edit it). */
export function scopeOf(summary: ScopeSummary): RoleScope {
  return cleanScope({
    ...(summary.allLocations ? { allLocations: true } : {}),
    zoneIds: summary.zones.map((z) => z.id),
    locationIds: summary.locations.map((l) => l.id),
    ...(summary.serviceProvider ? { serviceProviderId: summary.serviceProvider.id } : {}),
    departmentIds: summary.departments.map((d) => d.id),
    ...(summary.moduleKeys ? { moduleKeys: summary.moduleKeys } : {}),
    ...(summary.self ? { self: true } : {}),
    ...(summary.lineManagerOf ? { lineManagerOf: true } : {}),
  });
}

/** The scope a new assignment of this role starts with. */
export function defaultScope(level: Level): RoleScope {
  if (level === 'platform') return { allLocations: true };
  if (level === 'self') return { self: true };
  return {};
}
