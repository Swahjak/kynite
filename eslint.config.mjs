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

/**
 * The `(share)` route tree imports **zero** Server Actions (M13, architecture
 * §2: "must be impossible to reach a mutation from this tree").
 *
 * A slice's `index.ts` re-exports its Server Actions, so "don't import
 * `actions.ts`" is not enough — importing `@/modules/calendar` puts
 * `createEventAction` in this tree's module graph just as surely. So the rule
 * is inverted: the share tree may import exactly one module,
 * `@/modules/sharing/view` (the slice's action-free entry point), and nothing
 * else from `modules/`. Anything the view needs goes *into* that entry point,
 * where the transitive scan in
 * `tests/unit/share-tree-no-server-actions.test.ts` can see it.
 *
 * The lint rule is the fast local signal; the repo scan is the guarantee (it
 * follows the graph, this only looks at one hop). Both exist because a rule
 * that only fires in CI is a rule people learn about too late.
 */
const shareTreeRule = [
  'error',
  {
    patterns: [
      {
        // Everything below a slice, except the one action-free entry point.
        group: [
          '@/modules/*/**',
          '!@/modules/sharing/view',
          'src/modules/*/**',
          '!src/modules/sharing/view',
          '**/modules/*/**',
          '!**/modules/sharing/view',
        ],
        message:
          'The (share) route tree may import `@/modules/sharing/view` only — every other slice module is one hop from a Server Action, and this tree must reach none.',
      },
      {
        // The slice barrels themselves. A `group` cannot express this: gitignore
        // semantics (which `no-restricted-imports` uses) refuse to re-include a
        // path whose parent directory is excluded, so banning `@/modules/sharing`
        // by pattern would also bury `@/modules/sharing/view` under it. A regex
        // matches the barrel exactly and nothing beneath it.
        regex: '^(@/|src/|(\\.\\.?/)+)modules/[^/]+$',
        message:
          'The (share) route tree may not import a slice barrel — every one of them re-exports Server Actions. Import `@/modules/sharing/view`.',
      },
    ],
  },
];

/**
 * The third — and, like the two above it, deliberately narrow — sanctioned
 * cross-slice deep import: the share view's read path.
 *
 * `modules/sharing/view/` and `modules/sharing/resolve.ts` are the code behind
 * `@/modules/sharing/view`, so everything *they* import is in the `(share)`
 * tree's transitive graph too. That rules out slice barrels for exactly the
 * reason `shareTreeRule` rules them out one level up: `@/modules/calendar`
 * re-exports `createEventAction`. What this path actually needs — `queries`
 * (`server-only` reads), `domain/**` (pure), `authorize` (the pure permission
 * table) and `schema` (tables) — is action-free by construction, so those four
 * are allowed and nothing else is.
 *
 * Same shape and same justification as the schema-to-schema and
 * domain-to-domain exemptions: routing through a barrel would drag in precisely
 * the thing the boundary exists to keep out.
 */
const shareViewBoundaryRule = [
  'error',
  {
    patterns: [
      {
        group: [
          '@/modules/*/**',
          '!@/modules/*/queries',
          '!@/modules/*/authorize',
          '!@/modules/*/schema',
          '!@/modules/*/domain',
          '!@/modules/*/domain/**',
          'src/modules/*/**',
          '!src/modules/*/queries',
          '!src/modules/*/authorize',
          '!src/modules/*/schema',
          '!src/modules/*/domain',
          '!src/modules/*/domain/**',
          '**/modules/*/**',
          '!**/modules/*/queries',
          '!**/modules/*/authorize',
          '!**/modules/*/schema',
          '!**/modules/*/domain',
          '!**/modules/*/domain/**',
        ],
        message:
          'The share view read path may deep-import another slice `queries`, `domain`, `authorize` or `schema` only — everything else in a slice is reachable from a Server Action, which the (share) tree must never reach.',
      },
      {
        // See the note on the same shape in `shareTreeRule`.
        regex: '^(@/|src/|(\\.\\.?/)+)modules/[^/]+$',
        message:
          'The share view read path may not import a slice barrel — every one of them re-exports Server Actions. Deep-import `queries`, `domain`, `authorize` or `schema` instead.',
      },
    ],
  },
];

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      // M17: the second e2e dev server's build directory (see next.config.ts).
      '.next-e2e-google/**',
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
    // The caregiver share tree — no Server Actions, at all; see `shareTreeRule`.
    files: ['src/app/**/(share)/**/*.ts', 'src/app/**/(share)/**/*.tsx'],
    rules: { 'no-restricted-imports': shareTreeRule },
  },
  {
    // The code behind `@/modules/sharing/view`, which is in that tree's
    // transitive graph; see `shareViewBoundaryRule`.
    files: [
      'src/modules/sharing/view/**/*.ts',
      'src/modules/sharing/view/**/*.tsx',
      'src/modules/sharing/resolve.ts',
    ],
    rules: { 'no-restricted-imports': shareViewBoundaryRule },
  },
  {
    /**
     * The e2e tree may deep-import a slice's `domain/` modules (M17).
     *
     * `domain/` is the architecture's own name for the pure layer: no database,
     * no `server-only`, no Server Actions — which is exactly why a Playwright
     * worker can load one. The alternative was worse in both directions: going
     * through the slice barrel would pull Server Actions and `@/server/env`
     * into the test process, and copying the function into `e2e/` would let the
     * copy drift from the implementation it exists to agree with (the praise
     * hash, which decides the words a visual baseline pins).
     */
    files: ['e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@/modules/[^/]+$',
              message:
                'The e2e tree may not import a slice barrel — it re-exports Server Actions and server-only code into the test process. Import `@/modules/<slice>/domain/<module>` if you need pure logic.',
            },
          ],
        },
      ],
    },
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
