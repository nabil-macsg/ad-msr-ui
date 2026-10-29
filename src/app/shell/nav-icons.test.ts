import { ChartNoAxesColumn, FileText, LayoutDashboard, Plane, Workflow } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { WEB_PAGES } from '../access/registry';
import { pageIcon } from './nav-icons';

describe('PROMPT-4.2 navigation icons', () => {
  it('PROMPT-4.2 uses the reference sidebar icons', () => {
    expect(pageIcon('scheduling.dashboard')).toBe(LayoutDashboard);
    expect(pageIcon('admin.approval-engine')).toBe(Workflow);
    expect(pageIcon('admin.fleet')).toBe(Plane);
  });

  it('PROMPT-4.2 gives every sidebar page its own icon; other reports take the report icon', () => {
    const sidebar = WEB_PAGES.filter(
      (p) => p.menu && (p.layout === 'main' || p.layout === 'admin'),
    );
    const unmapped = sidebar
      .filter((p) => !p.key.startsWith('reports.') && pageIcon(p.key) === FileText)
      .filter((p) => p.key !== 'pob.report' && p.key !== 'asp.audits')
      .map((p) => p.key);
    expect(unmapped).toEqual([]);
    expect(pageIcon('reports.no-show')).toBe(ChartNoAxesColumn);
  });
});
