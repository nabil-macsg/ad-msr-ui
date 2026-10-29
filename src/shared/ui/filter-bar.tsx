import { Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { Input } from './field';

/** Search box (debounced) plus the page's filter controls, with Clear filters. */
export function FilterBar({
  q,
  onQChange,
  placeholder,
  children,
  activeCount = 0,
  onClear,
  debounceMs = 300,
}: {
  q: string;
  onQChange: (q: string) => void;
  placeholder?: string;
  children?: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  debounceMs?: number;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(q);
  const [synced, setSynced] = useState(q);
  if (q !== synced) {
    // The address changed (back button, Clear filters): show it.
    setSynced(q);
    setText(q);
  }
  useEffect(() => {
    if (text === q) return;
    const timer = window.setTimeout(() => onQChange(text.trim()), debounceMs);
    return () => window.clearTimeout(timer);
  }, [text, q, onQChange, debounceMs]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="relative min-w-60 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={t('ui.filter.search')}
          placeholder={placeholder ?? t('ui.filter.search')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="pl-9"
        />
      </div>
      {children}
      {onClear && (activeCount > 0 || q) && (
        <Button variant="ghost" onClick={onClear}>
          <X className="size-4" aria-hidden />
          {t('ui.filter.clear')}
        </Button>
      )}
    </div>
  );
}
