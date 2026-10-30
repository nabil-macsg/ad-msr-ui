import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangePasswordDialog } from '../../app/shell/ChangePasswordDialog';
import { useMe } from '../../app/session/queries';
import { formatGst, formatGstDate } from '../../shared/time/format';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { ProvenanceChip } from '../../shared/ui/provenance-chip';
import { Spinner } from '../../shared/ui/spinner';
import { StatusPill } from '../../shared/ui/status-pill';
import { DelegationForm } from '../administration/delegations/DelegationForm';
import type { Delegation } from '../administration/delegations/delegations-api';
import { PROVENANCE, useScopeText } from '../administration/users/user-text';
import {
  ACCOUNT_KEY,
  endMyDelegation,
  type MyDevice,
  myDelegations,
  myDevices,
  myPreferences,
  type Preferences,
  revokeMyDevice,
  savePreferences,
} from './account-api';

const CHANNELS = ['email', 'sms', 'push'] as const;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .join('');
const DELEGATION_TONE = {
  scheduled: 'info',
  active: 'success',
  expired: 'neutral',
  revoked: 'warning',
} as const;

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-card"
    >
      <div>
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {hint && <p className="text-sm text-ink-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * My account (spec 10 §1.5): profile from the source systems, roles and scope with their
 * validity, delegations given and received, app devices, notification preferences, and the
 * password for external users.
 */
export default function AccountPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const scopeText = useScopeText();
  const queryClient = useQueryClient();
  const delegations = useQuery({
    queryKey: [...ACCOUNT_KEY, 'delegations'],
    queryFn: myDelegations,
  });
  const devices = useQuery({ queryKey: [...ACCOUNT_KEY, 'devices'], queryFn: myDevices });
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<Delegation | null>(null);
  const [revoking, setRevoking] = useState<MyDevice | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY });

  if (!me) return <Spinner label={t('loading')} />;
  const lastDay = (validTo: string) => formatGstDate(new Date(new Date(validTo).getTime() - 1));
  const deviceName = (d: MyDevice) => d.model ?? d.platform;
  const locationAccess = me.roles.some((r) => r.scope.allLocations)
    ? t('account.everyLocation')
    : [...new Set(me.roles.map((r) => scopeText(r.scope)))].join('; ') || t('users.scope.none');
  const facts: [string, string | null][] = [
    [t('account.organisation'), me.company],
    [t('account.department'), me.department],
    [t('account.designation'), me.designation],
    [t('account.signIn'), t(`users.signIn.${me.authMethod}`)],
    [t('account.lastSignIn'), me.lastSignInAt ? formatGst(me.lastSignInAt) : t('account.never')],
  ];

  const delegationList = (items: readonly Delegation[], given: boolean) =>
    items.length === 0 ? (
      <p className="text-sm text-ink-secondary">{t('account.noDelegations')}</p>
    ) : (
      <ul className="divide-y divide-border">
        {items.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium text-ink">{given ? d.delegate.name : d.delegator.name}</p>
              <p className="text-xs text-ink-secondary">
                {d.moduleKeys?.join(', ') ?? t('account.allWorkflows')} ·{' '}
                {t('account.delegationPeriod', {
                  from: formatGst(d.startsAt),
                  to: formatGst(d.endsAt),
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill tone={DELEGATION_TONE[d.status]}>
                {t(`delegations.status.${d.status}`)}
              </StatusPill>
              {given && (d.status === 'active' || d.status === 'scheduled') && (
                <Button
                  variant="ghost"
                  aria-label={t('account.revokeDelegation', { name: d.delegate.name })}
                  onClick={() => setEnding(d)}
                >
                  {t('delegations.revoke')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="account-profile"
          className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-card lg:col-span-2"
        >
          <h2 id="account-profile" className="sr-only">
            {t('account.profile')}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-base font-semibold text-primary"
            >
              {initials(me.displayName)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-ink">{me.displayName}</p>
                <ProvenanceChip source={PROVENANCE[me.source]} />
              </div>
              <p className="text-sm text-ink-secondary">{me.email}</p>
            </div>
          </div>
          <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-secondary">{t('account.role')}</dt>
            <dd className="text-ink">
              {me.roles.length === 0 ? (
                t('account.noRoles')
              ) : (
                <ul>
                  {me.roles.map((role) => (
                    <li key={role.code}>
                      {role.name}
                      {role.validTo && (
                        <span className="ml-2 text-xs text-ink-secondary">
                          {t('account.until', { day: lastDay(role.validTo) })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt className="text-ink-secondary">{t('account.approvalTier')}</dt>
            <dd className="text-ink">
              {me.approvalTier === null
                ? t('account.notApprover')
                : t('account.tier', { tier: me.approvalTier })}
            </dd>
            <dt className="text-ink-secondary">{t('account.locationAccess')}</dt>
            <dd className="text-ink">{locationAccess}</dd>
            <dt className="text-ink-secondary">{t('account.personnelNo')}</dt>
            <dd className="text-ink">{me.personnelNo}</dd>
            {facts
              .filter(([, value]) => value !== null)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-secondary">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
          </dl>
          <p className="text-xs text-ink-muted">{t('account.profileHint')}</p>
        </section>

        <div className="space-y-6">
          <Section id="account-password" title={t('account.password')}>
            <p className="text-sm text-ink-secondary">
              {me.isExternal ? t('account.passwordHint') : t('account.passwordSso')}
            </p>
            <div>
              <Button variant="secondary" onClick={() => setChangingPassword(true)}>
                {t('account.changePassword')}
              </Button>
            </div>
          </Section>
          <Section id="account-wrong" title={t('account.somethingWrong')}>
            <p className="text-sm text-ink-secondary">{t('account.somethingWrongBody')}</p>
          </Section>
        </div>
      </div>

      <Section id="account-delegations" title={t('account.delegations')}>
        {!me.isExternal && (
          <div>
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              {t('account.newDelegation')}
            </Button>
          </div>
        )}
        {delegations.isPending && <Spinner label={t('loading')} />}
        {delegations.data && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">{t('account.given')}</h3>
              {delegationList(delegations.data.given, true)}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">{t('account.received')}</h3>
              {delegationList(delegations.data.received, false)}
            </div>
          </div>
        )}
      </Section>

      <Section id="account-devices" title={t('account.devices')} hint={t('account.devicesHint')}>
        {devices.data?.length === 0 && (
          <p className="text-sm text-ink-secondary">{t('account.noDevices')}</p>
        )}
        <ul className="divide-y divide-border">
          {devices.data?.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-ink">
                  {deviceName(d)}
                  {d.current && (
                    <span className="ml-2 text-xs text-ink-secondary">
                      {t('account.thisDevice')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-secondary">
                  {t('account.lastSeen', { at: formatGst(d.lastSeenAt) })}
                </p>
              </div>
              {d.revokedAt ? (
                <StatusPill tone="neutral">{t('account.deviceRevoked')}</StatusPill>
              ) : (
                <Button
                  variant="ghost"
                  aria-label={t('account.revokeDevice', { device: deviceName(d) })}
                  onClick={() => setRevoking(d)}
                >
                  {t('delegations.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <PreferencesSection />

      {creating && (
        <DelegationForm
          scope="mine"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => {
          if (!open) setEnding(null);
        }}
        title={ending ? t('account.revokeDelegation', { name: ending.delegate.name }) : ''}
        body={t('delegations.revokeBody')}
        confirmLabel={t('delegations.revoke')}
        requireReason={false}
        onConfirm={async () => {
          if (!ending) return;
          await endMyDelegation(ending.id);
          await refresh();
        }}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={revoking ? t('account.revokeDeviceTitle', { device: deviceName(revoking) }) : ''}
        body={t('account.revokeDeviceBody')}
        confirmLabel={t('delegations.revoke')}
        requireReason={false}
        onConfirm={async () => {
          if (!revoking) return;
          await revokeMyDevice(revoking.id);
          await refresh();
        }}
      />
      {me.isExternal ? (
        <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
      ) : (
        <Modal
          open={changingPassword}
          onOpenChange={setChangingPassword}
          title={t('account.changePasswordTitle')}
          description={me.email}
        >
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-ink">{t('account.ssoTitle')}</h3>
            <p className="text-sm text-ink-secondary">{t('account.ssoBody')}</p>
          </div>
          <ModalFooter>
            <Button onClick={() => setChangingPassword(false)}>{t('ui.close')}</Button>
          </ModalFooter>
        </Modal>
      )}
    </section>
  );
}

function PreferencesSection() {
  const { t } = useTranslation();
  const preferences = useQuery({
    queryKey: [...ACCOUNT_KEY, 'preferences'],
    queryFn: myPreferences,
  });
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const current = draft ?? preferences.data;
  if (!current) return null;

  const toggle = (key: string, channel: (typeof CHANNELS)[number], on: boolean) =>
    setDraft({
      categories: current.categories.map((c) =>
        c.key === key ? { ...c, channels: { ...c.channels, [channel]: on } } : c,
      ),
    });

  const save = async () => {
    try {
      await savePreferences(current);
      setDraft(null);
      await preferences.refetch();
      setNotice({ tone: 'success', text: t('account.preferencesSaved') });
    } catch (error) {
      setNotice({
        tone: 'danger',
        text: error instanceof Error ? error.message : t('ui.confirm.failed'),
      });
    }
  };

  return (
    <Section
      id="account-preferences"
      title={t('account.preferences')}
      hint={t('account.preferencesHint')}
    >
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
      <table className="w-full text-sm">
        <caption className="sr-only">{t('account.preferences')}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 text-left font-semibold text-ink-secondary">
              {t('notificationsPage.category')}
            </th>
            {CHANNELS.map((channel) => (
              <th
                key={channel}
                scope="col"
                className="py-2 text-center font-semibold text-ink-secondary"
              >
                {t(`account.channel.${channel}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {current.categories.map((category) => (
            <tr key={category.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 text-left font-normal text-ink">
                {category.label}
                {category.mandatory && (
                  <span className="ml-2 text-xs text-ink-muted">{t('account.mandatory')}</span>
                )}
              </th>
              {CHANNELS.map((channel) => (
                <td key={channel} className="py-2 text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={category.channels[channel]}
                    disabled={category.mandatory}
                    aria-label={t('account.channelFor', {
                      channel: t(`account.channel.${channel}`),
                      category: category.label,
                    })}
                    onChange={(e) => toggle(category.key, channel, e.target.checked)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {draft && (
        <div>
          <Button onClick={() => void save()}>{t('account.savePreferences')}</Button>
        </div>
      )}
    </Section>
  );
}
