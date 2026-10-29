import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './markdown';

describe('SPEC-10-1.4 help articles in a safe markdown subset', () => {
  it('SPEC-10-1.4 renders headings, paragraphs, emphasis, lists and links', () => {
    const { container } = render(
      <Markdown
        text={`## Cut-offs

Book **2 weeks** ahead, *normal* criticality.
Then wait.

- AUH: **10:00** D-1
- Inter-field: 14:00 D-1

1. Open [My account](/account)
2. Read the [guide](https://help.masar.example/guide)`}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Cut-offs' })).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('2 weeks');
    expect(container.querySelector('em')?.textContent).toBe('normal');
    expect(container.querySelector('p')?.innerHTML).toContain('<br>');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: 'guide' })).toHaveAttribute('target', '_blank');
  });

  it('PROMPT-2.17 never injects HTML or unsafe links', () => {
    const { container } = render(
      <Markdown
        text={
          '<img src=x onerror=alert(1)> <script>alert(2)</script> [click](javascript:alert(3)) [x](//evil.example)'
        }
      />,
    );
    expect(container.querySelector('img, script')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toContain('<script>alert(2)</script>');
    expect(container.textContent).toContain('[click](javascript:alert(3))');
  });
});
