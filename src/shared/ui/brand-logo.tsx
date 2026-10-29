import { cn } from '../lib/cn';

/**
 * The ADNOC logo, extracted as vectors from the Energy for Life Visual Guidelines (pp. 6, 9). On a
 * dark or coloured field the cartouche is visible; on white it is hidden (pp. 6–8). Size it by
 * height only, so it keeps its proportions.
 */
const FILES = {
  landscape: {
    light: '/brand/adnoc-logo-landscape.svg',
    dark: '/brand/adnoc-logo-landscape-cartouche.svg',
  },
  portrait: { light: '/brand/adnoc-logo.svg', dark: '/brand/adnoc-logo-cartouche.svg' },
} as const;

export function BrandLogo({
  on = 'light',
  shape = 'landscape',
  className,
}: {
  /** The background the logo sits on. */
  on?: 'light' | 'dark';
  shape?: 'landscape' | 'portrait';
  /** A height class, e.g. `h-9`; the width follows. */
  className?: string;
}) {
  return (
    <img src={FILES[shape][on]} alt="ADNOC" className={cn('block w-auto shrink-0', className)} />
  );
}
