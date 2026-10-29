import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import type { components } from '../../api/schema';

export type Preferences = components['schemas']['NotificationPreferences'];
export type MyDevice = components['schemas']['Device'];

export const ACCOUNT_KEY = ['me', 'account'] as const;

export const myDelegations = async () => unwrap(await api.GET('/api/v1/me/delegations'));
export const myDevices = async () => unwrap(await api.GET('/api/v1/me/devices')).items;
export const myPreferences = async () =>
  unwrap(await api.GET('/api/v1/me/notification-preferences'));

export async function endMyDelegation(id: string): Promise<void> {
  unwrap(await api.DELETE('/api/v1/me/delegations/{id}', { params: { path: { id } } }));
}

export async function revokeMyDevice(id: string): Promise<void> {
  unwrap(await api.DELETE('/api/v1/me/devices/{id}', { params: { path: { id } } }));
}

export async function savePreferences(preferences: Preferences): Promise<Preferences> {
  return unwrap(
    await api.PUT('/api/v1/me/notification-preferences', {
      body: {
        categories: preferences.categories
          .filter((c) => !c.mandatory)
          .map((c) => ({ key: c.key, channels: c.channels })),
      },
    }),
  );
}
