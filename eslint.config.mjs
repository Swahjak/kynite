import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Module boundary rule (docs/architecture.md §2 "Module boundaries"):
 * cross-module imports must go through `@/modules/<slice>` (its index.ts).
 * Deep imports such as `@/modules/routines/queries` are banned so slices stay
 * swappable. Within a slice, use relative imports (`./queries`) instead.
 */
const moduleBoundaryRule = [
  'error',
  {
    patterns: [
      {
        // Aliased deep imports, plus the relative escape hatch
        // (`../../modules/family/queries`, `../routines/actions`).
        group: ['@/modules/*/*', 'src/modules/*/*', '**/modules/*/*'],
        message:
          'Deep module imports are banned. Import the slice public surface instead: `@/modules/<slice>`.',
      },
    ],
  },
];

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'docs/**',
      '.claude/**',
      '.github/**',
      'node_modules/**',
      'next-env.d.ts',
      'tests/fixtures/**',
      'e2e/test-results/**',
      'e2e/playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Pin the React version: eslint-plugin-react's auto-detection is not
    // ESLint 10 compatible (it calls context.getFilename()).
    settings: { react: { version: '19.2' } },
    rules: {
      'no-restricted-imports': moduleBoundaryRule,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Unit tests exercise slice internals directly (the permission table, the
    // pure domain functions). They are not consumers of the public surface, so
    // the boundary rule would only force them through barrels that drag in
    // server-only and client code.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The drizzle schema barrel is the schema *assembly point*, not a consumer:
    // drizzle-kit needs one module that sees every slice's tables, and it must
    // not pull in a slice's `index.ts` (which re-exports server-only code).
    // This is the single sanctioned deep import in the codebase.
    files: ['src/server/db/schema.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  prettier
);
