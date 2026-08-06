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

/**
 * Slice `schema.ts` files are the one place a cross-slice *deep* import is
 * legitimate: a foreign key needs the referenced table object, and routing that
 * through a slice's `index.ts` would drag server-only and client code into
 * drizzle-kit's schema graph (and create import cycles). The exemption is
 * deliberately narrow — a schema file may import another slice's `schema`, and
 * nothing else.
 */
const schemaBoundaryRule = [
  'error',
  {
    patterns: [
      {
        group: [
          '@/modules/*/*',
          '!@/modules/*/schema',
          'src/modules/*/*',
          '!src/modules/*/schema',
          '**/modules/*/*',
          '!**/modules/*/schema',
        ],
        message:
          'A slice schema may deep-import another slice `schema` only (foreign keys). Everything else goes through `@/modules/<slice>`.',
      },
    ],
  },
];

/**
 * `domain/` is the second — and last — sanctioned cross-slice deep import.
 *
 * Architecture §2 rule 2 makes `domain/` pure and framework-free: no React, no
 * `server-only`, no database. That is exactly the property a slice `index.ts`
 * does *not* have — a barrel re-exports the slice's client components, so
 * routing a domain import through one drags a React client graph (and
 * `next-intl`'s client navigation) into a plain Node test and makes the
 * importing domain module untestable. M07's routine scheduler needs M06's
 * RFC-5545 engine (`modules/calendar/domain/rrule`), and re-implementing
 * recurrence per slice is precisely the duplication the boundary exists to
 * prevent.
 *
 * The exemption is as narrow as the schema one: a `domain/` module may import
 * another slice's `domain/`, and nothing else.
 */
const domainBoundaryRule = [
  'error',
  {
    patterns: [
      {
        group: [
          '@/modules/*/*',
          '!@/modules/*/domain',
          '!@/modules/*/domain/*',
          'src/modules/*/*',
          '!src/modules/*/domain',
          '!src/modules/*/domain/*',
          '**/modules/*/*',
          '!**/modules/*/domain',
          '!**/modules/*/domain/*',
        ],
        message:
          'A slice `domain` module may deep-import another slice `domain` only (pure, framework-free code). Everything else goes through `@/modules/<slice>`.',
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
    // Foreign keys cross slices; see `schemaBoundaryRule` above.
    files: ['src/modules/*/schema.ts'],
    rules: { 'no-restricted-imports': schemaBoundaryRule },
  },
  {
    // Pure domain code crosses slices; see `domainBoundaryRule` above.
    files: ['src/modules/*/domain/**/*.ts'],
    rules: { 'no-restricted-imports': domainBoundaryRule },
  },
  {
    // Playwright fixtures take a callback conventionally named `use`, which
    // the React hooks plugin reads as React 19's `use()` and then insists is
    // called unconditionally from a component. There is no React in this tree.
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
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
