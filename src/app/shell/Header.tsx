import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { dayPart, firstName } from '../../shared/time/gst';
import { can, routeOf } from '../access/registry';
import { runtimeConfig } from '../config';
import { useMe, useMyAccess } from '../session/queries';
import { NotificationBell } from './NotificationBell';
import { SearchButton } from './SearchButton';
import { UserMenu } from './UserMenu';

/** Greeting (GST), search, the live bell, the AI button when enabled, and the user menu. */
export function Header() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: access } = useMyAccess();
  const aiEnabled = runtimeConfig().features.ai && can(access, 'ai.assistant');
  return (
    <header className="sticky top-[var(--preview-bar-h)] z-20 flex h-header items-center gap-5 border-b border-header-border bg-header px-6 text-on-header">
      <p className="hidden min-w-0 shrink-0 truncate text-xs font-semibold text-on-header-muted xl:block">
        {me && t(`greeting.${dayPart()}`, { name: firstName(me.displayName) })}
      </p>
      <span className="hidden h-5 w-px bg-header-border xl:block" aria-hidden />
      <div className="flex flex-1 justify-start">
        <SearchButton />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        {aiEnabled && (
          <Link
            to={routeOf('ai.assistant')}
            aria-label={t('shell.aiAssistant')}
            className="inline-flex size-touch items-center justify-center rounded-lg text-accent-fg hover:bg-accent-bg focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Sparkles className="size-[18px]" aria-hidden />
          </Link>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
