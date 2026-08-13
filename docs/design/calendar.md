# Calendar

Source: `design-system.html`, section `<!-- CALENDAR -->`.

> "The core of the family planner — a week strip, month grid, day agenda, and event list all sharing the same category color language."

Container style shared by all sub-blocks: `background:#ffffff;border-radius:24px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.04);` (event list item container uses `padding:8px` instead, since rows carry their own padding).

Sub-block eyebrow labels (e.g. "Week strip", "Month view / date picker", "Day agenda"): `display:block;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#747688;margin-bottom:14px;`

## Week strip

7-column grid: `display:grid;grid-template-columns:repeat(7,1fr);gap:8px;`

Each day cell (default): `display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 0;border-radius:16px;`
- Day-of-week label: `font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;color:#747688;` (e.g. "MON")
- Date number: `class="tnum" font-family:'Poppins',sans-serif;font-weight:500;font-size:15px;`

**Today/selected cell**: `background:#5d5fef;` with label `color:rgba(255,255,255,0.75);` and date `font-weight:700;color:#ffffff;`.

**Day with event(s), not selected**: adds a small dot indicator using the relevant category hue, positioned `position:relative;` on the cell with `span { width:5px;height:5px;border-radius:9999px;background:oklch(58% 0.14 H);position:absolute;bottom:4px; }`.

## Month view / date picker

Header row: `display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;` with `chevron_left` / `chevron_right` icons (`font-size:20px;color:#747688;`) flanking the month/year label (`font-family:'Baloo 2',sans-serif;font-weight:700;font-size:16px;`).

Weekday header row: `display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;` — each letter: `text-align:center;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;color:#747688;`.

Day grid: `display:grid;grid-template-columns:repeat(7,1fr);gap:4px;` — leading empty cells are bare `<span></span>` for offset.

Each date cell (default): `display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;` with number `class="tnum" font-family:'Poppins',sans-serif;font-size:13px;`.

**Date with event**: adds `position:relative;` + a `4px × 4px` dot at `border-radius:9999px;background:oklch(58% 0.14 H);position:absolute;bottom:1px;` in the day's category hue (multiple different hues shown across the sample month — school/blue 245, sports/green 155, family/pink 335, travel/orange 65).

**Selected date**: `display:flex;flex-direction:column;align-items:center;padding:6px 0;background:#5d5fef;border-radius:9999px;` with number `font-weight:700;color:#ffffff;` (no `gap`, no dot — the pill itself is the indicator).

## Day agenda

Vertical timeline: `display:flex;flex-direction:column;`. Each row: `display:flex;gap:14px;`.

Time column: `display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0;` — time label `class="tnum" font-family:'Poppins',sans-serif;font-size:13px;color:#434656;` (or `font-weight:700;color:#5d5fef;` for the current/next event). A vertical connector line follows: `width:1px;flex:1;background:#c4c5d9;min-height:22px;margin-top:4px;` (omitted on the last row).

**Past/dimmed events**: whole row gets `opacity:0.55;`.

**Current/"NOW" event** gets an accent treatment:
- A left accent bar: `position:absolute;left:-20px;top:0;bottom:0;width:4px;background:#ef8d5d;border-radius:0 4px 4px 0;` (bar uses the orange accent, independent of the event's own category color)
- Content block: `flex:1;background:rgba(93,95,239,0.06);border-radius:0 12px 12px 0;padding:8px 12px;margin-left:-8px;margin-bottom:8px;`
- Title row: category dot (`8px`, category hue) + title (`font-weight:700;font-size:14px;`) + a `NOW` status badge (see `components.md` § Badge/Status)
- Sub-label (attendees): `font-family:'Poppins',sans-serif;font-size:12px;color:#434656;margin-left:16px;margin-top:2px;`

**Regular (non-current) event row**: category dot (`8px`) + title `font-family:'Poppins',sans-serif;font-size:14px;` (weight 400, not bold), sub-label `font-size:12px;color:#434656;margin-left:16px;`.

## Event list item

Rows in a `background:#ffffff;border-radius:24px;padding:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04);` container, each row: `display:flex;align-items:center;gap:14px;padding:14px 16px;border-top:1px solid #e1e3e4;` (first divider comes right after the section eyebrow label).

Structure per row:
1. Category color bar: `width:4px;align-self:stretch;border-radius:9999px;background:oklch(58% 0.14 H);`
2. Time column: `display:flex;flex-direction:column;width:56px;flex-shrink:0;` — start time `class="tnum" font-weight:600;font-size:14px;`, end time `class="tnum" font-size:12px;color:#747688;`
3. Title/location column: `display:flex;flex-direction:column;flex:1;min-width:0;` — title `font-weight:600;font-size:15px;`, location/meta `font-size:12px;color:#434656;`
4. Trailing avatar: `width:28px;height:28px;border-radius:9999px;border:2px solid #ffffff;object-fit:cover;`
