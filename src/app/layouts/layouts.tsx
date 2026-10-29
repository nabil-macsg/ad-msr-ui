import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { GST } from '../../shared/time/gst';
import { Banner } from '../../shared/ui/banner';
import type { DeniedState } from '../guards/RequirePage';
import { AdminSidebar } from '../shell/AdminSidebar';
import { Header } from '../shell/Header';
import { MODULE_NAV_THEME, moduleOfPath } from '../shell/module-theme';
import { Sidebar } from '../shell/Sidebar';

function DeniedNotice() {
  const { t } = useTranslation();
  const state = useLocation().state as Partial<DeniedState> | null;
  if (!state?.deniedPage) return null;
  return (
    <Banner tone="warning" className="mb-6">
      {t('denied', { page: state.deniedPage })}
    </Banner>
  );
}

function Shell({ sidebar }: { sidebar: React.ReactNode }) {
  const moduleKey = moduleOfPath(useLocation().pathname);
  return (
    <div
      className="flex min-h-screen"
      data-module={moduleKey}
      data-nav-theme={MODULE_NAV_THEME[moduleKey]}
    >
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main" className="flex-1 p-6">
          <div className="mx-auto max-w-content">
            <DeniedNotice />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export const MainLayout = () => <Shell sidebar={<Sidebar />} />;
export const AdminLayout = () => <Shell sidebar={<AdminSidebar />} />;

/** The staff-operated check-in kiosk: full screen, dark blue, large type (PROMPT §4.2).bjnj */
export function KioskLayout() {
  return (
    <main className="min-h-screen bg-kiosk-background p-8 text-kiosk text-kiosk-text">
      <Outlet />
    </main>
  );
}

function GstClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="font-mono text-3xl text-fids-highlight">
      {format(new TZDate(now, GST), 'HH:mm:ss')} GST
    </time>
  );
}

/** Flight information display: a dark board with a live clock (PROMPT §4.2). */
export function FidsLayout() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen bg-fids-background p-8 text-fids-text">
      <header className="mb-8 flex items-center justify-between">
        <p className="text-2xl font-bold">{t('appName')}</p>
        <GstClock />
      </header>
      <Outlet />
    </main>
  );
}

/** Print layouts: manifests, boarding cards, tags and reports. */
export function PrintLayout() {
  return (
    <main className="min-h-screen bg-card p-8 text-ink print:p-0">
      <Outlet />
    </main>
  );
}
