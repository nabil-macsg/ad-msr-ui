import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * WCAG 2.1 AA checks with axe-core (plan P0-15). jsdom has no layout or canvas, so colour
 * contrast is checked in the browser by Playwright (P0-17) and by the token palette instead;
 * `region` is a page-level rule that doesn't apply to an isolated component.
 */
export async function expectAccessible(container: Element = document.body): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`,
    ),
  ).toEqual([]);
}
