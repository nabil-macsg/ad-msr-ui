import {
  DEFAULT_INTENSITY,
  DEFAULT_THEME,
  INTENSITIES,
  type Intensity,
  THEMES,
} from './theme-presets';
import { buildTheme, themeCss, themeOf } from './theme-tokens';

const STORAGE_KEY = 'masar-demo:theme';
const STYLE_ID = 'masar-theme';

export interface ThemeChoice {
  readonly theme: string;
  readonly intensity: Intensity;
}

export const DEFAULT_CHOICE: ThemeChoice = { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY };

export function loadChoice(): ThemeChoice {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<ThemeChoice> | null;
    const theme = THEMES.some((t) => t.key === saved?.theme)
      ? (saved?.theme ?? DEFAULT_THEME)
      : DEFAULT_THEME;
    const intensity = INTENSITIES.find((i) => i === saved?.intensity) ?? DEFAULT_INTENSITY;
    return { theme, intensity };
  } catch {
    return DEFAULT_CHOICE;
  }
}

export function saveChoice(choice: ThemeChoice | null): void {
  try {
    if (choice) localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the choice lasts until a reload.
  }
}

/** Writes the theme's tokens into one `<style>` element: every screen recolours at once. */
export function applyTheme(choice: ThemeChoice): void {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = themeCss(buildTheme(themeOf(choice.theme), choice.intensity));
  document.documentElement.dataset.theme = choice.theme;
  document.documentElement.dataset.intensity = choice.intensity;
}
