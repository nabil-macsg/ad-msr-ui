import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary:
          'border border-secondary-border bg-secondary text-on-secondary hover:bg-secondary-hover hover:text-ink',
        ghost: 'text-ink-secondary hover:bg-surface-muted hover:text-ink',
        link: 'min-h-0 px-0 font-medium text-link underline-offset-4 hover:underline',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary' },
  },
);
