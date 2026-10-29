/** Colour arithmetic for the theme builder: hex mixing and WCAG 2 contrast. */

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
}

const hexOf = (c: Rgb) =>
  `#${c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();

/** `a` moved towards `b` by `t` (0 = a, 1 = b): a derived UI shade of brand colours. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return hexOf(
    [0, 1, 2].map((i) => (x[i] ?? 0) + ((y[i] ?? 0) - (x[i] ?? 0)) * t) as unknown as Rgb,
  );
}

function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The candidate with the best contrast on `bg`. */
export function readable(
  bg: string,
  candidates: readonly string[] = ['#FFFFFF', '#262626'],
): string {
  return [...candidates].sort((x, y) => contrast(y, bg) - contrast(x, bg))[0] ?? '#FFFFFF';
}

/**
 * `fg` softened towards `bg` as far as it can go while keeping `min` contrast: muted text that
 * stays readable whatever the theme and intensity.
 */
export function soften(fg: string, bg: string, min: number): string {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const t = (lo + hi) / 2;
    if (contrast(mix(fg, bg, t), bg) >= min) lo = t;
    else hi = t;
  }
  return mix(fg, bg, lo);
}

/** `fg` pushed towards `towards` until it reaches `min` contrast on `bg` (or as close as it gets). */
export function ensure(fg: string, bg: string, min: number, towards: string): string {
  if (contrast(fg, bg) >= min) return fg;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, towards, t);
    if (contrast(c, bg) >= min) return c;
  }
  return towards;
}

/**
 * A background deepened towards `towards` just enough for white or `dark` text to reach `min`:
 * e.g. Medium Teal #008591 carries white text at 4.41:1, so buttons use a slightly deeper shade.
 */
export function forText(bg: string, min = 4.5, dark = '#001358', towards = dark): string {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(bg, towards, t);
    if (Math.max(contrast('#FFFFFF', c), contrast(dark, c)) >= min) return c;
  }
  return towards;
}
