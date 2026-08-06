import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

const sharedExclude = ['node_modules/**', '.next/**', 'e2e/**'];

export default defineConfig({
  resolve: { alias },
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
        resolve: { alias },
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
        resolve: { alias },
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
