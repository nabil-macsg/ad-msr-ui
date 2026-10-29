import type { PageKey } from '../../../app/access/registry';
import type { AuditPage } from '../../../shared/audit/audit-trail';

/** What every master record carries (PROMPT §2.4, §2.16). */
export interface MasterRecord {
  readonly id: string;
  readonly version: number;
  readonly isActive: boolean;
  readonly deactivatedReason?: string | null;
}

export interface ListPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export type ApiQuery = Readonly<Record<string, string | number | boolean>>;

/**
 * A master's API, as its page uses it. Each master implements this with its typed client calls;
 * changes send the record's version as `If-Match`.
 */
export interface MasterResource<T extends MasterRecord> {
  /** The registry page; its rights decide every button and action. */
  readonly pageKey: PageKey;
  /** The query-cache key, e.g. `['masters', 'zones']`. */
  readonly queryKey: readonly string[];
  /** The API path of the list, e.g. `/api/v1/masters/zones`; exports are under `/export`. */
  readonly path: string;
  list(query: ApiQuery): Promise<ListPage<T>>;
  deactivate(record: T, reason: string): Promise<T>;
  reactivate(record: T, reason: string): Promise<T>;
  /** Admin tier only, logical (PROMPT §2.4). Omit for masters that are never deleted. */
  remove?(record: T, reason: string): Promise<void>;
  history(id: string, cursor: string | undefined): Promise<AuditPage>;
}
