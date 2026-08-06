import { defineRouting } from 'next-intl/routing';

export const locales = ['nl', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'nl',
  localePrefix: 'always',
});
