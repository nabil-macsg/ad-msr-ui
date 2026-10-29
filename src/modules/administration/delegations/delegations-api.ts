import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type Delegation = components['schemas']['Delegation'];
export type Person = components['schemas']['PeopleMatches']['items'][number];

export const DELEGATIONS_KEY = ['access', 'delegations'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

/** People to delegate to: my own search, or the administrators' (every active person). */
export async function searchPeople(scope: 'mine' | 'admin', q: string): Promise<Person[]> {
  const result =
    scope === 'mine'
      ? await api.GET('/api/v1/me/people', { params: { query: { q } } })
      : await api.GET('/api/v1/access/delegations/people', { params: { query: { q } } });
  return unwrap(result).items;
}

export interface DelegationInput {
  readonly delegatorUserId?: string;
  readonly delegateUserId: string;
  readonly moduleKeys: components['schemas']['CreateDelegation']['moduleKeys'];
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
}

export async function createDelegation(input: DelegationInput): Promise<Delegation> {
  const { delegatorUserId, ...rest } = input;
  if (delegatorUserId) {
    return unwrap(
      await api.POST('/api/v1/access/delegations', { body: { ...rest, delegatorUserId } }),
    );
  }
  return unwrap(await api.POST('/api/v1/me/delegations', { body: rest }));
}

export async function amendDelegation(
  delegation: Delegation,
  body: components['schemas']['AmendDelegation'],
): Promise<Delegation> {
  return unwrap(
    await api.PATCH('/api/v1/access/delegations/{id}', {
      params: { path: { id: delegation.id }, header: ifMatch(delegation.version) },
      body,
    }),
  );
}

export async function revokeDelegation(delegation: Delegation, reason: string): Promise<void> {
  unwrap(
    await api.POST('/api/v1/access/delegations/{id}/revoke', {
      params: { path: { id: delegation.id }, header: ifMatch(delegation.version) },
      body: { reason },
    }),
  );
}

/** GST wall-clock input (`YYYY-MM-DDTHH:mm`) as an instant. */
export const fromGstInput = (value: string): string => new Date(`${value}:00+04:00`).toISOString();
/** An instant as a GST wall-clock input value. */
export const toGstInput = (iso: string): string =>
  new Date(new Date(iso).getTime() + 4 * 3600_000).toISOString().slice(0, 16);
