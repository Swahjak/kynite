# Typography

Source: `design-system.html`, section `<!-- TYPOGRAPHY -->`, plus the `@font-face` declarations in `<helmet><style>`.

## Font families

| Family | Role | Weights loaded | Source |
| --- | --- | --- | --- |
| `Baloo 2` | Display / headings / labels / numerals-with-personality | 400, 600, 700, 800 | Google Fonts, self-hosted `woff2` subsets (devanagari, vietnamese, latin-ext, latin) per weight |
| `Poppins` | Body copy, UI text | 400, 500, 600, 700 | Google Fonts, self-hosted `woff2` subsets, same subset pattern |
| `Material Symbols Outlined` | Icons | 100–700 (variable) | Single `woff2`. Applied via `.material-symbols-outlined` class |

Base stack declarations used throughout: `font-family:'Baloo 2',sans-serif;` and `font-family:'Poppins',sans-serif;` — always with the `sans-serif` fallback, never a longer system stack.

Root page font: `font-family:'Poppins',sans-serif;` on the outermost content wrapper; `body { margin:0; -webkit-font-smoothing:antialiased; }`.

### Material Symbols Outlined setup

```css
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
}
```

Filled/active state: add inline `font-variation-settings:'FILL' 1;` (used for the star icon, checkmark badges, etc.) — the class default is `FILL 0` (outlined).

### Tabular numerals

```css
.tnum { font-variant-numeric: tabular-nums; }
```

Applied to any numeral that needs stable width in a row (dates, times, star counts, point totals) — e.g. `08:45 · 12 pts`, calendar day-of-month numbers, star balance "24".

## Type scale

Exact specimens from the Typography section, each shown with its literal CSS and the source's own naming/annotation:

| Name (as labeled in source) | Family / weight | Size / line-height | Letter-spacing | Example content |
| --- | --- | --- | --- | --- |
| `display-hub` | Baloo 2 800 | 72px / 80px | `-0.04em` | `18:00` |
| `headline-lg` | Baloo 2 700 | 32px / 40px | `-0.02em` | `Today at home` |
| `headline-md` | Baloo 2 600 | 20px / 28px | (none set) | `Needs your attention` |
| `body-lg` | Poppins 400 | 18px / 28px | (none set) | `Movie night pick — 12 stars` |
| `body-md` | Poppins 400 | 16px / 24px | (none set) | `Bring gym clothes` |
| `tabular-num` | Poppins 500 | 16px / 24px | (none set) | `08:45 · 12 pts` — with `.tnum` |
| `label-caps` | Baloo 2 700 | 12px / 16px | `0.05em`, `text-transform: uppercase` | `MONDAY, OCT 23` |

Exact inline style for each (copied verbatim):

```css
/* display-hub */
font-family:'Baloo 2',sans-serif;font-weight:800;font-size:72px;line-height:80px;letter-spacing:-0.04em;

/* headline-lg */
font-family:'Baloo 2',sans-serif;font-weight:700;font-size:32px;line-height:40px;letter-spacing:-0.02em;

/* headline-md */
font-family:'Baloo 2',sans-serif;font-weight:600;font-size:20px;line-height:28px;

/* body-lg */
font-family:'Poppins',sans-serif;font-weight:400;font-size:18px;line-height:28px;

/* body-md */
font-family:'Poppins',sans-serif;font-weight:400;font-size:16px;line-height:24px;

/* tabular-num */
font-family:'Poppins',sans-serif;font-weight:500;font-size:16px;line-height:24px; /* + class="tnum" */

/* label-caps */
font-family:'Baloo 2',sans-serif;font-weight:700;font-size:12px;line-height:16px;letter-spacing:0.05em;text-transform:uppercase;
```

## Additional sizes seen elsewhere in the system (not in the scale table but real, in-use styles)

These recur across components and are worth treating as de-facto scale steps:

| Size | Weight/family | Where used |
| --- | --- | --- |
| 56px / 1.04 / `-0.03em` | Baloo 2 800 | Page H1 ("Kynite" title on the design system page itself) |
| 28px / `-0.01em` | Baloo 2 700 | Horizontal lockup wordmark (light card) |
| 24px | Baloo 2 700 | Section headings (`<h2>`), `border-bottom:1px solid #e1e3e4; padding-bottom:14px;` |
| 22px / `-0.01em` | Baloo 2 700 | Horizontal lockup wordmark (dark variant) |
| 18px | Baloo 2 700 | Card/section sub-headings (e.g. "New bike" savings goal title, "Weekly star chart") |
| 17px | Baloo 2 700 | Page-shell header title |
| 16px | Baloo 2 700 | Card headings ("Reward store", "Approval queue") |
| 15px | Poppins 400 | Standard body/paragraph text, nav item labels |
| 14px | Baloo 2 700 (buttons) / Poppins 400 or 600 (body) | Button label size; secondary card text |
| 13px | Baloo 2 600 (chip text) / Poppins 400–600 | Category chip labels, meta text, caption/spec labels next to specimens |
| 12px | Poppins 400 | Small meta text (avatar sub-label, "3 of 4 tasks done") |
| 11px | Baloo 2 700, uppercase, `letter-spacing:0.05em` | Section eyebrow labels ("Week strip", "Month view / date picker", "Day agenda") |
| 10px | Baloo 2 700, uppercase, `letter-spacing:0.05em` | Micro badges ("NOW", "2 NEW"), bottom-nav labels |

## Paragraph / intro copy style

Section intro paragraphs (e.g. under Calendar, Rewards, Motion headings):

```css
font-family:'Poppins',sans-serif;font-size:15px;color:#434656;margin:0 0 24px;max-width:640px; /* or 680px */
```

Page-level intro paragraph (under the H1):

```css
font-family:'Poppins',sans-serif;font-weight:400;font-size:18px;line-height:28px;color:#434656;max-width:620px;margin:16px 0 0;
```

## Component spec / annotation label style

Used throughout the design system to label each specimen (e.g. `Button/Primary`, `Icon/App icon`) — not part of the product type scale, but documented here since it's a real, repeated style:

```css
display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:11px;
color:#5d5fef;background:rgba(93,95,239,0.08);padding:3px 8px;border-radius:6px;
```
