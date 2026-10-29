import type { VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { buttonVariants } from './button-variants';

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  block,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';
  return (
    <Component
      className={cn(buttonVariants({ variant, block }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}
