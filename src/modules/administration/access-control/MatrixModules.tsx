import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/cn';
import type { RoleMatrix } from './matrix-api';
import { type Draft, RIGHTS, setModule, tierOnly, toggleRight } from './matrix-draft';

/**
 * One card per module: its switch, and its pages and forms × the rights (spec 10 §2.3). Rows
 * come from the registry, mobile features included.
 */
export function MatrixModules({
  matrix,
  draft,
  editable,
  onChange,
}: {
  matrix: RoleMatrix;
  draft: Draft;
  editable: boolean;
  onChange: (draft: Draft) => void;
}) {
  const { t } = useTranslation();
  const adminTier = matrix.role.isAdminTier;
  return (
    <div className="space-y-6">
      {matrix.modules.map((module) => {
        const enabled = draft.modules[module.key] ?? false;
        const titleId = `matrix-module-${module.key}`;
        return (
          <section
            key={module.key}
            aria-labelledby={titleId}
            className="rounded-lg border border-border bg-card shadow-card"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {t('matrix.module', { module: module.label })}
              </h2>
              <label className="flex min-h-touch items-center gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  role="switch"
                  className="size-5 accent-primary"
                  checked={enabled}
                  disabled={!editable}
                  aria-checked={enabled}
                  onChange={(e) => onChange(setModule(draft, module.key, e.target.checked))}
                />
                <span className="sr-only">
                  {t('matrix.moduleSwitch', { module: module.label })}
                </span>
                <span aria-hidden>{enabled ? t('matrix.on') : t('matrix.off')}</span>
              </label>
            </header>
            <div className="overflow-x-auto">
              <table className={cn('w-full border-collapse text-sm', !enabled && 'opacity-60')}>
                <caption className="sr-only">
                  {t('matrix.module', { module: module.label })}
                </caption>
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60">
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-semibold text-ink-secondary uppercase"
                    >
                      {t('matrix.page')}
                    </th>
                    {RIGHTS.map((right) => (
                      <th
                        key={right}
                        scope="col"
                        className="px-2 py-2 text-center text-xs font-semibold text-ink-secondary uppercase"
                      >
                        {t(`matrix.rights.${right}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {module.pages.map((page) => {
                    const granted = draft.pages[page.key] ?? [];
                    return (
                      <tr key={page.key} className="border-b border-border last:border-0">
                        <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                          <span className="font-medium">{page.label}</span>
                          <span className="ml-2 text-xs text-ink-muted">
                            {page.area}
                            {page.channel === 'mobile' && ` · ${t('matrix.app')}`}
                          </span>
                        </th>
                        {RIGHTS.map((right) => {
                          if (!page.available.includes(right)) {
                            return (
                              <td key={right} className="px-2 py-2 text-center text-ink-muted">
                                <span aria-hidden>—</span>
                                <span className="sr-only">{t('matrix.notApplicable')}</span>
                              </td>
                            );
                          }
                          const tierLocked = tierOnly(right, page.openRights) && !adminTier;
                          return (
                            <td key={right} className="px-2 py-2 text-center">
                              {tierLocked ? (
                                <Lock
                                  className="mx-auto size-3.5 text-ink-muted"
                                  aria-label={`${t('matrix.adminTierOnly')}: ${t(`matrix.rights.${right}`)}`}
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={granted.includes(right)}
                                  disabled={!editable}
                                  aria-label={t('matrix.rightFor', {
                                    right: t(`matrix.rights.${right}`),
                                    page: page.label,
                                  })}
                                  onChange={(e) =>
                                    onChange(
                                      toggleRight(draft, page.key, right, e.target.checked, {
                                        available: page.available,
                                        openRights: page.openRights,
                                        adminTier,
                                      }),
                                    )
                                  }
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
