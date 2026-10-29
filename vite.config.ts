import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Not for search engines (also public/robots.txt and the meta tag in index.html). */
const NO_INDEX = { 'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet' };

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    // The component gallery exists only on the local dev server; builds drop it.
    __MASAR_DEV_TOOLS__: JSON.stringify(command === 'serve' && mode === 'development'),
  },
  // The demo answers every API call in the browser (src/mock): no backend proxy. Its own port, so
  // it can run beside the real MASAR frontend (5173).
  server: { port: 5180, headers: NO_INDEX },
  preview: { port: 5181, headers: NO_INDEX },
  build: {
    sourcemap: true,
    target: 'es2023',
    rolldownOptions: {
      output: {
        // Libraries change less often than the app: separate chunks cache across releases.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/api/schema.d.ts',
        'src/api/registry.generated.ts',
        'src/main.tsx',
        '**/*.test.*',
      ],
      reporter: ['text-summary', 'lcov'],
    },
  },
}));
