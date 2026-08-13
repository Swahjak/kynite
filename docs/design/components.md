# Components — buttons, inputs, chips & badges, selection controls, avatars, cards

Source: `design-system.html`, sections `<!-- BUTTONS -->`, `<!-- INPUTS -->`, `<!-- CHIPS & BADGES -->`, `<!-- SELECTION CONTROLS -->`, `<!-- AVATARS -->`, `<!-- CARDS -->`.

## Buttons

All buttons: `font-family:'Baloo 2',sans-serif;font-weight:700;` pill-shaped (`border-radius:9999px`), `cursor:pointer` (or `not-allowed` when disabled). Standard height `48px`, padding `0 24px`.

| Variant (source label) | CSS |
| --- | --- |
| `Button/Primary` | `background:#5d5fef;color:#ffffff;font-size:14px;height:48px;padding:0 24px;border:none;border-radius:9999px;box-shadow:0 2px 8px rgba(93,95,239,0.28);` |
| `Button/Secondary` | `background:transparent;color:#5d5fef;font-size:14px;height:48px;padding:0 24px;border:2px solid #5d5fef;border-radius:9999px;` |
| `Button/Ghost` | `background:transparent;color:#434656;font-size:14px;height:48px;padding:0 24px;border:none;border-radius:9999px;` |
| `Button/Destructive` | `background:#ba1a1a;color:#ffffff;font-size:14px;height:48px;padding:0 24px;border:none;border-radius:9999px;` |
| `Button/Disabled` | `background:#e1e3e4;color:#747688;font-size:14px;height:48px;padding:0 24px;border:none;border-radius:9999px;cursor:not-allowed;` |
| `Button/Icon` | `width:48px;height:48px;border-radius:9999px;border:1px solid #c4c5d9;background:#ffffff;display:flex;align-items:center;justify-content:center;` — icon inside: `font-size:20px;color:#434656;` |
| `Button/FAB` | `width:56px;height:56px;border-radius:9999px;background:#5d5fef;color:#ffffff;border:none;box-shadow:0 4px 14px rgba(93,95,239,0.35);display:flex;align-items:center;justify-content:center;` — icon inside: `font-size:28px;` |

Card-context buttons at a smaller size also appear (e.g. layout shell's "Approve": `height:34px;font-size:12px;` — same shape/color rules, compressed for dense card contexts).

## Inputs

Grid of 220px-min columns, `gap:20px`, `max-width:760px`.

**Text field (default)**:
```css
background:#f5f3ee;border:none;border-bottom:2px solid #c4c5d9;
border-radius:8px 8px 0 0; /* top corners only — underline style */
padding:12px 14px;font-family:'Poppins',sans-serif;font-size:16px;color:#191c1d;outline:none;
```
Label above it: `font-family:'Baloo 2',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#434656;`

**Text field (focused)**: identical, except `border-bottom:2px solid #5d5fef;` and the label color becomes `#5d5fef`.

**Search field** (pill-shaped, icon-leading):
```css
display:flex;align-items:center;gap:10px;background:#f5f3ee;border-radius:9999px;padding:0 16px;height:48px;
/* leading icon */ font-size:20px;color:#747688; /* "search" */
/* input itself */ flex:1;border:none;background:transparent;font-family:'Poppins',sans-serif;font-size:15px;color:#191c1d;outline:none;
```

**Select/dropdown-style row** (e.g. "Recurring — Weekly"):
```css
display:flex;align-items:center;justify-content:space-between;background:#f5f3ee;border-radius:12px;padding:0 14px;height:48px;cursor:pointer;
/* label */ font-family:'Poppins',sans-serif;font-size:15px;color:#191c1d;
/* trailing icon */ font-size:20px;color:#747688; /* "expand_more" */
```

## Chips & badges

| Variant | CSS |
| --- | --- |
| `Badge/Count` | `background:rgba(186,26,26,0.1);color:#ba1a1a;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:10px;letter-spacing:0.05em;padding:6px 12px;border-radius:9999px;` — e.g. "2 NEW" |
| `Badge/Status` | `background:#5d5fef;color:#ffffff;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:10px;letter-spacing:0.05em;padding:5px 12px;border-radius:9999px;` — e.g. "NOW" |
| `Chip/Star count` | `display:inline-flex;align-items:center;gap:6px;background:rgba(239,141,93,0.16);color:#ef8d5d;font-family:'Poppins',sans-serif;font-weight:700;font-size:14px;padding:7px 14px;border-radius:9999px;` + leading filled star icon (`font-size:18px;font-variation-settings:'FILL' 1;`) |
| `Chip/Category` | see `colors.md` § Category palette — `oklch()`-driven bg/border/text per category hue, `padding:8px 16px;border-radius:9999px;font-family:'Baloo 2',sans-serif;font-weight:600;font-size:13px;` |
| `Chip/Removable` | `display:inline-flex;align-items:center;gap:8px;background:#e7e8e9;color:#434656;font-family:'Baloo 2',sans-serif;font-weight:600;font-size:13px;padding:8px 10px 8px 16px;border-radius:9999px;` + trailing `close` icon `font-size:16px;` |

## Selection controls

| Control | State | CSS |
| --- | --- | --- |
| Checkbox | Off | `width:24px;height:24px;border-radius:6px;border:2px solid #c4c5d9;` |
| Checkbox | On | `width:24px;height:24px;border-radius:6px;background:#006056;display:flex;align-items:center;justify-content:center;` + white `check` icon `font-size:16px;` |
| Radio | Off | `width:22px;height:22px;border-radius:9999px;border:2px solid #c4c5d9;` |
| Radio | On | `width:22px;height:22px;border-radius:9999px;border:6px solid #5d5fef;` (thick border creates the filled-dot look, no separate inner element) |
| Switch | On | `width:44px;height:26px;border-radius:9999px;background:#5d5fef;display:inline-flex;align-items:center;padding:3px;justify-content:flex-end;` + thumb `width:20px;height:20px;border-radius:9999px;background:#ffffff;` |
| Switch | Off | same track, `background:#c4c5d9;`, `justify-content` unset (thumb sits left) |

Label text alongside all controls: `font-family:'Poppins',sans-serif;font-size:15px;`.

## Avatars

Circular, `object-fit:cover`, `flex-shrink:0`. Source images are SVG illustrations embedded in the payload (4 characters: Mila, Daan, Lotte, "Parent" — decorative, not brand assets).

| Variant | CSS |
| --- | --- |
| `Avatar/Sizes` | Three sizes shown together: `32px`, `44px`, and `56px` (the 56px one gets a focus-style ring: `box-shadow:0 0 0 3px rgba(93,95,239,0.15);`). All `border-radius:9999px;`. |
| `Avatar/Group` | Stacked/overlapping: `width:40px;height:40px;border-radius:9999px;border:2px solid #fbf9f4;` each, with `margin-left:-12px` on all but the first for the overlap. |

Small avatar-in-list usage (event list item): `28px`, `border:2px solid #ffffff;`.

## Cards

All cards: `border-radius:24px` (or `20px` for the smaller reward-module cards — see `rewards.md`), `box-shadow:0 1px 2px rgba(0,0,0,0.04);` as the default resting elevation.

| Variant (source label) | CSS | Notes |
| --- | --- | --- |
| `Card/Attention` | `background:#f5f3ee;border-radius:24px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.04);position:relative;overflow:hidden;` | Has a decorative soft-blur glow: `position:absolute;top:-40px;right:-40px;width:128px;height:128px;background:rgba(93,95,239,0.06);border-radius:9999px;filter:blur(20px);`. Contains avatar + copy + two action buttons (`Approve` primary, `Deny` secondary with `border:1px solid rgba(93,95,239,0.2)`). |
| `Card/Stat` | `background:#ffffff;border-radius:24px;padding:18px;box-shadow:0 1px 2px rgba(0,0,0,0.04);` | Header row separated by `border-bottom:1px solid #e1e3e4;padding-bottom:16px;margin-bottom:16px;`. Progress bar: `width:100%;height:8px;border-radius:9999px;background:#e1e3e4;overflow:hidden;` with fill `background:#71f8e4;border-radius:9999px;` at the percentage width. |
| `Card/Toast` | `background:#2e3132;border-radius:24px;padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,0.18);` | Leading icon badge: `width:32px;height:32px;border-radius:9999px;background:rgba(93,95,239,0.25);` with icon `color:#b8c3ff;`. Text `color:#f0f1f2;`. Trailing dismiss `close` icon at `opacity:0.7`. |

Grid layout for card rows: `display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;`.
