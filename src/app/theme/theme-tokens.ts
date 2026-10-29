import { contrast, ensure, forText, mix, readable, soften } from './color';
import {
  BRAND as B,
  type ByIntensity,
  INTENSITIES,
  type Intensity,
  type NavSpec,
  THEMES,
  type ThemeSpec,
} from './theme-presets';

/** Token name (`--color-<name>`) → value. */
export type Tokens = Record<string, string>;

export interface BuiltTheme {
  readonly root: Tokens;
  /** Navigation tokens for Administration (`[data-nav-theme='admin']`). */
  readonly admin: Tokens;
  readonly dark: boolean;
}

const pick = (v: ByIntensity, i: Intensity): string =>
  typeof v === 'string' ? v : (v[INTENSITIES.indexOf(i)] ?? v[1]);
/** Soft, balanced and vibrant amounts for a derived shade. */
const amount = (i: Intensity, soft: number, balanced: number, vibrant: number) =>
  i === 'soft' ? soft : i === 'vibrant' ? vibrant : balanced;

const W = B.white;
const INK = B.charcoal;
const LIGHT_INK = '#F1F1EF';

function navTokens(spec: NavSpec, i: Intensity): Tokens {
  const bg = pick(spec.bg, i);
  const strong = spec.text ?? readable(bg, [W, B.darkBlue, INK]);
  const item = soften(strong, bg, 7);
  const active = forText(pick(spec.active, i));
  const activeFg = ensure(
    spec.activeFg ? pick(spec.activeFg, i) : readable(active, [W, B.darkBlue, INK]),
    active,
    4.5,
    readable(active, [W, B.darkBlue, INK]),
  );
  const hover = spec.hover ? pick(spec.hover, i) : mix(bg, strong, amount(i, 0.06, 0.08, 0.11));
  // A hover that would make the item text hard to read falls back to a gentle shift of the background.
  const safeHover = contrast(item, hover) >= 4.5 ? hover : mix(bg, strong, 0.08);
  return {
    nav: bg,
    'on-nav': strong,
    'on-nav-muted': item,
    'on-nav-subtle': soften(strong, bg, 4.6),
    'nav-hover': safeHover,
    'nav-active': active,
    'nav-active-fg': activeFg,
    'nav-indicator': spec.indicator ? pick(spec.indicator, i) : 'transparent',
    'nav-icon': ensure(spec.icon ? pick(spec.icon, i) : item, bg, 3, strong),
    'nav-active-icon': activeFg,
    'nav-sub': spec.sub ? pick(spec.sub, i) : bg,
    'nav-border': spec.border ? pick(spec.border, i) : bg,
    'nav-divider': mix(bg, strong, 0.14),
    'nav-control': item,
  };
}

/** Muted text that stays readable on every surface it sits on. */
function muted(fg: string, surfaces: readonly string[], min: number): string {
  const worst = [...surfaces].sort((a, b) => contrast(fg, a) - contrast(fg, b))[0] ?? surfaces[0];
  return soften(fg, worst ?? W, min);
}

const STATUS = {
  success: [B.brightGreen, B.darkGreen, '#E0FBEA', '#99F2B7'],
  info: [B.brightTeal, B.darkTeal, '#E0F9F9', '#99ECED'],
  warning: [B.brightOrange, B.darkOrange, '#FFF2E0', '#FFD599'],
  danger: [B.brightRed, B.darkRed, '#FFEEF1', '#FFC2CD'],
} as const;

/** Every token for one theme at one intensity. */
export function buildTheme(spec: ThemeSpec, i: Intensity): BuiltTheme {
  const dark = spec.dark ?? false;
  const canvas = pick(spec.canvas, i);
  const card = spec.card ? pick(spec.card, i) : W;
  const ink = dark ? LIGHT_INK : INK;
  const hue = spec.hue;
  const primary = forText(pick(spec.primary, i));
  const accent = spec.accent ? pick(spec.accent, i) : primary;
  const header = pick(spec.header, i);
  const onHeader = readable(header, [INK, LIGHT_INK]);
  const search = mix(header, onHeader, 0.06);
  const tableHead = pick(spec.tableHead, i);
  const border = dark ? mix(card, W, 0.12) : mix(B.lightGrey, hue, amount(i, 0.03, 0.07, 0.12));
  const surfaceMuted = dark ? mix(card, W, 0.04) : mix(card, INK, 0.03);
  const link = ensure(dark ? mix(primary, W, 0.45) : primary, card, 4.5, dark ? W : B.darkBlue);
  const status: Tokens = {};
  for (const [name, [bright, deep, bg, line]] of Object.entries(STATUS)) {
    status[`${name}-fg`] = dark
      ? ensure(mix(bright, W, 0.35), mix(card, bright, 0.16), 4.5, W)
      : deep;
    status[`${name}-bg`] = dark ? mix(card, bright, 0.16) : bg;
    status[`${name}-border`] = dark ? mix(card, bright, 0.4) : line;
  }
  const accentBg = mix(card, accent, dark ? 0.22 : 0.09);

  const root: Tokens = {
    ...navTokens(spec.nav, i),
    header,
    'on-header': onHeader,
    'on-header-muted': soften(onHeader, search, 4.6),
    'header-border': dark ? mix(header, W, 0.1) : border,
    'header-search': search,
    'on-header-search': soften(onHeader, search, 4.6),

    primary,
    'primary-hover': dark ? mix(primary, W, 0.15) : mix(primary, B.darkBlue, 0.35),
    'primary-subtle': mix(card, primary, dark ? 0.22 : amount(i, 0.06, 0.09, 0.13)),
    'on-primary': readable(primary, [W, B.darkBlue]),
    link,
    focus: spec.focus ? pick(spec.focus, i) : primary,
    'adnoc-light': mix(card, primary, 0.09),

    secondary: dark ? mix(card, W, 0.05) : card,
    'on-secondary': dark ? mix(ink, card, 0.15) : '#525252',
    'secondary-hover': dark ? mix(card, W, 0.1) : mix(card, hue, amount(i, 0.04, 0.06, 0.09)),
    'secondary-border': dark ? mix(card, W, 0.2) : mix(B.lightGrey, B.slateGrey, 0.4),

    canvas,
    card,
    'surface-muted': surfaceMuted,
    border,
    'border-strong': dark ? mix(card, W, 0.25) : B.slateGrey,
    overlay: dark ? 'rgb(0 0 0 / 0.6)' : 'rgb(0 19 88 / 0.45)',
    ink,
    'ink-body': dark ? '#E4E4E2' : INK,
    'ink-secondary': muted(ink, [card, canvas, tableHead], 7),
    'ink-muted': muted(ink, [card, canvas, tableHead, surfaceMuted], 4.6),

    input: dark ? mix(card, B.black, 0.15) : W,
    'input-border': dark ? mix(card, W, 0.22) : mix(B.slateGrey, hue, 0.12),
    'table-head': tableHead,
    'on-table-head': muted(ink, [tableHead], 5.5),
    'table-row-hover': dark ? mix(card, W, 0.05) : mix(card, hue, amount(i, 0.025, 0.04, 0.06)),

    ...status,
    'neutral-fg': dark ? mix(ink, card, 0.15) : INK,
    'neutral-bg': surfaceMuted,
    'neutral-border': border,
    'accent-fg': ensure(dark ? mix(accent, W, 0.45) : accent, accentBg, 4.5, dark ? W : B.darkBlue),
    'accent-bg': accentBg,
    'accent-border': mix(card, accent, 0.35),
    danger: B.mediumRed,

    'scrollbar-track': canvas,
    'scrollbar-thumb': dark ? mix(card, W, 0.25) : B.slateGrey,
    'scrollbar-thumb-hover': dark ? mix(card, W, 0.4) : '#6B6B6B',
  };
  return { root, admin: navTokens({ ...spec.nav, ...spec.adminNav }, i), dark };
}

export const themeOf = (key: string): ThemeSpec =>
  THEMES.find((t) => t.key === key) ?? (THEMES[0] as ThemeSpec);

/** The theme as CSS: `:root` tokens and Administration's navigation. */
export function themeCss(built: BuiltTheme): string {
  const block = (tokens: Tokens) =>
    Object.entries(tokens)
      .map(([name, value]) => `  --color-${name}: ${value};`)
      .join('\n');
  return [
    `:root {\n  color-scheme: ${built.dark ? 'dark' : 'light'};\n${block(built.root)}\n}`,
    `[data-nav-theme='admin'] {\n${block(built.admin)}\n}`,
  ].join('\n');
}

/** Swatches for the preview toolbar: navigation, active item, primary action, content. */
export function swatches(spec: ThemeSpec): string[] {
  const built = buildTheme(spec, 'balanced');
  return ['nav', 'nav-active', 'primary', 'canvas'].map((k) => built.root[k] ?? '#000000');
}
