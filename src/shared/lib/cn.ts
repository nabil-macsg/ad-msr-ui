import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The token theme's own font sizes and radius, so they are not mistaken for colours.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['caption', 'menu', 'kpi', 'kiosk', 'title', 'label'], radius: ['pill'] },
  },
});

/** Joins class names; later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
