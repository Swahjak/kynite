import localFont from 'next/font/local';
import { Baloo_2, Poppins } from 'next/font/google';

/**
 * Brand fonts — `docs/design/typography.md` (the single source of truth for
 * design, `docs/design/README.md`).
 *
 * **Baloo 2** for display/headings/labels/buttons and **Poppins** for body copy
 * and UI text, quoting `typography.md` § "Font families":
 *
 * | `Baloo 2` | Display / headings / labels / numerals-with-personality | 400, 600, 700, 800 |
 * | `Poppins` | Body copy, UI text | 400, 500, 600, 700 |
 *
 * These replace Hanken Grotesk / Inter, which came from the superseded stitch
 * mockups, which in turn replaced Lexend / Noto Sans from the green brand.
 *
 * `next/font/google` **self-hosts**: the files are downloaded at build time and
 * served from our own origin, so the app still never issues a runtime request
 * to fonts.googleapis.com or fonts.gstatic.com (asserted by
 * `e2e/tests/app/design/fonts.spec.ts`). It also handles the `latin` /
 * `latin-ext` split itself — the hand-rolled `-ext` sibling families the
 * previous `localFont` setup needed are gone.
 *
 * Baloo 2 is a variable font (`wght` 400–800), so no `weight` is declared and
 * the whole axis is available. Poppins ships as statics, so its four documented
 * weights are listed explicitly.
 *
 * `fallback` is `['sans-serif']` to match the doc's own stack declaration —
 * "always with the `sans-serif` fallback, never a longer system stack".
 */
export const fontDisplay = Baloo_2({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-baloo-2',
  display: 'swap',
  preload: true,
  fallback: ['sans-serif'],
});

export const fontBody = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  style: 'normal',
  variable: '--font-poppins',
  display: 'swap',
  preload: true,
  fallback: ['sans-serif'],
});

/**
 * Material Symbols Outlined, the variable icon font — unchanged by the brand
 * swap (`typography.md` § "Material Symbols Outlined setup" keeps it). Stays
 * self-hosted from our own subset (`scripts/subset-icons.mjs`) rather than
 * coming from `next/font/google`: the full family is 10MB and we ship only the
 * codepoints `icon-codepoints.ts` names.
 *
 * `FILL` is driven from CSS (`.material-symbols-outlined` / `.icon-filled` in
 * globals.css) rather than from separate font files, so the filled state is a
 * single variation axis.
 */
export const fontIcon = localFont({
  src: './../styles/fonts/material-symbols-outlined.woff2',
  variable: '--font-material-symbols',
  weight: '100 700',
  style: 'normal',
  display: 'block',
  preload: false,
  adjustFontFallback: false,
  fallback: ['sans-serif'],
});

/** Every font variable, ready to drop on `<html>`. */
export const fontVariables = [fontDisplay.variable, fontBody.variable, fontIcon.variable].join(' ');
