import { ChevronDown, User } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { mainMenu } from '../access/menu';
import { useAuth } from '../auth/auth-context';
import { routeOf } from '../access/registry';
import { useMe, useMyAccess } from '../session/queries';
import { ChangePasswordDialog } from './ChangePasswordDialog';

const itemClass =
  'flex min-h-9 cursor-pointer items-center gap-2.5 px-4 text-sm text-ink-secondary outline-none data-[highlighted]:bg-surface-muted data-[highlighted]:text-ink';

/** Name, roles and email; My account, Delegation, Change password, Support, Administration, Sign out. */
export function UserMenu() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: access } = useMyAccess();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);
  if (!me) return null;
  const menu = mainMenu(access);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="flex min-h-touch items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-header-search focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={t('shell.userMenu')}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary">
            <User className="size-4" aria-hidden />
          </span>
          <span className="hidden text-left lg:block">
            <span className="block text-xs leading-tight font-medium text-on-header">
              {me.displayName}
            </span>
            <span className="block text-2xs leading-tight text-on-header-muted">
              {me.roles[0]?.name}
            </span>
          </span>
          <ChevronDown className="size-[13px] text-on-header-muted" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 w-72 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-overlay"
          >
            <div className="px-4 py-2">
              <p className="truncate text-sm font-medium text-ink">{me.displayName}</p>
              <p className="text-caption text-ink-secondary">
                {me.roles.map((r) => r.name).join(' · ')}
              </p>
              <p className="truncate text-caption text-ink-muted">{me.email}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className={itemClass} onSelect={() => navigate(routeOf('account'))}>
              {t('shell.myAccount')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => navigate(routeOf('account'))}>
              {t('shell.delegation')}
            </DropdownMenu.Item>
            {me.isExternal && (
              <DropdownMenu.Item className={itemClass} onSelect={() => setChangingPassword(true)}>
                {t('shell.changePassword')}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item className={itemClass} onSelect={() => navigate(routeOf('support'))}>
              {t('shell.support')}
            </DropdownMenu.Item>
            {menu.administration && (
              <DropdownMenu.Item
                className={itemClass}
                onSelect={() => navigate(menu.administration?.route ?? '/')}
              >
                {t('shell.administration')}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className={itemClass} onSelect={logout}>
              {t('shell.signOut')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {me.isExternal && (
        <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
      )}
    </>
  );
}
