import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import storybook from 'eslint-plugin-storybook';
import tseslint from 'typescript-eslint';

/**
 * The package boundary (phase 2).
 *
 * `@kynite/ui` is client/presentational code and nothing else. That is not a
 * style preference: the package is consumed by two very different hosts — the
 * Next app and a Vite-driven Storybook — and anything it imports has to exist
 * in both. A single `useTranslations` makes every story require a
 * `NextIntlClientProvider`; a single `next/link` makes the package
 * unrenderable outside a Next tree.
 *
 * So the rule bans the four families that break that property, and says what
 * to do instead in each case. It fires on the *specifier*, which is why the
 * relative escape hatches (`../../apps/web/...`) are listed alongside the
 * aliases — a boundary that only checks the tidy spelling is not a boundary.
 */
const packageBoundaryRule = [
  'error',
  {
    paths: [
      {
        name: 'next-intl',
        message:
          '`@kynite/ui` is not localised. Every user-visible string arrives as a prop, so the app translates and the package renders. (Storybook has no next-intl provider, and never will.)',
      },
      {
        name: 'next-intl/server',
        message:
          '`@kynite/ui` is not localised. Every user-visible string arrives as a prop, so the app translates and the package renders.',
      },
      {
        name: 'server-only',
        message: '`@kynite/ui` is client/presentational code — there is no server module in it.',
      },
    ],
    patterns: [
      {
        group: ['next', 'next/*', 'next/**'],
        message:
          "`@kynite/ui` must render outside a Next tree (Storybook). A component that needs a link takes Base UI's `render` prop and lets the app pass `next/link`; a component that needs an image takes `src` and a `render` prop the same way.",
      },
      {
        group: [
          '@/*',
          'src/*',
          '**/apps/web/**',
          '../../apps/**',
          '../../../apps/**',
          '../../../../apps/**',
        ],
        message:
          'The package may not import from the app. It is the *dependency*, not a consumer: anything it needs has to move into `packages/ui` (or be passed in as a prop).',
      },
    ],
  },
];

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'storybook-static/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...storybook.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-restricted-imports': packageBoundaryRule,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier
);
