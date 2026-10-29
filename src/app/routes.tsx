import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import type { Layout } from '../api/registry.generated';
import { WEB_PAGES } from './access/registry';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequirePage } from './guards/RequirePage';
import { RequireSession } from './guards/RequireSession';
import { AdminLayout, FidsLayout, KioskLayout, MainLayout, PrintLayout } from './layouts/layouts';
import { NotFound } from './pages/NotFound';
import { LandingPage } from '../demo/LandingPage';
import { LoginPage } from '../demo/LoginPage';

const LAYOUTS: Record<Layout, React.ComponentType> = {
  main: MainLayout,
  admin: AdminLayout,
  kiosk: KioskLayout,
  fids: FidsLayout,
  print: PrintLayout,
};

// Local dev server only; production builds fold the condition and drop the gallery (ADR-0034).
const Gallery = __MASAR_DEV_TOOLS__ ? lazy(() => import('../dev/Gallery')) : null;

/** Paths reachable without the demo login. Everything else is a protected registry page. */
export const PUBLIC_PATHS = ['/', '/login'];

/**
 * The route tree, generated from the permission registry (PROMPT §2.7): every web page gets
 * its demo path, its layout and the view-right guard. There are no hand-written page routes.
 */
export function appRoutes(): RouteObject[] {
  const byLayout = (layout: Layout): RouteObject[] =>
    WEB_PAGES.filter((p) => p.layout === layout).map((p) => ({
      path: p.route ?? '',
      element: <RequirePage pageKey={p.key} />,
    }));
  const layouts = (Object.keys(LAYOUTS) as Layout[]).map((layout): RouteObject => {
    const Component = LAYOUTS[layout];
    const children = byLayout(layout);
    if (layout === 'main') children.push({ path: '*', element: <NotFound /> });
    return { element: <Component />, children };
  });
  return [
    {
      // Demo: a public landing page and a frontend-only login in front of every other route,
      // including unknown addresses (their "Page not found" is inside the protected shell).
      element: <AuthProvider />,
      children: [
        { path: '/', element: <LandingPage /> },
        { path: '/login', element: <LoginPage /> },
        // Earlier demo addresses.
        { path: '/welcome', element: <Navigate to="/" replace /> },
        { path: '/sign-in', element: <Navigate to="/login" replace /> },
        {
          element: <ProtectedRoute />,
          children: [{ element: <RequireSession />, children: layouts }],
        },
      ],
    },
    ...(Gallery
      ? [
          {
            path: '/dev/gallery',
            element: (
              <Suspense fallback={null}>
                <Gallery />
              </Suspense>
            ),
          },
        ]
      : []),
  ];
}
