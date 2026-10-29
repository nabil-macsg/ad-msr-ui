import type { TFunction } from 'i18next';
import type { components } from '../../../api/schema';

type Schemas = components['schemas'];
export type ResourceType = Schemas['ResourceType'];
export type ResourceTypeOptions = Schemas['ResourceTypeOptions'];
export type AircraftModel = Schemas['AircraftModel'];
export type FleetUnit = Schemas['FleetUnit'];
export type FleetOptions = Schemas['FleetOptions'];
export type Quota = Schemas['Quota'];
export type QuotaOptions = Schemas['QuotaOptions'];
export type SeatMap = NonNullable<ResourceType['seatMap']>;
export type AircraftModelOptions = Schemas['AircraftModelOptions'];
export type CategoryCode = ResourceType['category']['code'];
/** An active resource category, as a form's options carry it. */
export type CategoryOption = Schemas['ResourceCategoryOption'];

/** The seeded categories, translated where the master's name isn't at hand. */
const SEEDED = ['FIXED-WING', 'ROTARY-WING', 'MARINE'] as const;
const isSeeded = (code: string): code is (typeof SEEDED)[number] =>
  (SEEDED as readonly string[]).includes(code);

/** A resource category in words: its name in the master, else the seeded label, else its code. */
export function categoryText(
  t: TFunction,
  code: CategoryCode,
  categories?: readonly { code: string; name: string }[],
): string {
  const named = categories?.find((c) => c.code === code)?.name;
  if (named) return named;
  return isSeeded(code) ? t(`places.routes.category.${code}`) : code;
}

/** Filter choices for the categories in a form's options. */
export const categoryChoices = (categories: readonly CategoryOption[] | undefined) =>
  (categories ?? []).map((c) => ({ value: c.code, label: c.name }));

/** The options to offer: the active categories, plus the record's own if it's no longer active. */
export function categoryOptions(
  t: TFunction,
  categories: readonly CategoryOption[] | undefined,
  current?: { code: CategoryCode; name?: string } | null,
): { code: string; name: string }[] {
  const list = (categories ?? []).map((c) => ({ code: c.code, name: c.name }));
  return current && !list.some((c) => c.code === current.code)
    ? [{ code: current.code, name: current.name ?? categoryText(t, current.code) }, ...list]
    : list;
}

/** "13 × 4, aisle after 2". */
export const seatMapText = (t: TFunction, map: SeatMap) =>
  map.aisleAfter === null
    ? t('resources.types.seatMap', { rows: map.rows, seats: map.seatsPerRow })
    : t('resources.types.seatMapAisle', {
        rows: map.rows,
        seats: map.seatsPerRow,
        aisle: map.aisleAfter,
      });
