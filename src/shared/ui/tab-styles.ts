/**
 * Underlined page tabs, shared by Radix tabs (`data-state=active`) and toggle buttons
 * (`aria-pressed`): a soft hover, and a rounded brand-colour bar that grows in under the active
 * tab. Class names stay literal so Tailwind finds them.
 */
export const TAB_LIST = 'flex max-w-full gap-1 overflow-x-auto border-b border-border';

export const TAB =
  'relative inline-flex min-h-touch shrink-0 items-center gap-2 rounded-t-lg px-4 text-sm font-medium whitespace-nowrap text-ink-secondary transition-colors ' +
  'hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ' +
  "after:pointer-events-none after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform after:duration-200 after:content-[''] " +
  'aria-pressed:font-semibold aria-pressed:text-primary aria-pressed:after:scale-x-100 ' +
  'data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:after:scale-x-100';
