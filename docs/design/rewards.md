# Rewards

Source: `design-system.html`, section `<!-- REWARDS -->`.

> "Stars earned from routines, spent in the reward store. Claims go through a parent approval queue; the horizon — same-day treats vs. a savings goal — adapts to the child's age."

Standard module card in this section: `background:#ffffff;border-radius:20px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.04);` (note: **20px** radius here, distinct from the 24px used for calendar/general cards). Module heading: `display:block;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:16px;margin-bottom:14px;`.

## Star balance

Ring layout: `display:grid;grid-template-columns:1fr 1.4fr;gap:20px;` pairs this with the savings-goal card.

```css
display:flex;align-items:center;gap:18px;
```

Ring: `position:relative;width:88px;height:88px;flex-shrink:0;border-radius:9999px;background:conic-gradient(#ef8d5d 0% 65%, #e1e3e4 65% 100%);display:flex;align-items:center;justify-content:center;` — the `0% 65%` split is the literal demo value (65% "filled"), driven dynamically in real use.

Inner disc (creates the ring effect by covering the conic-gradient's center): `width:68px;height:68px;border-radius:9999px;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;` containing:
- Count: `class="tnum" font-family:'Baloo 2',sans-serif;font-weight:800;font-size:22px;`
- Unit label: `font-family:'Baloo 2',sans-serif;font-weight:700;font-size:9px;letter-spacing:0.05em;text-transform:uppercase;color:#747688;` ("stars")

Adjacent: avatar (`28px`) + name (`font-family:'Baloo 2',sans-serif;font-weight:700;font-size:16px;`), and an "Award bonus stars" secondary-style pill button: `display:flex;align-items:center;gap:8px;background:#f5f3ee;color:#434656;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:14px;border:none;border-radius:9999px;height:48px;padding:0 20px;width:fit-content;` with leading `add` icon (`18px`).

## Savings goal

```css
display:flex;flex-direction:column;gap:10px;
```

Header row: `display:flex;align-items:center;justify-content:space-between;` — left side stacked eyebrow (`font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#747688;` e.g. "Savings goal · ages 8–12") + goal name (`font-family:'Baloo 2',sans-serif;font-weight:700;font-size:18px;` e.g. "New bike"); right side a relevant icon at `font-size:32px;color:#ef8d5d;` (e.g. `pedal_bike`).

Progress bar: `width:100%;height:10px;border-radius:9999px;background:#e1e3e4;overflow:hidden;` with fill `height:100%;background:#ef8d5d;border-radius:9999px;` at the percentage width (orange, not the mint used for the stat-card bar — savings goals use the accent color).

Footer row: `display:flex;justify-content:space-between;` — `class="tnum" font-weight:600;font-size:13px;color:#434656;` count (e.g. "31 / 50 stars") and `font-size:13px;color:#747688;` percentage.

## Weekly star chart

Grid: `display:grid;grid-template-columns:1.6fr repeat(7,1fr);gap:0;grid-auto-rows:56px;` — first column is the chore/task label, remaining 7 are Mon–Sun.

Day header cells: `text-align:center;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;color:#747688;padding-bottom:8px;` — the "current day" column header is highlighted `color:#5d5fef;` instead.

Row label cell: `display:flex;align-items:center;gap:8px;padding:10px 8px 10px 0;border-top:1px solid #e1e3e4;` with a category-hue icon (`font-size:16px;color:oklch(58% 0.14 H);`) + task name (`font-family:'Poppins',sans-serif;font-size:13px;`).

Day cells (per chore, per day) all share `display:flex;align-items:center;justify-content:center;border-top:1px solid #e1e3e4;`; the "current day" column additionally gets `background:rgba(93,95,239,0.04);` on every cell in that column. Cell states:
- **Done**: filled star icon, `font-size:20px;color:#ef8d5d;font-variation-settings:'FILL' 1;`
- **Missed**: `close` icon, `font-size:16px;color:#c4c5d9;`
- **Partially/alt-done**: `check_circle` icon, `font-size:18px;color:#c4c5d9;` (used once in the sample, for a not-fully-earned state)
- **Empty/future**: `width:14px;height:14px;border-radius:9999px;border:2px solid #c4c5d9;` (an empty ring)
- **Not-applicable/blank**: bare `border-top:1px solid #e1e3e4;` cell with no content

Footer: `display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #e1e3e4;` — left: hint text with `info` icon, `font-size:13px;color:#747688;`; right: `font-size:13px;color:#434656;` with the count in `<b class="tnum" style="color:#191c1d;">`.

## Reward store

```css
display:grid;grid-template-columns:repeat(3,1fr);gap:14px;
```

Reward tile: `border:1px solid #e1e3e4;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;`
- Icon badge: `width:40px;height:40px;border-radius:12px;background:oklch(94% 0.025 H);display:flex;align-items:center;justify-content:center;` with icon `font-size:20px;color:oklch(45% 0.14 H);` — note this icon color uses **45% lightness** at full 0.14 chroma, distinct from the 32%/0.08 chip-text tone used for category chips elsewhere.
- Title: `font-family:'Poppins',sans-serif;font-weight:600;font-size:14px;`
- Cost: `display:inline-flex;align-items:center;gap:4px;color:#ef8d5d;font-family:'Poppins',sans-serif;font-weight:700;font-size:13px;` + filled star icon `font-size:16px;`
- Action button, full-width `48px` tall, pill: **affordable** → primary style (`background:#5d5fef;color:#ffffff;`, label "Claim"); **locked/out of reach** → tile gets `opacity:0.5;` and button becomes disabled style (`background:#e1e3e4;color:#747688;cursor:not-allowed;`, label e.g. "Need 6 more")

## Approval queue

```css
display:flex;flex-direction:column;gap:14px;
```

Request row: `display:flex;gap:10px;align-items:flex-start;` — avatar (`32px`) + text column (`flex:1`):
- Request line: `font-family:'Poppins',sans-serif;font-size:13px;` with the reward name bolded inline (`<b>`)
- Cost: `display:inline-flex;align-items:center;gap:4px;color:#ef8d5d;font-family:'Poppins',sans-serif;font-weight:700;font-size:12px;margin-top:2px;` + filled star icon `font-size:14px;`
- Actions: `display:flex;gap:8px;margin-top:8px;` — `Approve` (primary) / `Deny` (secondary, `border:1px solid rgba(93,95,239,0.2)`), both `flex:1;height:48px;`

## Instant horizon (younger-child reward mode)

```css
background:#f5f3ee;border-radius:20px;padding:18px;
```

Eyebrow: `display:block;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#747688;margin-bottom:12px;` (e.g. "Ages 4–7 · Instant horizon").

Reward pills: `display:inline-flex;align-items:center;gap:6px;background:#ffffff;border-radius:9999px;padding:13px 18px;font-family:'Poppins',sans-serif;font-weight:600;font-size:14px;` with cost suffix in a `<span style="color:#ef8d5d;">` (e.g. "Extra bedtime story · 3").

## Celebration moment card

```css
background:#191c1d;border-radius:20px;padding:18px;position:relative;overflow:hidden;
```

Confetti pieces (`.kynite-confetti-piece-big`, see `motion.md`) positioned around `left:80%;top:50%;` with per-piece `--tx`/`--ty`/`--tr` CSS custom properties and staggered `animation-delay`.

Eyebrow: `color:#b8c3ff;` (11px caps, same pattern as other eyebrows). Body copy: `font-family:'Poppins',sans-serif;font-size:13px;color:#f0f1f2;margin:0 0 12px;max-width:320px;`. CTA button: primary pill with a leading `celebration` icon carrying the `kynite-anim-pop-big` animation class (`font-size:20px;`), label "Claimed!".
