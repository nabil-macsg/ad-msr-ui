import { Search, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSearch } from '../../modules/home/home-api';
import { Spinner } from '../../shared/ui/spinner';

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** The header's search entry, shortcut `/` (spec 10 §1.3). */
export function SearchButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !typing(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex min-h-8 w-full max-w-72 items-center gap-2 rounded-lg bg-header-search px-3 py-1.5 text-left text-sm text-on-header-search transition-colors hover:bg-header-border focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Search className="size-[15px] shrink-0" aria-hidden />
          <span className="flex-1 truncate">{t('shell.search')}</span>
          <kbd className="rounded-sm border border-header-border bg-header px-1.5 font-mono text-xs">
            /
          </kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content className="fixed top-24 left-1/2 z-50 w-[min(40rem,90vw)] -translate-x-1/2 rounded-xl bg-card p-6 shadow-modal">
          <Dialog.Title className="sr-only">{t('shell.searchTitle')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('shell.search')}</Dialog.Description>
          <Dialog.Close
            className="absolute top-3 right-3 rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink-secondary"
            aria-label={t('ui.close')}
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>
          <SearchPanel onPick={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Results by kind, as the API groups them; each opens its page, and "See all" its list. */
function SearchPanel({ onPick }: { onPick: () => void }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [text]);
  const results = useSearch(q);
  const groups = results.data?.groups ?? [];

  return (
    <div className="space-y-4">
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
        {t('shell.searchTitle')}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="size-4 text-ink-muted" aria-hidden />
        <input
          id={inputId}
          type="search"
          autoFocus
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('shell.search')}
          className="min-h-touch flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </div>
      <div aria-live="polite" className="max-h-[60vh] space-y-4 overflow-y-auto">
        {q.length < 2 ? (
          <p className="text-sm text-ink-secondary">{t('search.hint')}</p>
        ) : results.isPending ? (
          <Spinner label={t('search.searching')} />
        ) : results.isError ? (
          <p className="text-sm text-danger-fg">{t('search.failed')}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-ink-secondary">{t('search.none', { q })}</p>
        ) : (
          groups.map((group) => {
            const label = t(`search.groups.${group.key as 'people'}`, { defaultValue: group.key });
            return (
              <section key={group.key} aria-label={label} className="space-y-1">
                <h3 className="text-xs font-semibold tracking-wide text-ink-secondary uppercase">
                  {label}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {group.items.map((hit) => (
                    <li key={hit.id}>
                      <Link
                        to={hit.link}
                        onClick={onPick}
                        className="block px-3 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="block text-sm font-medium text-ink">{hit.title}</span>
                        {hit.detail && (
                          <span className="block text-xs text-ink-secondary">{hit.detail}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                {group.more && (
                  <Link
                    to={group.link}
                    onClick={onPick}
                    className="inline-block text-sm font-semibold text-primary underline"
                  >
                    {t('search.seeAll', { group: label })}
                  </Link>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
