import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODULES } from '../../../api/registry.generated';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field } from '../../../shared/ui/field';
import {
  createDelegation,
  type Delegation,
  type DelegationInput,
  fromGstInput,
  type Person,
} from './delegations-api';
import { PersonPicker } from './PersonPicker';

type ModuleKeys = NonNullable<DelegationInput['moduleKeys']>;

/**
 * A new delegation (BRD D.2.1.4): my own from My account, or an administrator's on someone's
 * behalf. Times are GST.
 */
export function DelegationForm({
  scope,
  onClose,
  onSaved,
}: {
  scope: 'mine' | 'admin';
  onClose: () => void;
  onSaved: (delegation: Delegation) => void;
}) {
  const { t } = useTranslation();
  const [delegator, setDelegator] = useState<Person | null>(null);
  const [delegate, setDelegate] = useState<Person | null>(null);
  const [allWorkflows, setAllWorkflows] = useState(true);
  const [modules, setModules] = useState<string[]>([]);
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (scope === 'admin' && !delegator) next.delegator = t('delegation.personRequired');
    if (!delegate) next.delegate = t('delegation.personRequired');
    if (!starts || !ends) next.period = t('delegation.periodRequired');
    if (reason.trim().length < 3) next.reason = t('delegation.reasonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || !delegate) return;
    setSaving(true);
    setFailure(null);
    try {
      const saved = await createDelegation({
        ...(scope === 'admin' && delegator ? { delegatorUserId: delegator.userId } : {}),
        delegateUserId: delegate.userId,
        moduleKeys: allWorkflows || modules.length === 0 ? null : (modules as ModuleKeys),
        startsAt: fromGstInput(starts),
        endsAt: fromGstInput(ends),
        reason: reason.trim(),
      });
      onSaved(saved);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityFormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('delegation.newTitle')}
      onSubmit={submit}
      submitting={saving}
      submitLabel={t('delegation.create')}
      error={failure}
      size="lg"
    >
      {scope === 'admin' && (
        <PersonPicker
          label={t('delegation.delegator')}
          scope="admin"
          value={delegator}
          onChange={setDelegator}
          error={errors.delegator}
        />
      )}
      <PersonPicker
        label={t('delegation.delegate')}
        scope={scope}
        value={delegate}
        onChange={setDelegate}
        error={errors.delegate}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{t('delegation.modules')}</legend>
        {[true, false].map((all) => (
          <label key={String(all)} className="flex min-h-9 items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="delegation-modules"
              className="size-4 accent-primary"
              checked={allWorkflows === all}
              onChange={() => setAllWorkflows(all)}
            />
            {all ? t('delegation.allWorkflows') : t('delegation.chooseModules')}
          </label>
        ))}
        {!allWorkflows && (
          <CheckboxList
            legend={t('delegation.chooseModules')}
            options={MODULES.map((m) => ({ value: m.key, label: m.label }))}
            selected={modules}
            onChange={setModules}
          />
        )}
      </fieldset>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          type="datetime-local"
          label={t('delegation.starts')}
          value={starts}
          onChange={(e) => setStarts(e.target.value)}
          error={errors.period}
        />
        <Field
          type="datetime-local"
          label={t('delegation.ends')}
          value={ends}
          min={starts}
          onChange={(e) => setEnds(e.target.value)}
        />
      </div>
      <Field
        label={t('delegation.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={errors.reason}
      />
    </EntityFormModal>
  );
}
