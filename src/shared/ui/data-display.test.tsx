import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import { slaHours } from '../time/sla';
import { ApprovalChain } from './approval-chain';
import { Banner } from './banner';
import { EmptyState } from './empty-state';
import { LiveTicker } from './live-ticker';
import { ProvenanceChip } from './provenance-chip';
import { StatCard } from './stat-card';
import { StatusPill } from './status-pill';
import { Timeline } from './timeline';

describe('PROMPT-4.2 data display components', () => {
  it('PROMPT-4.2 StatCard shows title, number and sub-line, and can open its list', async () => {
    const { container } = render(
      <MemoryRouter>
        <StatCard title="Today's departures" value={12} subline="5 gone · 7 still to go" />
        <StatCard title="Awaiting your approval" value={7} tone="warning" to="/booking/approvals" />
      </MemoryRouter>,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5 gone · 7 still to go')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Awaiting your approval/ })).toHaveAttribute(
      'href',
      '/booking/approvals',
    );
    await expectAccessible(container);
  });

  it('PROMPT-4.1 StatusPill uses the fixed colour for its meaning and keeps the label', async () => {
    const { container } = render(
      <>
        <StatusPill tone="danger">Expired</StatusPill>
        <StatusPill tone="success">Arrived</StatusPill>
      </>,
    );
    expect(screen.getByText('Expired')).toHaveClass('bg-danger-bg', 'text-danger-fg');
    expect(screen.getByText('Arrived')).toHaveClass('bg-success-bg');
    await expectAccessible(container);
  });

  it('PROMPT-4.2 Banner: danger interrupts, the rest are polite', async () => {
    const { container } = render(
      <>
        <Banner tone="danger" title="Helideck not serviceable">
          Friction test expired.
        </Banner>
        <Banner tone="info">Bookings close at 14:00 GST.</Banner>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Helideck not serviceable');
    expect(screen.getByRole('status')).toHaveTextContent('Bookings close at 14:00 GST.');
    await expectAccessible(container);
  });

  it('PROMPT-2.9 ProvenanceChip names the source and when it last synced (GST)', async () => {
    const { container } = render(
      <>
        <ProvenanceChip source="sap" syncedAt="2026-09-29T03:00:00Z" />
        <ProvenanceChip source="manual" />
      </>,
    );
    const sap = screen.getByText('VIA SAP');
    expect(sap).toHaveAttribute('title', 'Last synced 29 Sep 2026, 07:00 GST');
    expect(screen.getByText('MANUAL EXCEPTION')).toBeInTheDocument();
    await expectAccessible(container);
  });

  it('PROMPT-4.2 EmptyState', async () => {
    const { container } = render(<EmptyState title="No bookings yet" body="They appear here." />);
    expect(screen.getByText('No bookings yet')).toBeInTheDocument();
    await expectAccessible(container);
  });

  it('PROMPT-2.8 Timeline lists what happened with GST times', async () => {
    const { container } = render(
      <Timeline
        title="What has happened"
        entries={[
          {
            id: '2',
            at: '2026-09-29T03:00:00Z',
            title: 'Approved',
            actor: 'Saeed Al Kaabi',
            tone: 'success',
          },
          { id: '1', at: '2026-09-28T20:30:00Z', title: 'Submitted' },
        ]}
      />,
    );
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/29 Sep 2026, 07:00/).closest('p')).toHaveTextContent('Saeed Al Kaabi');
    expect(screen.getByText(/29 Sep 2026, 00:30/)).toBeInTheDocument();
    await expectAccessible(container);
  });

  it('spec-10-3.1 ApprovalChain shows each stage, its status and the SLA', async () => {
    const now = new Date('2026-10-13T06:00:00Z');
    const { container } = render(
      <ApprovalChain
        now={now}
        stages={[
          { id: 'a', name: 'Line Manager', status: 'approved', approver: 'Saeed Al Kaabi' },
          { id: 'b', name: 'Aviation Team', status: 'pending', slaDueAt: '2026-10-13T10:30:00Z' },
          { id: 'c', name: 'Focal Point', status: 'pending', slaDueAt: '2026-10-13T03:00:00Z' },
          { id: 'd', name: 'Seat', status: 'waiting' },
        ]}
      />,
    );
    expect(screen.getByText('4 h left')).toBeInTheDocument();
    expect(screen.getByText('Overdue by 3 h')).toBeInTheDocument();
    expect(screen.getByText(': Approved')).toHaveClass('sr-only');
    await expectAccessible(container);
  });

  it('spec-10-3.1 SLA hours round in the user’s interest', () => {
    const now = new Date('2026-10-13T06:00:00Z');
    expect(slaHours('2026-10-13T06:59:00Z', now)).toBe(0);
    expect(slaHours('2026-10-13T05:30:00Z', now)).toBe(-1);
  });

  it('spec-40-1 LiveTicker announces its region once, with the second copy hidden', async () => {
    const { container } = render(
      <LiveTicker
        items={[
          { id: '1', text: 'AH-001 departed', tone: 'success' },
          { id: '2', text: 'Friction test due', tone: 'warning' },
        ]}
      />,
    );
    const region = screen.getByRole('region', { name: 'Live updates' });
    expect(within(region).getByText('LIVE')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem', { hidden: false })).toHaveLength(2);
    await expectAccessible(container);
  });

  it('spec-40-1 LiveTicker shows nothing without items', () => {
    const { container } = render(<LiveTicker items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
