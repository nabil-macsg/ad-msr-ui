import { type ReactNode, useCallback, useMemo, useState } from 'react';
import {
  applyTheme,
  DEFAULT_CHOICE,
  loadChoice,
  saveChoice,
  type ThemeChoice,
} from './theme-choice';
import { ThemeContext, type ThemeContextValue } from './theme-context';

/** The demo's theme preview: eight presets × three intensities, kept in this browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState(loadChoice);
  const choose = useCallback((next: ThemeChoice | null) => {
    const value = next ?? DEFAULT_CHOICE;
    applyTheme(value);
    saveChoice(next);
    setChoice(value);
  }, []);
  const value = useMemo<ThemeContextValue>(
    () => ({
      ...choice,
      setTheme: (theme) => choose({ ...choice, theme }),
      setIntensity: (intensity) => choose({ ...choice, intensity }),
      reset: () => choose(null),
    }),
    [choice, choose],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
