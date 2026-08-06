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
        group: ['@/modules/*/*', 'src/modules/*/*'],
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
  prettier
);
