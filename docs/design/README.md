# Kynite Design System — Source of Truth

This directory is the **single source of truth for design** in this repository. It supersedes and replaces all prior design references (the old green `#13ec92` / Lexend brand, the `stitch` mockups, and the old `docs/design/*` mockup folders — all deleted as part of installing this system).

Any time visual/UI decisions need to be made — color, type, spacing, radii, shadows, motion, component states — consult this directory first. If a value isn't documented here, treat `design-system.html` as the canonical rendered reference and extract the exact CSS from it; do not guess or reuse old values.

## Canonical artifact

**[`design-system.html`](./design-system.html)** is the original, unmodified design system export (kept verbatim — do not edit it). It's a self-contained "bundled" page: open it in a browser and it unpacks its own payload (React + fonts + content) client-side. All the markdown docs in this directory were produced by decoding that payload and transcribing its exact inline styles — every hex value, font spec, radius, shadow, and motion timing quoted here was copied from that file, not invented.

## Brand summary

- **Name**: Kynite — "Functional Warmth", the component system for the family planner. Systematic enough for daily logistics, warm enough for moments worth celebrating. Built on the shadcn/ui (New York) baseline.
- **Display/heading font**: `Baloo 2` (weights 400/600/700/800) — rounded, warm, high-personality.
- **Body font**: `Poppins` (weights 400/500/600/700) — clean, geometric, legible at small sizes.
- **Icons**: Material Symbols Outlined (variable font; `FILL 1` for filled/active state).
- **Primary**: `#5d5fef` (indigo) · **Secondary/accent**: `#ef8d5d` (orange) · **Background**: `#fbf9f4` (cream) · **Text**: `#191c1d` · **Secondary text**: `#747688` · **Border**: `#e1e3e4`.

Full palette in [`colors.md`](./colors.md).

## Sections

| Doc | Covers |
| --- | --- |
| [`brand.md`](./brand.md) | Logo/icon construction, wordmark, lockups |
| [`colors.md`](./colors.md) | Full color system: brand, surface, category palette (all in `oklch()`) |
| [`typography.md`](./typography.md) | Baloo 2 / Poppins type scale, weights, line-heights, letter-spacing |
| [`components.md`](./components.md) | Buttons, inputs, chips & badges, selection controls, avatars, cards |
| [`calendar.md`](./calendar.md) | Week strip, month grid/date picker, day agenda, event list item |
| [`layout.md`](./layout.md) | Sidebar + header + footer page shell (tablet/desktop "Hub") |
| [`rewards.md`](./rewards.md) | Star balance, savings goal, weekly star chart, reward store, approval queue |
| [`motion.md`](./motion.md) | Confetti, check-pop, streak shimmer, tap-target sizing, keyframes/durations |
| [`navigation.md`](./navigation.md) | Bottom tab bar |

## Component library

The system is implemented in two layers. **Consume these — do not hand-roll a
shape that is already here.** If a variant you need is missing, add it to the
component rather than writing a one-off class string in a page.

**Primitives** — `src/components/ui/*` (shadcn / Base UI, restyled onto these
tokens):

| Component | File | Doc section |
| --- | --- | --- |
| `Button` (`default`, `brand-outline`, `outline`, `ghost`, `destructive`, `gold`, `link`; sizes `xs…hub`, `tablet`, `icon-*`) | `ui/button.tsx` | `components.md` § Buttons |
| `Fab` | `ui/fab.tsx` | `components.md` § `Button/FAB` |
| `Input` (`default` underline, `search` pill, `bare`), `Textarea` | `ui/input.tsx`, `ui/textarea.tsx` | `components.md` § Inputs |
| `Field` / `FieldLabel` (uppercase `label-caps`, brand on focus) | `ui/field.tsx` | `components.md` § Inputs |
| `Badge` (`status`, `count`, `gold`, `muted`, `soft`, `now`, `today`…) | `ui/badge.tsx` | `components.md` § "Chips & badges" |
| `Card` (`default`, `muted`, `hero`, `inverse`, `outlined`) | `ui/card.tsx` | `components.md` § Cards |
| `Avatar` (`xs` 24 / `sm` 28 / `default` 32 / `lg` 44 / `hub` 56, `ring`) | `ui/avatar.tsx` | `components.md` § Avatars |
| `Icon` (Material Symbols, `filled` = `FILL 1`) | `ui/icon.tsx` | `typography.md` § Material Symbols |
| `Dialog`, `Sheet`, `Select`, `Tabs`, `Toast` | `ui/*.tsx` | — |

**Composites** — `src/components/kynite/*`, barrel at `@/components/kynite`:

| Component | File | Doc section |
| --- | --- | --- |
| `IconMedallion` | `kynite/icon-medallion.tsx` | `components.md` § Cards (`Card/Toast` icon badge), `motion.md` § "Checkbox pop" |
| `MemberFace` (+ `initialsFor`) | `kynite/member-face.tsx` | `components.md` § Avatars |
| `StarCount`, `StarMedallion` | `kynite/star-count.tsx` | `components.md` § `Chip/Star count`, `rewards.md` |
| `CategoryChip`, `CategoryDot` | `kynite/category-chip.tsx` | `colors.md` § "Category palette" |
| `ProgressBar` | `kynite/progress-bar.tsx` | `components.md` § `Card/Stat`, `motion.md` § "Streak shimmer" |
| `SectionHeading` | `kynite/section-heading.tsx` | `typography.md` § "Additional sizes" |
| `PageHeader` (`app` / `hub`) | `kynite/page-header.tsx` | `layout.md` § Header |
| `EmptyState` (`inline` / `page` / `hub`) | `kynite/empty-state.tsx` | — (product pattern, styled from the type scale) |
| `MediaRow` | `kynite/media-row.tsx` | `layout.md` § "Content area", `components.md` § `Card/Attention` |

Domain-aware wrapper: `MemberAvatar` (`src/modules/family/ui/member-avatar.tsx`)
resolves a member row onto `MemberFace` — use it whenever you have a `Member`.

Motion classes (`kynite-anim-pop`, `kynite-anim-check`, `kynite-anim-pop-big`,
`kynite-confetti-piece`, `kynite-confetti-piece-big`, `kynite-shimmer-sweep`)
and the `tnum` / `tabular-time` / `label-overline` utilities live in
`src/app/globals.css` under the names `motion.md` and `typography.md` give them.

## Assets

- [`assets/logo-icon.svg`](./assets/logo-icon.svg) — app icon mark ("Icon/App icon" in the source).
- [`assets/logo-horizontal.svg`](./assets/logo-horizontal.svg) — horizontal lockup, light card variant ("Lockup/Horizontal" in the source).

**Important caveat on the logo assets**: the source design system does not embed the logo as an SVG/raster file anywhere in its payload. The mark is built entirely at render time from CSS (two overlapping circles clipped inside a rounded square, plus a Material Symbols "star" glyph) — see [`brand.md`](./brand.md) for the exact recipe. The two SVGs here are a faithful hand-transcription of that literal CSS recipe (every color, offset, and radius copied from the source), with the Material Symbols "star" glyph approximated using the standard published Material Icons "star" (filled) path, since the exact font outline used couldn't be extracted from the subsetted `woff2` blob. They are **not** an extracted embedded asset — flagging this so nobody mistakes them for a pixel-exact export. These are not yet wired into `public/` (favicons, app icons, manifest) — that's left for a later pass.

## What changed

- Deleted `.claude/skills/brand-guidelines/` (old green `#13ec92` / Lexend brand skill).
- Deleted `docs/brand-guideline.md` (old top-level brand doc).
- Deleted the old `docs/design/{calendar,chores,dashboard,homepage,logo,reward-celebration,reward-chart,reward-store,ui,stitch}/` mockup folders and the old `docs/design/README.md`.
- Restyling application code to match this system is a **later phase** — this pass only installs the reference docs.
