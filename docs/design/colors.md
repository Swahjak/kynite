# Colors

Source: `design-system.html`, section `<!-- COLORS -->`, plus colors used throughout other sections. All values quoted verbatim from inline styles. Where the source uses `oklch()`, that's the literal authored value — CSS renders it natively (Tailwind 4 / all modern browsers), so prefer using the `oklch()` string directly rather than an approximated hex when writing CSS. The hex columns below are a **computed sRGB approximation** (out-of-gamut clipped) for reference/tools that need hex.

## Brand & semantic palette

| Token | Value | Notes |
| --- | --- | --- |
| Primary | `#5d5fef` | Indigo. Primary buttons, links (`a { color: #5d5fef; }`, hover `#4547c9`), active nav state, focus rings. |
| Primary Container | `#2e5bff` | |
| Secondary | `#ef8d5d` | Orange/accent. Stars, rewards, celebration, "12 stars" chip. |
| Secondary Container | `#fcecd5` | |
| Tertiary | `#006056` | Deep teal. Used for checked checkbox fill. |
| Tertiary Fixed | `#71f8e4` | Bright mint. Used for progress-bar fill accents (e.g. "3 of 4 tasks" bar), confetti piece. |
| Error | `#ba1a1a` | Destructive button background. |
| Error Container | `#ffdad6` | |

## Surface palette

| Token | Value | Notes |
| --- | --- | --- |
| Surface | `#fbf9f4` | App background (cream). Has `1px solid #e1e3e4` border swatch in source. |
| Surface Lowest | `#ffffff` | Cards, inputs-on-cream contrast, sidebar bg. |
| Surface Container | `#f5f3ee` | Input fill, secondary card bg (e.g. attention card, savings-goal-adjacent tiles). |
| Surface Container High | `#e7e8e9` | Removable-chip bg. |
| On Surface | `#191c1d` | Primary text. Also dark-surface bg (toast card, celebration card, nav-lockup dark variant). |
| On Surface Variant | `#434656` | Secondary/body text, ghost-button text. |
| Outline Variant | `#c4c5d9` | Borders, unchecked radio/switch, divider lines in agenda. |
| Inverse Surface | `#2e3132` | Toast card background. |

Additional neutrals seen in components (not in the swatch grid but used elsewhere): `#f0f1f2` (text-on-dark), `#747688` (muted/secondary label color, e.g. "Secondary text"), `#b8c3ff` (light indigo, confetti + icon-on-dark), `#fecf6e` (yellow, confetti + trophy icon).

## Category palette

8 categories, each defined as a 4-color set generated from a shared hue in `oklch()`: dot/solid at `oklch(58% 0.14 H)`, chip background at `oklch(94% 0.025 H)`, chip border at `oklch(85% 0.05 H)`, chip text at `oklch(32% 0.08 H)`.

| Category | Hue (H) | Dot / solid `oklch(58% 0.14 H)` | Chip bg `oklch(94% 0.025 H)` | Chip border `oklch(85% 0.05 H)` | Chip text `oklch(32% 0.08 H)` |
| --- | --- | --- | --- | --- | --- |
| School | 245 | `oklch(58% 0.14 245)` ≈ `#1380c7` | `oklch(94% 0.025 245)` ≈ `#deedfb` | `oklch(85% 0.05 245)` ≈ `#b3d2ed` | `oklch(32% 0.08 245)` ≈ `#013658` |
| Sports | 155 | `oklch(58% 0.14 155)` ≈ `#0e9254` | `oklch(94% 0.025 155)` ≈ `#dff0e4` | `oklch(85% 0.05 155)` ≈ `#b5d8c0` | `oklch(32% 0.08 155)` ≈ `#003e20` |
| Health | 20 | `oklch(58% 0.14 20)` ≈ `#bf5257` | `oklch(94% 0.025 20)` ≈ `#fce5e4` | `oklch(85% 0.05 20)` ≈ `#edc1c0` | `oklch(32% 0.08 20)` ≈ `#541f21` |
| Chores | 290 | `oklch(58% 0.14 290)` ≈ `#7b69c6` | `oklch(94% 0.025 290)` ≈ `#eae9fb` | `oklch(85% 0.05 290)` ≈ `#cdc9ed` | `oklch(32% 0.08 290)` ≈ `#332a58` |
| Family | 335 | `oklch(58% 0.14 335)` ≈ `#ab569b` | `oklch(94% 0.025 335)` ≈ `#f6e5f2` | `oklch(85% 0.05 335)` ≈ `#e3c2db` | `oklch(32% 0.08 335)` ≈ `#4b2143` |
| Personal | 200 | `oklch(58% 0.14 200)` ≈ `#00919b` | `oklch(94% 0.025 200)` ≈ `#d9f1f2` | `oklch(85% 0.05 200)` ≈ `#a8d8db` | `oklch(32% 0.08 200)` ≈ `#003e43` |
| Play | 110 | `oklch(58% 0.14 110)` ≈ `#808000` | `oklch(94% 0.025 110)` ≈ `#ecedda` | `oklch(85% 0.05 110)` ≈ `#cfd1ac` | `oklch(32% 0.08 110)` ≈ `#363600` |
| Travel | 65 | `oklch(58% 0.14 65)` ≈ `#b16500` | `oklch(94% 0.025 65)` ≈ `#f7e8da` | `oklch(85% 0.05 65)` ≈ `#e5c8ac` | `oklch(32% 0.08 65)` ≈ `#4e2800` |

Category chip markup pattern (from source, "School" example):

```css
display:inline-flex;align-items:center;gap:8px;
padding:8px 16px;border-radius:9999px;
background: oklch(94% 0.025 245);
border: 1px solid oklch(85% 0.05 245);
color: oklch(32% 0.08 245);
font-family:'Baloo 2',sans-serif;font-weight:600;font-size:13px;
```

Small dot-only usage (calendar strip/month grid event markers): `width/height: 4-8px; border-radius: 9999px; background: oklch(58% 0.14 H);` at the relevant hue.

## Brand-mark-only colors

The brand icon composition blends two hues not otherwise in the category palette:

- Base: `oklch(58% 0.14 245)` (same hue as "School" — indigo/blue)
- Blob: `oklch(58% 0.14 335 / 0.85)` (same hue as "Family" — magenta/pink, at 85% alpha)
- Blob: `#5d5fef` at `opacity: 0.85` (brand primary, not oklch here)

## Usage notes captured from the source

- Links: `a { color: #5d5fef; } a:hover { color: #4547c9; }`
- Body text on cream background: `color: #191c1d` (primary), `#434656` (secondary/body copy).
- Muted/meta text (timestamps, captions): `#747688`.
- Focused input border: `#5d5fef` (2px), replacing the default unfocused `#c4c5d9` (2px) bottom border.
