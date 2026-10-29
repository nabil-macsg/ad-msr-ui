import type { ListParams } from '../../../shared/lists/list-params';

/** Sets or clears one `filter[name]` of a list, keeping the others. */
export function setFilter(
  list: { params: ListParams; update: (patch: Partial<ListParams>) => void },
  name: string,
  value: string | undefined,
): void {
  const rest = Object.fromEntries(Object.entries(list.params.filters).filter(([k]) => k !== name));
  list.update({ filters: value ? { ...rest, [name]: value } : rest });
}
