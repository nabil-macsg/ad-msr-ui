import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can, type Right } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { AuditTrail } from '../../../shared/audit/audit-trail';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { Drawer } from '../../../shared/ui/drawer';
import { SelectField } from '../../../shared/ui/field';
import { ProvenanceChip } from '../../../shared/ui/provenance-chip';
import { Spinner } from '../../../shared/ui/spinner';
import { StatusPill } from '../../../shared/ui/status-pill';
import { AccessChangeDialog } from './AccessChangeDialog';
import { AssignmentForm } from './AssignmentForm';
import { formatDay, PROVENANCE, STATUS_TONE, useScopeText } from './user-text';
import {
  type RoleAssignment,
  type UserDetail,
  userHistory,
  USERS_KEY,
  useUser,
  useUserMutations,
} from './users-api';

type Dialog =
  | { kind: 'deactivate' | 'reactivate' | 'invite' | 'tier' }
  | { kind: 'revoke'; assignment: RoleAssignment }
  | { kind: 'assignment'; assignment: RoleAssignment | null };

const STATE_TONE = { active: 'success', scheduled: 'info', expired: 'neutral' } as const;

/** A user in the edit drawer (spec 10 §2.1): profile from the source, roles and scope, status. */
export function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useUser(userId);
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={user.data?.displayName ?? t('users.title')}
      {...(user.data ? { description: user.data.email } : {})}
    >
      {user.isPending && <Spinner label={t('loading')} />}
      {user.isError && <Banner tone="danger">{user.error.message}</Banner>}
      {user.data && <UserPanel user={user.data} />}
    </Drawer>
  );
}

function UserPanel({ user }: { user: UserDetail }) {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const scopeText = useScopeText();
  const mutations = useUserMutations();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const allowed = (right: Right) => !user.isSelf && can(access, 'admin.users', right);
  const close = () => setDialog(null);
  const deactivated = user.status === 'deactivated';

  const facts: [string, string | null][] = [
    [t('users.drawer.organisation'), user.organisation],
    [t('users.drawer.department'), user.person.department],
    [t('users.drawer.designation'), user.person.designation],
    [t('users.drawer.lineManager'), user.person.lineManager],
    [t('users.drawer.hsePassport'), user.person.hsePassportNo],
    [t('users.drawer.signIn'), t(`users.signIn.${user.signIn}`)],
    [
      t('users.drawer.lastSignIn'),
      user.lastSignInAt ? formatGst(user.lastSignInAt) : t('users.never'),
    ],
    [t('users.drawer.invitedAt'), user.invitedAt ? formatGst(user.invitedAt) : null],
    [
      t('users.drawer.approvalTier'),
      user.approvalTier === null ? t('users.drawer.noTier') : String(user.approvalTier),
    ],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={STATUS_TONE[user.status]}>{t(`users.status.${user.status}`)}</StatusPill>
        <span className="text-sm text-ink-secondary">{user.personnelNo}</span>
        <ProvenanceChip
          source={PROVENANCE[user.source]}
          {...(user.person.syncedAt ? { syncedAt: user.person.syncedAt } : {})}
        />
      </div>
      {user.isSelf && <Banner tone="info">{t('users.drawer.self')}</Banner>}
      {user.person.sourceStatus === 'left' && (
        <Banner tone="warning">
          {t('users.drawer.left', { source: t(`users.source.${user.source}`) })}
        </Banner>
      )}
      {deactivated && user.deactivatedReason && (
        <Banner tone="warning">
          {t('users.drawer.deactivated', { reason: user.deactivatedReason })}
        </Banner>
      )}

      <section aria-labelledby="user-profile" className="space-y-2">
        <h3 id="user-profile" className="text-base font-semibold text-ink">
          {t('users.drawer.profile')}
        </h3>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
          {facts
            .filter(([, value]) => value !== null)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-secondary">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        {allowed('edit') && !deactivated && (
          <Button onClick={() => setDialog({ kind: 'assignment', assignment: null })}>
            {t('users.drawer.addRole')}
          </Button>
        )}
        {allowed('edit') && user.isExternal && user.status === 'invited' && (
          <Button variant="secondary" onClick={() => setDialog({ kind: 'invite' })}>
            {user.invitedAt ? t('users.drawer.resend') : t('users.drawer.invite')}
          </Button>
        )}
        {allowed('edit') && (
          <Button variant="secondary" onClick={() => setDialog({ kind: 'tier' })}>
            {t('users.drawer.setTier')}
          </Button>
        )}
        {allowed('deactivate') &&
          (deactivated ? (
            <Button variant="secondary" onClick={() => setDialog({ kind: 'reactivate' })}>
              {t('users.drawer.reactivate')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setDialog({ kind: 'deactivate' })}>
              {t('users.drawer.deactivate')}
            </Button>
          ))}
      </div>

      <section aria-labelledby="user-roles" className="space-y-2">
        <h3 id="user-roles" className="text-base font-semibold text-ink">
          {t('users.drawer.roles')}
        </h3>
        {user.assignments.length === 0 && (
          <p className="text-sm text-ink-secondary">{t('users.drawer.noRoles')}</p>
        )}
        <ul className="space-y-3">
          {user.assignments.map((a) => (
            <li key={a.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{a.role.name}</p>
                <StatusPill tone={STATE_TONE[a.state]}>
                  {t(`users.drawer.state.${a.state}`)}
                </StatusPill>
              </div>
              <p className="text-sm text-ink">{scopeText(a.scope)}</p>
              <p className="text-xs text-ink-secondary">
                {t('users.drawer.validity', {
                  from: formatDay(a.validFrom),
                  until: a.validUntil ? formatDay(a.validUntil) : t('users.noExpiry'),
                })}{' '}
                · {t('users.drawer.reference', { ref: a.accessRequestRef })}
                {a.assignedBy && <> · {t('users.drawer.assignedBy', { name: a.assignedBy })}</>}
              </p>
              {allowed('edit') && (
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="ghost"
                    aria-label={`${t('users.drawer.edit')} ${a.role.name}`}
                    onClick={() => setDialog({ kind: 'assignment', assignment: a })}
                  >
                    {t('users.drawer.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`${t('users.drawer.revoke')} ${a.role.name}`}
                    onClick={() => setDialog({ kind: 'revoke', assignment: a })}
                  >
                    {t('users.drawer.revoke')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="user-history" className="space-y-2">
        <h3 id="user-history" className="text-base font-semibold text-ink">
          {t('users.drawer.history')}
        </h3>
        {historyOpen ? (
          <AuditTrail
            queryKey={[...USERS_KEY, user.id]}
            load={(cursor) => userHistory(user.id, cursor)}
          />
        ) : (
          <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
            {t('users.drawer.showHistory')}
          </Button>
        )}
      </section>

      {dialog?.kind === 'assignment' && (
        <AssignmentForm user={user} assignment={dialog.assignment} onClose={close} />
      )}
      <AccessChangeDialog
        open={dialog?.kind === 'deactivate'}
        onOpenChange={(open) => !open && close()}
        title={t('users.dialog.deactivateTitle', { name: user.displayName })}
        body={t('users.dialog.deactivateBody')}
        confirmLabel={t('users.drawer.deactivate')}
        tone="danger"
        onConfirm={(body) => mutations.deactivate.mutateAsync({ user, body })}
      />
      <AccessChangeDialog
        open={dialog?.kind === 'reactivate'}
        onOpenChange={(open) => !open && close()}
        title={t('users.dialog.reactivateTitle', { name: user.displayName })}
        body={t('users.dialog.reactivateBody')}
        confirmLabel={t('users.drawer.reactivate')}
        onConfirm={(body) => mutations.reactivate.mutateAsync({ user, body })}
      />
      <AccessChangeDialog
        open={dialog?.kind === 'invite'}
        onOpenChange={(open) => !open && close()}
        title={t('users.dialog.inviteTitle', { name: user.displayName })}
        body={t('users.dialog.inviteBody')}
        confirmLabel={t('users.drawer.invite')}
        requireReason={false}
        onConfirm={({ referenceId }) => mutations.invite.mutateAsync({ user, referenceId })}
      />
      {dialog?.kind === 'revoke' && (
        <AccessChangeDialog
          open
          onOpenChange={(open) => !open && close()}
          title={t('users.dialog.revokeTitle', { role: dialog.assignment.role.name })}
          body={t('users.dialog.revokeBody', { name: user.displayName })}
          confirmLabel={t('users.drawer.revoke')}
          tone="danger"
          onConfirm={(body) =>
            mutations.revoke.mutateAsync({ assignment: dialog.assignment, body })
          }
        />
      )}
      {dialog?.kind === 'tier' && <TierDialog user={user} onClose={close} />}
    </div>
  );
}

function TierDialog({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const { setApprovalTier } = useUserMutations();
  const [tier, setTier] = useState(user.approvalTier === null ? '' : String(user.approvalTier));
  return (
    <AccessChangeDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('users.dialog.tierTitle', { name: user.displayName })}
      body={t('users.dialog.tierBody')}
      confirmLabel={t('ui.save')}
      requireReason={false}
      onConfirm={({ referenceId }) =>
        setApprovalTier.mutateAsync({
          user,
          approvalTier: tier === '' ? null : Number(tier),
          referenceId,
        })
      }
    >
      <SelectField
        label={t('users.dialog.tier')}
        value={tier}
        onChange={(e) => setTier(e.target.value)}
      >
        <option value="">{t('users.drawer.noTier')}</option>
        {Array.from({ length: 9 }, (_, i) => String(i + 1)).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </SelectField>
    </AccessChangeDialog>
  );
}
