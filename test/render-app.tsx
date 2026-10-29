import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import type { Me, MyAccess, PageKey, Right } from '../src/app/access/registry';
import { DEMO_ACCOUNT } from '../src/app/auth/demo-account';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/theme/ThemeProvider';
import { signInAs, signOutDemo } from '../src/mock/demo-auth';
import { meQuery, myAccessQuery } from '../src/app/session/queries';

export const ME: Me = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Ahmed Al Mansoori',
  email: 'a.almansoori@masar.example',
  isExternal: false,
  authMethod: 'sso',
  personnelNo: '100001',
  source: 'sap',
  company: 'ADNOC Offshore',
  department: null,
  designation: null,
  approvalTier: null,
  lastSignInAt: null,
  roles: [
    {
      code: 'passenger',
      name: 'Passenger',
      validTo: null,
      scope: {
        allLocations: false,
        zones: [],
        locations: [],
        serviceProvider: null,
        departments: [],
        moduleKeys: null,
        self: true,
        lineManagerOf: false,
      },
    },
  ],
};

/** Access with the shared pages every user has, plus the given grants. */
export function accessWith(pages: Partial<Record<PageKey, Right[]>> = {}): MyAccess {
  return {
    matrixVersion: 1,
    modules: [],
    pages: {
      home: ['view'],
      notifications: ['view'],
      account: ['view', 'edit'],
      support: ['view'],
      ...pages,
    },
    capabilities: [],
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers the shell's background calls (notifications) and anything a test adds. */
export function stubFetch(
  handler: (url: string, init: Request) => Response | undefined = () => undefined,
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), window.location.origin), init);
    const handled = handler(new URL(request.url).pathname, request);
    if (handled) return Promise.resolve(handled);
    if (request.url.includes('/api/v1/notifications')) {
      return Promise.resolve(json({ items: [], nextCursor: null, unreadCount: 0 }));
    }
    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'Not stubbed' } }, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderApp(
  path: string,
  options: { me?: Me; access?: MyAccess; signedIn?: boolean; demoLogin?: boolean } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The demo login gate (src/app/auth) reads this tab's session.
  if (options.demoLogin ?? options.signedIn ?? true) signInAs(DEMO_ACCOUNT.persona);
  else signOutDemo();
  if (options.signedIn ?? true) {
    queryClient.setQueryData(meQuery.queryKey, options.me ?? ME);
    queryClient.setQueryData(myAccessQuery.queryKey, options.access ?? accessWith());
  }
  const router = createMemoryRouter(appRoutes(), { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient, ...view };
}
