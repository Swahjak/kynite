import localFont from 'next/font/local';

/**
 * Self-hosted brand fonts (docs/brand-guideline.md "Typography"/"Iconography").
 *
 * The .woff2 files live in `src/styles/fonts` and are served from our own
 * origin — the app never issues a runtime request to fonts.googleapis.com or
 * fonts.gstatic.com, which an e2e test asserts.
 *
 * Each family ships the `latin` subset. `latin-ext` is registered as a separate
 * family and chained after the primary one in `--font-sans` / `--font-display`
 * (see globals.css) so the browser only downloads it when a glyph outside
 * Latin-1 is actually rendered.
 *
 * The main display/body fonts set `fallback: []` and `adjustFontFallback: false`
 * so next/font doesn't embed a generic (or metric-adjusted) fallback inside the
 * `--font-lexend` / `--font-noto-sans` CSS variables themselves. If it did, the
 * embedded generic would sit *before* the `-ext` family once globals.css chains
 * `var(--font-lexend), var(--font-lexend-ext), ui-sans-serif, ...` — making the
 * ext family (and its latin-ext woff2) unreachable by the CSS font-matching
 * algorithm. The full fallback chain is built explicitly in globals.css instead.
 */

export const fontDisplay = localFont({
  src: './../styles/fonts/lexend-latin.woff2',
  variable: '--font-lexend',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: [],
  adjustFontFallback: false,
});

export const fontDisplayExt = localFont({
  src: './../styles/fonts/lexend-latin-ext.woff2',
  variable: '--font-lexend-ext',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const fontBody = localFont({
  src: './../styles/fonts/noto-sans-latin.woff2',
  variable: '--font-noto-sans',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: [],
  adjustFontFallback: false,
});

export const fontBodyExt = localFont({
  src: './../styles/fonts/noto-sans-latin-ext.woff2',
  variable: '--font-noto-sans-ext',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

/**
 * Material Symbols Outlined, the variable icon font. `FILL` is driven from CSS
 * (`.material-symbols-outlined` / `.icon-filled` in globals.css) rather than
 * from separate font files, so the filled state is a single variation axis.
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
export const fontVariables = [
  fontDisplay.variable,
  fontDisplayExt.variable,
  fontBody.variable,
  fontBodyExt.variable,
  fontIcon.variable,
].join(' ');
