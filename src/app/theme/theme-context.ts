import { createContext, useContext } from 'react';
import type { Intensity } from './theme-presets';
import type { ThemeChoice } from './theme-choice';

export interface ThemeContextValue extends ThemeChoice {
  setTheme: (theme: string) => void;
  setIntensity: (intensity: Intensity) => void;
  reset: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeChoice(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemeChoice needs a ThemeProvider');
  return value;
}
