import { cn } from '../../shared/lib/cn';

export const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-left text-menu leading-snug transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-on-nav',
    isActive
      ? 'bg-nav-active font-medium text-nav-active-fg shadow-[inset_3px_0_0_var(--color-nav-indicator)]'
      : 'text-on-nav-muted hover:bg-nav-hover hover:text-on-nav',
  );

/** Navigation icons: 15 px, as in the reference sidebar. */
export const NAV_ICON = 'size-[15px] shrink-0';
