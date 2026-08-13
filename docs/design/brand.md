# Brand mark

Source: `design-system.html`, section `<!-- BRAND MARK -->`.

## Icon / App icon

A 120×120 rounded-square mark composited from two overlapping circles clipped inside a rounded square, with a centered white star glyph.

```css
/* container */
width: 120px; height: 120px;
border-radius: 28px;
position: relative;
overflow: hidden;
background: oklch(58% 0.14 245);            /* base indigo */
box-shadow: 0 8px 24px rgba(0,0,0,0.2);

/* blob A — top-left */
position: absolute;
width: 112px; height: 112px;
border-radius: 9999px;
left: -38px; top: -30px;
background: oklch(58% 0.14 335 / 0.85);      /* magenta/pink, 85% alpha */

/* blob B — bottom-right */
position: absolute;
width: 112px; height: 112px;
border-radius: 9999px;
right: -41px; bottom: -38px;
background: #5d5fef;                         /* brand indigo */
opacity: 0.85;

/* glyph */
position: absolute; inset: 0;
display: flex; align-items: center; justify-content: center;
/* Material Symbols Outlined, "star", FILL 1 */
font-size: 74px;
color: #ffffff;
filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));
```

Labeled in source: `Icon/App icon`.

## Lockup / Horizontal

Two variants shown side by side, both labeled together as `Lockup/Horizontal`.

### Light card variant

```css
/* card */
background: #ffffff;
border: 1px solid #e1e3e4;
border-radius: 16px;
padding: 20px 28px;
display: flex; align-items: center; gap: 14px;

/* mini icon — 44x44, same 2-blob recipe scaled down */
width: 44px; height: 44px;
border-radius: 11px;
/* blob A: 42x42 circle, left:-14px, top:-11px, oklch(58% 0.14 335 / 0.85) */
/* blob B: 42x42 circle, right:-15px, bottom:-13px, #5d5fef @ 0.85 opacity */
/* glyph: star, 27px, white */

/* wordmark */
font-family: 'Baloo 2', sans-serif;
font-weight: 700;
font-size: 28px;
letter-spacing: -0.01em;
color: #191c1d;
```

### Dark/reversed variant

```css
/* card */
background: #191c1d;
border-radius: 16px;
padding: 18px 26px;
display: flex; align-items: center; gap: 12px;

/* mini icon — 36x36, same 2-blob recipe scaled down further */
width: 36px; height: 36px;
border-radius: 9px;
/* blob A: 34x34 circle, left:-12px, top:-9px */
/* blob B: 34x34 circle, right:-13px, bottom:-11px */
/* glyph: star, 22px, white */

/* wordmark */
font-family: 'Baloo 2', sans-serif;
font-weight: 700;
font-size: 22px;
letter-spacing: -0.01em;
color: #ffffff;
```

## Wordmark alone (page title)

Used at the top of the design system page itself:

```css
font-family: 'Baloo 2', sans-serif;
font-weight: 800;
font-size: 56px;
line-height: 1.04;
letter-spacing: -0.03em;
color: #191c1d;
```

Eyebrow label above it:

```css
font-family: 'Baloo 2', sans-serif;
font-weight: 700;
font-size: 12px;
letter-spacing: 0.08em;
text-transform: uppercase;
color: #5d5fef;
```

## Sidebar/nav mini mark

A minimal circular "K" badge is used in the page-layout sidebar, distinct from the full icon composition:

```css
width: 28px; height: 28px;
border-radius: 9999px;
background: #5d5fef;
color: #ffffff;
display: flex; align-items: center; justify-content: center;
font-family: 'Baloo 2', sans-serif;
font-weight: 800;
font-size: 13px;
/* content: "K" */
```

## Assets and their limits

- [`assets/logo-icon.svg`](./assets/logo-icon.svg) and [`assets/logo-horizontal.svg`](./assets/logo-horizontal.svg) transcribe the CSS recipes above exactly (all colors/offsets/radii copied 1:1).
- The design system's payload does **not** contain an embedded logo image (checked the full resource manifest: only 4 avatar illustration SVGs, JS chunks, and font `woff2` files — no logo/icon asset). The mark is generated purely from CSS + an icon-font glyph at render time.
- The star glyph in the SVGs uses the standard published Material Icons "star" (filled) path as a stand-in for the exact Material Symbols Outlined glyph (FILL 1), since the real glyph outline lives inside a subsetted `woff2` font blob in the payload and isn't trivially extractable as a path. Visually equivalent, not byte-exact.
- Not yet wired into `public/` (favicon, apple-touch-icon, manifest icons) — left for a later pass per task scope.
