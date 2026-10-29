import { useTranslation } from 'react-i18next';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { Field, SelectField } from '../../../shared/ui/field';
import {
  amountProblem,
  type ConditionDraft,
  type ConditionField,
  type ConditionsDraft,
  EMPTY_CONDITION,
} from './workflow-draft';

/**
 * The request fields a process offers (spec 10 §3.1), each with the control its type needs.
 * A request meets the conditions when it meets every one that is set.
 */
export function ConditionsEditor({
  legend,
  hint,
  fields,
  value,
  onChange,
}: {
  legend: string;
  hint: string;
  fields: readonly ConditionField[];
  value: ConditionsDraft;
  onChange: (value: ConditionsDraft) => void;
}) {
  const { t } = useTranslation();
  const draft = (key: string) => value[key] ?? EMPTY_CONDITION;
  const set = (key: string, patch: Partial<ConditionDraft>) =>
    onChange({ ...value, [key]: { ...draft(key), ...patch } });

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <p className="text-xs text-ink-muted">{hint}</p>
      {fields.length === 0 && (
        <p className="text-sm text-ink-secondary">{t('approvals.conditions.none')}</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => {
          const d = draft(field.key);
          switch (field.type) {
            case 'choice':
              return (
                <CheckboxList
                  key={field.key}
                  legend={field.label}
                  hint={t('approvals.conditions.anyIfNone')}
                  options={field.options ?? []}
                  selected={d.list}
                  onChange={(list) => set(field.key, { list })}
                />
              );
            case 'values':
              return (
                <div key={field.key} className="space-y-1">
                  <Field
                    label={field.label}
                    value={d.text}
                    onChange={(e) => set(field.key, { text: e.target.value })}
                  />
                  <p className="text-xs text-ink-muted">{t('approvals.conditions.valuesHint')}</p>
                </div>
              );
            case 'flag':
              return (
                <SelectField
                  key={field.key}
                  label={field.label}
                  value={d.flag}
                  onChange={(e) =>
                    set(field.key, { flag: e.target.value as ConditionDraft['flag'] })
                  }
                >
                  <option value="">{t('approvals.conditions.any')}</option>
                  <option value="yes">{t('approvals.conditions.yes')}</option>
                  <option value="no">{t('approvals.conditions.no')}</option>
                </SelectField>
              );
            case 'amount': {
              const problem = amountProblem(d);
              const unit = field.unit ?? '';
              return (
                <div key={field.key} className="grid grid-cols-2 gap-2">
                  <Field
                    label={t('approvals.conditions.min', { label: field.label, unit })}
                    inputMode="decimal"
                    value={d.min}
                    onChange={(e) => set(field.key, { min: e.target.value })}
                    error={problem ? t(`approvals.conditions.amount.${problem}`) : undefined}
                  />
                  <Field
                    label={t('approvals.conditions.max', { label: field.label, unit })}
                    inputMode="decimal"
                    value={d.max}
                    onChange={(e) => set(field.key, { max: e.target.value })}
                  />
                </div>
              );
            }
          }
        })}
      </div>
    </fieldset>
  );
}
