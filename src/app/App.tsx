import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from './theme/ThemeProvider';
import { createQueryClient } from './query-client';
import { appRoutes } from './routes';

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(appRoutes()));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
