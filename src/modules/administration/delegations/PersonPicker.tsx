import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/field';
import { type Person, searchPeople } from './delegations-api';

/** Finds an active person by name, email or personnel number (at least 2 characters). */
export function PersonPicker({
  label,
  scope,
  value,
  onChange,
  error,
}: {
  label: string;
  scope: 'mine' | 'admin';
  value: Person | null;
  onChange: (person: Person | null) => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(text.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [text]);
  const people = useQuery({
    queryKey: ['people', scope, q],
    queryFn: () => searchPeople(scope, q),
    enabled: value === null && q.length >= 2,
  });

  if (value) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <span className="text-sm text-ink">
            {value.email
              ? t('delegation.chosen', { name: value.name, email: value.email })
              : value.name}
          </span>
          <Button variant="ghost" onClick={() => onChange(null)}>
            {t('delegation.change')}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <Input
        id={id}
        type="search"
        placeholder={t('delegation.searchPeople')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger-fg">
          {error}
        </p>
      )}
      {people.data && people.data.length === 0 && (
        <p className="text-sm text-ink-secondary">{t('delegation.noMatches')}</p>
      )}
      {people.data && people.data.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
          {people.data.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                className="flex w-full min-h-10 flex-col items-start px-3 py-1 text-left text-sm hover:bg-surface-muted"
                aria-label={t('delegation.choose', { name: person.name })}
                onClick={() => onChange(person)}
              >
                <span className="font-medium text-ink">{person.name}</span>
                <span className="text-xs text-ink-secondary">
                  {person.email}
                  {person.organisation ? ` · ${person.organisation}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
