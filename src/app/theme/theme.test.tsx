import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { contrast } from './color';
import { applyTheme, DEFAULT_CHOICE, loadChoice } from './theme-choice';
import { INTENSITIES, THEMES } from './theme-presets';
import { buildTheme, themeOf } from './theme-tokens';
import { ThemePreviewToolbar } from './ThemePreviewToolbar';
import { ThemeProvider } from './ThemeProvider';

const COMBOS = THEMES.flatMap((t) => INTENSITIES.map((i) => ({ t, i, built: buildTheme(t, i) })));
const css = () => document.getElementById('masar-theme')?.textContent ?? '';

/** Text/background pairs that must stay readable (WCAG AA for small text unless noted). */
const PAIRS: readonly [string, string, number][] = [
  ['on-nav', 'nav', 4.5],
  ['on-nav-muted', 'nav', 4.5],
  ['on-nav-subtle', 'nav', 4.5],
  ['nav-active-fg', 'nav-active', 4.5],
  ['on-nav-muted', 'nav-hover', 4.5],
  ['on-primary', 'primary', 4.5],
  ['link', 'card', 4.5],
  ['ink', 'card', 7],
  ['ink', 'canvas', 7],
  ['ink-secondary', 'card', 7],
  ['ink-muted', 'card', 4.5],
  ['ink-muted', 'canvas', 4.5],
  ['on-header', 'header', 7],
  ['on-header-muted', 'header', 4.5],
  ['on-header-search', 'header-search', 4.5],
  ['on-table-head', 'table-head', 4.5],
  ['on-secondary', 'secondary', 4.5],
  ['success-fg', 'success-bg', 4.5],
  ['info-fg', 'info-bg', 4.5],
  ['warning-fg', 'warning-bg', 4.5],
  ['danger-fg', 'danger-bg', 4.5],
  ['accent-fg', 'accent-bg', 4.5],
];

describe('theme presets', () => {
  it('builds every token for all 8 themes × 3 intensities, with the same names', () => {
    expect(COMBOS).toHaveLength(24);
    const names = Object.keys(COMBOS[0]?.built.root ?? {}).sort();
    for (const { built } of COMBOS) {
      expect(Object.keys(built.root).sort()).toEqual(names);
      for (const value of [...Object.values(built.root), ...Object.values(built.admin)]) {
        expect(value).toMatch(/^(#[0-9A-F]{6}|transparent|rgb\(.+\))$/i);
      }
    }
  });

  it('keeps text readable in every combination, Administration navigation included', () => {
    const failures: string[] = [];
    for (const { t, i, built } of COMBOS) {
      const check = (
        tokens: Record<string, string>,
        [fg, bg, min]: [string, string, number],
        where: string,
      ) => {
        const ratio = contrast(tokens[fg] ?? '', tokens[bg] ?? '');
        if (ratio < min) failures.push(`${t.key}/${i}${where} ${fg} on ${bg}: ${ratio.toFixed(2)}`);
      };
      for (const pair of PAIRS) check(built.root, pair, '');
      for (const pair of PAIRS.slice(0, 5)) check(built.admin, pair, ' admin');
    }
    expect(failures).toEqual([]);
  });

  it('makes each theme, each intensity and Administration visibly different', () => {
    const balanced = COMBOS.filter((c) => c.i === 'balanced');
    const looks = new Set(
      balanced.map(({ built: b }) => `${b.root.nav}|${b.root['nav-active']}|${b.root.primary}`),
    );
    expect(looks.size).toBe(8);
    for (const theme of THEMES) {
      const [soft, mid, vivid] = INTENSITIES.map((i) => buildTheme(theme, i).root);
      const key = (r: typeof soft) => `${r?.nav}|${r?.['nav-active']}|${r?.primary}|${r?.canvas}`;
      expect(new Set([key(soft), key(mid), key(vivid)]).size).toBe(3);
      expect(buildTheme(theme, 'balanced').admin.nav).not.toBe(
        buildTheme(theme, 'balanced').root.nav,
      );
    }
  });

  it('never uses the logo’s Royal Blue for the interface', () => {
    for (const { built } of COMBOS) {
      expect(JSON.stringify(built).toUpperCase()).not.toContain('#0047BA');
    }
  });

  it('is a full dark theme for Dark Corporate', () => {
    const dark = buildTheme(themeOf('dark'), 'balanced');
    expect(dark.dark).toBe(true);
    expect(contrast(dark.root.card ?? '', '#000000')).toBeLessThan(2);
    expect(contrast(dark.root.ink ?? '', '#FFFFFF')).toBeLessThan(1.2);
  });
});

describe('theme preview toolbar', () => {
  beforeEach(() => {
    localStorage.clear();
    applyTheme(DEFAULT_CHOICE);
  });

  const renderToolbar = () =>
    render(
      <ThemeProvider>
        <ThemePreviewToolbar />
        <input aria-label="Draft" defaultValue="" />
      </ThemeProvider>,
    );

  it('defaults to ADNOC Classic, Balanced', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Theme: ADNOC Classic' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Balanced' })).toHaveAttribute('aria-checked', 'true');
    expect(loadChoice()).toEqual(DEFAULT_CHOICE);
  });

  it('switches theme and intensity at once, keeps them, and resets', async () => {
    renderToolbar();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Draft'), 'kept');
    const classicNav = buildTheme(themeOf('classic'), 'balanced').root.nav ?? '';
    expect(css()).toContain(`--color-nav: ${classicNav};`);

    await user.click(screen.getByRole('button', { name: 'Theme: ADNOC Classic' }));
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /Teal Corporate/ }),
    );
    const teal = themeOf('teal');
    expect(css()).toContain(`--color-nav: ${buildTheme(teal, 'balanced').root.nav ?? ''};`);

    await user.click(screen.getByRole('radio', { name: 'Vibrant' }));
    expect(css()).toContain(
      `--color-nav-active: ${buildTheme(teal, 'vibrant').root['nav-active'] ?? ''};`,
    );
    expect(loadChoice()).toEqual({ theme: 'teal', intensity: 'vibrant' });
    expect(document.documentElement.dataset.theme).toBe('teal');
    // Switching only recolours: what the user typed is still there.
    expect(screen.getByLabelText('Draft')).toHaveValue('kept');

    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(loadChoice()).toEqual(DEFAULT_CHOICE);
    expect(css()).toContain(`--color-nav: ${classicNav};`);
  });

  it('falls back to the default for an unknown saved theme', () => {
    localStorage.setItem('masar-demo:theme', JSON.stringify({ theme: 'nope', intensity: 'loud' }));
    expect(loadChoice()).toEqual(DEFAULT_CHOICE);
  });
});
