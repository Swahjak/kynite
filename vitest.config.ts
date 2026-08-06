import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const baseAlias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

// `server-only` throws outside a React Server Component graph, which would
// make every `server-only` module unimportable from a test. See the stub.
//
// N14: scoped to the `node` project only. The `dom` project exercises client
// components, which must never import a `server-only` module in the first
// place — stubbing it there would silently hide that mistake instead of
// failing the test the way it would in a real client bundle.
const serverOnlyAlias = {
  'server-only': fileURLToPath(new URL('./tests/setup/server-only.ts', import.meta.url)),
};

const sharedExclude = ['node_modules/**', '.next/**', 'e2e/**'];

export default defineConfig({
  resolve: { alias: baseAlias },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
    },
    projects: [
      {
        // Server/utility code: plain Node, no DOM.
        resolve: { alias: { ...baseAlias, ...serverOnlyAlias } },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
          exclude: sharedExclude,
        },
      },
      {
        // Component tests: jsdom + Testing Library.
        plugins: [react()],
        resolve: { alias: baseAlias },
        test: {
          name: 'dom',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./tests/setup/dom.ts'],
          include: ['src/**/*.test.tsx', 'tests/**/*.test.tsx'],
          exclude: sharedExclude,
        },
      },
    ],
  },
});
