import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '../src/i18n';

vi.stubGlobal('__MASAR_DEV_TOOLS__', false);

/** jsdom has no matchMedia; tests choose the viewport with `setViewportWidth`. */
let width = 1280;
export function setViewportWidth(px: number): void {
  width = px;
}
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  },
});

afterEach(() => {
  cleanup();
  width = 1280;
});
