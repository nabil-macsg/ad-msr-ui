import { useTranslation } from 'react-i18next';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { SelectField } from '../../../shared/ui/field';
import { cleanScope, type ScopePatch } from './scope-values';
import type { RoleOption, RoleScope, ScopeOptions } from './users-api';

type Level = RoleOption['scopeLevel'];

/**
 * Where a role applies (PROMPT §2.7): the controls the role's scope level needs. The API checks
 * the same rules (ADR-0048) and says what is missing.
 */
export function ScopeEditor({
  level,
  external,
  value,
  options,
  onChange,
}: {
  level: Level;
  external: boolean;
  value: RoleScope;
  options: ScopeOptions;
  onChange: (scope: RoleScope) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: ScopePatch) => onChange(cleanScope({ ...value, ...patch }));
  const places = level === 'module' || level === 'zone' || level === 'site' || level === 'platform';
  const zoneChoice = level === 'module' || level === 'zone' || level === 'site';
  const locationChoice = level === 'module' || level === 'site' || level === 'provider';
  const all = value.allLocations === true;
  const named = (items: readonly { id: string; code: string; name: string }[]) =>
    items.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }));

  return (
    <fieldset className="space-y-3 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-semibold text-ink">{t('users.assignment.scope')}</legend>
      <p className="text-xs text-ink-muted">{t(`users.assignment.levelHint.${level}`)}</p>
      {level === 'module' && (
        <CheckboxList
          legend={t('users.assignment.modules')}
          options={options.modules.map((m) => ({ value: m.key, label: m.label }))}
          selected={value.moduleKeys ?? []}
          onChange={(keys) => set({ moduleKeys: keys as RoleScope['moduleKeys'] })}
        />
      )}
      {places && (
        <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={all}
            disabled={level === 'platform'}
            onChange={(e) =>
              set(
                e.target.checked
                  ? { allLocations: true, zoneIds: [], locationIds: [] }
                  : { allLocations: undefined },
              )
            }
          />
          {t('users.assignment.allLocations')}
        </label>
      )}
      {zoneChoice && !all && (
        <CheckboxList
          legend={t('users.assignment.zones')}
          options={named(options.zones)}
          selected={value.zoneIds ?? []}
          onChange={(zoneIds) => set({ zoneIds })}
        />
      )}
      {locationChoice && !all && (
        <CheckboxList
          legend={t('users.assignment.locations')}
          options={named(options.locations)}
          selected={value.locationIds ?? []}
          onChange={(locationIds) => set({ locationIds })}
        />
      )}
      {(level === 'provider' || external) && (
        <SelectField
          label={t('users.assignment.provider')}
          value={value.serviceProviderId ?? ''}
          onChange={(e) =>
            set({ serviceProviderId: e.target.value === '' ? undefined : e.target.value })
          }
        >
          <option value="">{t('users.assignment.chooseProvider')}</option>
          {options.serviceProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </SelectField>
      )}
      {level === 'department' && (
        <CheckboxList
          legend={t('users.assignment.departments')}
          options={named(options.departments)}
          selected={value.departmentIds ?? []}
          onChange={(departmentIds) => set({ departmentIds })}
        />
      )}
      {level === 'self' && (
        <div className="space-y-1">
          {(['self', 'lineManagerOf'] as const).map((flag) => (
            <label key={flag} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={value[flag] === true}
                onChange={(e) => set({ [flag]: e.target.checked ? true : undefined })}
              />
              {t(`users.assignment.${flag}`)}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
