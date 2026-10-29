import { useTranslation } from 'react-i18next';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import type { RoleMatrix } from './matrix-api';
import { type Draft, setCapability } from './matrix-draft';

/** Role × capability, with an optional location restriction per grant (BRD A.4.4.1). */
export function MatrixCapabilities({
  matrix,
  draft,
  editable,
  locations,
  onChange,
}: {
  matrix: RoleMatrix;
  draft: Draft;
  editable: boolean;
  locations: readonly { id: string; code: string; name: string }[];
  onChange: (draft: Draft) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-3">
      {matrix.capabilities.map((capability) => {
        const grant = draft.capabilities[capability.key];
        const granted = grant !== undefined;
        const restricted = Array.isArray(grant);
        return (
          <li
            key={capability.key}
            className="rounded-md border border-border bg-card p-4 shadow-card"
          >
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={granted}
                disabled={!editable}
                onChange={(e) =>
                  onChange(
                    setCapability(draft, capability.key, e.target.checked ? null : undefined),
                  )
                }
              />
              <span>
                <span className="block font-medium text-ink">{capability.label}</span>
                <span className="block text-sm text-ink-secondary">{capability.description}</span>
              </span>
            </label>
            {granted && capability.locationScoped && (
              <fieldset className="mt-3 space-y-2 pl-7">
                <legend className="sr-only">
                  {t('matrix.capability.locations', { capability: capability.label })}
                </legend>
                {(['everywhere', 'only'] as const).map((mode) => (
                  <label key={mode} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name={`capability-${capability.key}`}
                      className="size-4 accent-primary"
                      checked={mode === 'only' ? restricted : !restricted}
                      disabled={!editable}
                      onChange={() =>
                        onChange(
                          setCapability(
                            draft,
                            capability.key,
                            mode === 'only' ? (locations[0] ? [locations[0].id] : null) : null,
                          ),
                        )
                      }
                    />
                    {t(`matrix.capability.${mode}`)}
                  </label>
                ))}
                {restricted && (
                  <CheckboxList
                    legend={t('matrix.capability.locations', { capability: capability.label })}
                    options={locations.map((l) => ({
                      value: l.id,
                      label: `${l.name} (${l.code})`,
                    }))}
                    selected={grant}
                    onChange={(ids) =>
                      onChange(setCapability(draft, capability.key, ids.length > 0 ? ids : null))
                    }
                  />
                )}
              </fieldset>
            )}
          </li>
        );
      })}
    </ul>
  );
}
