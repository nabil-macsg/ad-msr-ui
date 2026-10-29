import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setViewportWidth } from '../../../test/setup';
import { ViewportGate } from './ViewportGate';

describe('PROMPT-1.2 MASAR Web is for desktop and tablet browsers', () => {
  it('PROMPT-1.2 below 768 px it points phone users to the app', () => {
    setViewportWidth(767);
    render(<ViewportGate>app</ViewportGate>);
    expect(
      screen.getByText(
        'MASAR is designed for desktop and tablet browsers. On a phone, use the MASAR app.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('app')).toBeNull();
  });

  it('PROMPT-4.2 from 768 px (tablet) the app shows', () => {
    setViewportWidth(768);
    render(<ViewportGate>app</ViewportGate>);
    expect(screen.getByText('app')).toBeInTheDocument();
  });
});
