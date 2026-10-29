import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gstDayKey } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { Spinner } from '../../../shared/ui/spinner';
import { ScopeEditor } from './ScopeEditor';
import { cleanScope, defaultScope, scopeOf } from './scope-values';
import {
  type RoleAssignment,
  type RoleOption,
  type RoleScope,
  type UserDetail,
  useRoleOptions,
  useScopeOptions,
  useUserMutations,
} from './users-api';

/**
 * Adds a role to a user, or changes one: scope, validity and the access-request reference ID
 * (spec 10 §2.1). Only roles of the user's kind are offered: external roles for external users,
 * staff roles for staff (ADR-0048).
 */
export function AssignmentForm({
  user,
  assignment,
  onClose,
}: {
  user: UserDetail;
  /** null: a new role. */
  assignment: RoleAssignment | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const roles = useRoleOptions();
  const options = useScopeOptions();
  const { assign, updateAssignment } = useUserMutations();
  const [roleCode, setRoleCode] = useState(assignment?.role.code ?? '');
  const [scope, setScope] = useState<RoleScope>(assignment ? scopeOf(assignment.scope) : {});
  const [validFrom, setValidFrom] = useState(assignment?.validFrom ?? gstDayKey(new Date()));
  const [validUntil, setValidUntil] = useState(assignment?.validUntil ?? '');
  const [referenceId, setReferenceId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const held = new Set(
    user.assignments.filter((a) => a.state !== 'expired').map((a) => a.role.code),
  );
  const offered = (roles.data ?? []).filter(
    (r) => r.isExternal === user.isExternal && (assignment !== null || !held.has(r.code)),
  );
  // An existing assignment carries its role; it may no longer be offered (e.g. deactivated).
  const role: RoleOption | undefined =
    (roles.data ?? []).find((r) => r.code === roleCode) ??
    (assignment
      ? {
          ...assignment.role,
          description: '',
          maxHolders: null,
          holders: 0,
        }
      : undefined);
  const pending = assign.isPending || updateAssignment.isPending;

  const chooseRole = (code: string) => {
    setRoleCode(code);
    const next = roles.data?.find((r) => r.code === code);
    setScope(next ? defaultScope(next.scopeLevel) : {});
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    if (!role) {
      setProblem(t('users.assignment.choose'));
      return;
    }
    if (referenceId.trim() === '') {
      setProblem(t('users.dialog.referenceRequired'));
      return;
    }
    setProblem(null);
    const validity = { validFrom, validUntil: validUntil === '' ? null : validUntil };
    try {
      if (assignment) {
        await updateAssignment.mutateAsync({
          assignment,
          body: { scope: cleanScope(scope), ...validity, referenceId: referenceId.trim() },
        });
      } else {
        await assign.mutateAsync({
          userId: user.id,
          body: {
            roleCode,
            scope: cleanScope(scope),
            ...validity,
            referenceId: referenceId.trim(),
          },
        });
      }
      onClose();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  };

  return (
    <EntityFormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        assignment
          ? t('users.assignment.editTitle', { role: assignment.role.name, name: user.displayName })
          : t('users.assignment.newTitle', { name: user.displayName })
      }
      onSubmit={submit}
      submitting={pending}
      submitLabel={t('users.assignment.save')}
      error={failure ?? problem}
      size="lg"
    >
      {(roles.isPending || options.isPending) && <Spinner label={t('loading')} />}
      {!assignment && (
        <SelectField
          label={t('users.assignment.role')}
          value={roleCode}
          onChange={(e) => chooseRole(e.target.value)}
        >
          <option value="">{t('users.assignment.choose')}</option>
          {offered.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
              {r.maxHolders !== null
                ? ` — ${t('users.assignment.holders', { holders: r.holders, max: r.maxHolders })}`
                : ''}
            </option>
          ))}
        </SelectField>
      )}
      {role?.description && <p className="text-sm text-ink-secondary">{role.description}</p>}
      {role?.isAdminTier && <Banner tone="warning">{t('users.assignment.adminTier')}</Banner>}
      {role && options.data && (
        <ScopeEditor
          level={role.scopeLevel}
          external={role.isExternal}
          value={scope}
          options={options.data}
          onChange={setScope}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field
          type="date"
          label={t('users.assignment.validFrom')}
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          required
        />
        <Field
          type="date"
          label={t('users.assignment.validUntil')}
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          min={validFrom}
        />
      </div>
      <p className="-mt-2 text-xs text-ink-muted">{t('users.assignment.untilHint')}</p>
      <div className="space-y-1">
        <Field
          label={t('users.dialog.reference')}
          value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
          autoComplete="off"
          required
        />
        <p className="text-xs text-ink-muted">{t('users.dialog.referenceHint')}</p>
      </div>
    </EntityFormModal>
  );
}
