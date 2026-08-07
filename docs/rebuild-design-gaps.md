# Kynite — design parity gap report

Audit date: 2026-08-07. Read-only audit of the implemented app against
`docs/design/stitch/` and `.claude/skills/brand-guidelines/`.

Severity key:

| Code   | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| **S1** | Root cause. A system-level decision that makes many screens wrong at once.        |
| **S2** | Screen-level. This surface's layout/composition does not match its mockup.        |
| **S3** | Polish. Right structure, wrong radius/shadow/motion/spacing.                       |

---

## 0. Headline finding — read this first

**The common failure did not happen here.** The hypothesis that "shadcn new-york
defaults were used everywhere and the mockup styling was never applied" is
**false**, and it is worth stating plainly so effort is not spent re-doing work
that already exists:

- The full brand palette **is** defined and wired: `src/app/globals.css:22-153`
  (light), `:155-261` (dark), aliased onto every shadcn/Base-UI semantic token
  (`--primary: var(--brand)` at `globals.css:117`) and exposed as Tailwind
  colour utilities in `@theme inline` at `globals.css:343-447`.
- **Lexend and Noto Sans are genuinely loaded**, self-hosted via `next/font/local`
  (`src/lib/fonts.ts:24`, `:45`), chained in `globals.css:270-274`, applied to
  `<html>` at `src/app/[locale]/layout.tsx:65` and to headings at
  `globals.css:586-593`. There is no runtime Google Fonts request.
- **Material Symbols Outlined is real**, self-hosted and subset
  (`src/lib/fonts.ts:71`, `src/components/ui/icon.tsx`,
  `src/components/ui/icon-codepoints.ts`), with the `material-symbols-outlined`
  utility at `globals.css:473-493` and an `icon-filled` variant at `:495-501`.
- **The event-colour treatment is correct**: `src/modules/calendar/ui/event-chip.tsx:109`
  is literally `… rounded-lg border-l-4 px-2 py-1 …` plus
  `palette.surface`/`palette.border` from the 8-colour table in
  `src/modules/calendar/ui/tokens.ts:10-62` (`bg-cat-*-surface` +
  `border-cat-*-border`). 4px left border + tint, exactly as specified.
- Brand type utilities are in real use, not decorative: `font-display` ×121,
  `text-ink-secondary` ×99, `text-body-sm` ×71, `tabular-time` ×33,
  `label-overline` ×23 across `src/**/*.tsx`.

So the **token layer is one of the strongest parts of this codebase.** The
reason the app "looks nothing like the designs" is three other things:

1. **The mockups in `docs/design/stitch/` describe a different design system
   entirely** from the one the brand guideline and the code implement (§1). This
   is the single largest contributor and it is a *decision*, not a bug.
2. **Layout and composition were never taken from the mockups** — the nav
   paradigm, the hero cards, the page furniture (§2–§4). The right paint was
   applied to the wrong building.
3. **Icon and interaction systems are split** between two libraries and two
   conventions (§5).

---

## 1. S1 — Three mutually incompatible design authorities exist in this repo

This is the root of "looks nothing like the designs". `docs/design/stitch/` and
`docs/design/` (the rest) are **not the same design language**, and the code
follows the second one.

| Dimension       | `docs/design/stitch/**/code.html` (the "authoritative" input)              | `docs/design/{calendar,dashboard,chores,reward-store,homepage}` + brand skill | Implemented (`src/app/globals.css`)             |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Primary         | Indigo `#0040e0` / container `#2e5bff`                                     | Green `#13ec92`                                                               | Green `#13ec92` (`globals.css:24`)              |
| Secondary/accent| Amber `#fea619` / `#855300`                                                | Gold `#d4a84b`                                                                | Gold `#d4a84b` (`globals.css:32`)               |
| Background      | `#f8f9fa`                                                                  | `#f6f8f7` / `#10221a`                                                         | `#f6f8f7` / `#10221a` (`globals.css:39`, `:167`)|
| Surface ramp    | Material-3 tonal: `surface-container-lowest…highest` (5 steps)             | flat `surface` / `surface-elevated` / `surface-hover`                         | flat, 3 steps (`globals.css:40-42`)             |
| Display font    | **Hanken Grotesk** (600/700/800)                                           | **Lexend**                                                                    | **Lexend** (`fonts.ts:24`)                      |
| Body font       | **Inter**                                                                  | **Noto Sans**                                                                 | **Noto Sans** (`fonts.ts:45`)                   |
| Type tokens     | `display-hub` 72px, `headline-lg` 32px, `body-md` 16px, `label-caps` 12px  | `text-display-*` / `text-h1..3` / `text-body*`                                | `text-h1…text-overline` (`globals.css:277-326`) |
| Radius          | `DEFAULT` 4px, `lg` 8px, `xl` 12px; cards use `rounded-2xl`/`rounded-3xl`  | `lg` 8px, `xl` 12px, `2xl` 16px                                               | `--radius: 0.75rem`, `2xl`≈21.6px, `3xl`≈26.4px |
| Nav paradigm    | 80–88px left icon rail (tablet/desktop) + bottom tab bar (mobile) + FAB    | top bar + slide-out Sheet drawer (`docs/design/ui/menu/spec.md`)              | flat text-link header + bottom tab bar          |

Evidence: the Tailwind config embedded in every stitch mockup, e.g.
`docs/design/stitch/.../calendar_today_light_mode/code.html:1`
(`"primary":"#0040e0"`, `"fontFamily":{"headline-lg":["Hanken Grotesk"],"body-md":["Inter"]}`),
versus `docs/design/dashboard/dashboard-code-1.html` which loads
`family=Lexend&family=Noto+Sans` and uses `#13ec92`.

Two of the three stitch `DESIGN.md` sidecars also disagree with each other:
`stitch/.../kynite/DESIGN.md:19` says `primary: '#0040e0'`, while
`stitch/.../vibrant_kynite/DESIGN.md` says `primary: '#402ae7'` (violet).

**This must be decided before any pixel work.** The gap tables below are written
against *structure and composition*, which is wrong regardless of which palette
wins — so they stay actionable either way.

| Mockup element                            | Implemented state                                            | Gap |
| ----------------------------------------- | ------------------------------------------------------------ | --- |
| Indigo `#0040e0` primary                  | Green `#13ec92` (`globals.css:24`, `:117`)                   | S1  |
| Amber `#fea619` reward/streak accent      | Gold `#d4a84b` (`globals.css:32`)                            | S1  |
| Hanken Grotesk display                    | Lexend (`fonts.ts:24`)                                       | S1  |
| Inter body                                | Noto Sans (`fonts.ts:45`)                                    | S1  |
| M3 5-step `surface-container-*` tonal ramp| 3-step flat surfaces (`globals.css:40-42`)                    | S1  |
| `display-hub` 72px glanceable clock token | No 72px token; largest is `--text-display-xl` 5rem/80px, unused for a clock | S2 |

---
## 2. S1 — Navigation paradigm (affects every app screen)

Mockups: `stitch/.../calendar_today_light_mode/code.html:2`,
`today_s_flow_light_mode/code.html:3`, `mila_s_star_chart_light_mode/code.html`,
`reward_store_light_mode/code.html`, `home_light_mode/code.html:*`.

| Mockup element                                                                                                                             | Implemented state                                                                                                                                   | Gap |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Persistent **left icon rail**, 80–88px, full height, tonal surface, logo tile at top, settings pinned to bottom (`w-20 … fixed left-0 top-0 h-full`) | Does not exist. Desktop nav is a flat row of ten **text** links in a non-sticky top bar: `src/app/[locale]/(app)/layout.tsx:80`, links at `:90-…` (`"px-2 py-1 font-display text-sm font-medium"`) | S1  |
| Rail items = 28px Material Symbol **+ caps micro-label** (`HUB`, `DATE`, `CHORES`, `TIME`, `GIFT`), active state a filled `primary-container` tile with `rounded-2xl` | No icons at all in the desktop header                                                                                                              | S1  |
| **Glassmorphic fixed top header**, `h-20`, `bg-surface/80 backdrop-blur-xl`                                                                  | `border-b border-border`, no blur, not sticky (`layout.tsx:80`)                                                                                       | S2  |
| Header shows **weekday + date and a live clock** (`Monday, Oct 28` / `8:42 AM`)                                                             | Absent from the shell. The greeting date lives inside `/today` (`today/page.tsx:55-58`); the clock only exists on hub (`hub-board.tsx:87`)            | S2  |
| Header **segmented DAY / WEEK / MONTH pill** (`rounded-full` track, elevated active thumb)                                                   | A `Tabs`/`TabsList` inside the calendar page, 4 options incl. `agenda` (`src/modules/calendar/ui/calendar-shell.tsx:173-181`) — right idiom, wrong location and item set | S2  |
| Header **streak chip** (`bolt` icon + `42 STREAK`, amber tint)                                                                              | Streaks were deliberately rejected — see the comment at `src/modules/rewards/ui/savings-goal-card.tsx:14`. Nothing in the header.                     | S2 (product decision — confirm before building) |
| Header **avatar** with ring                                                                                                                 | `SignOutButton` only (`layout.tsx:…`)                                                                                                                | S2  |
| **FAB**, 64px, `rounded-2xl`, bottom-right, icon rotates 90° on hover (`calendar_today_light_mode/code.html:201`)                            | No FAB anywhere. Only an inline create `Button` in the calendar header.                                                                               | S2  |
| Mobile **bottom tab bar**: 5 tabs `HOME / CALENDAR / ROUTINES / REWARDS / SETTINGS`, glass (`bg-surface/90 backdrop-blur-xl pb-safe`), active tab `text-primary font-bold` (`home_light_mode/code.html`) | Exists and is close: `src/components/app-nav/mobile-nav.tsx:93`. But 4 tabs + a "More" sheet (`:82-87`), opaque `bg-background` with `border-t`, no `backdrop-blur`, no `pb-safe` | S3  |
| Mobile bottom-bar icons are Material Symbols                                                                                                 | **lucide-react** components: `mobile-nav.tsx:4-16`, rendered `className="size-5"` at `:114`                                                           | S2  |
| Rail visible on tablet/desktop **and** the hub                                                                                              | Hub has no nav at all — deliberate (`src/components/hub/kiosk-shell.tsx:20-32`)                                                                       | OK (documented deviation) |

---

## 3. S2 — "Today's Flow" / hub board

Mockup: `stitch/.../today_s_flow_light_mode/code.html`,
`today_s_flow_light_mode_landscape_hub/screen.png`.

| Mockup element                                                                                                                | Implemented state                                                                                                                          | Gap |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Page header: greeting left, **72px `display-hub` clock** right (`code.html:12-14`)                                              | `/today` has greeting only (`today/page.tsx:55`, `:58`), no clock. Hub has a clock at `src/modules/calendar/ui/hub-board.tsx:87` but at `text-display-md` → **56px** on hub (`globals.css:553`), not 72px | S2  |
| Presence dot + `Online • Monday, Oct 14` (`code.html:8-9`)                                                                       | Not present                                                                                                                                    | S3  |
| **12-column grid, 8/4 split** (`grid grid-cols-12 gap-6`, `col-span-8` flow + `col-span-4` sidebar) (`code.html:16-18`, `:108`)  | Single column: greeting + `PersonColumns` (`today/page.tsx:52-70`)                                                                              | S2  |
| **Filled-primary "NOW" hero card**, `rounded-3xl p-8`, min-h 320px, radial glow, `NOW` pill eyebrow, `headline-lg` title (`code.html:20-26`) | No NOW card on `/today` or hub. The only filled hero in the product is `src/modules/rewards/ui/savings-goal-card.tsx:41` (`rounded-3xl bg-primary p-8 …`) — correct idiom, wrong screen | S2  |
| **Circular SVG progress ring** with remaining minutes in the centre (`code.html:38-46`)                                          | No SVG ring anywhere in `src/**/*.tsx` (only `src/modules/sharing/ui/share-qr.tsx`). Timers use a linear bar: `src/modules/timers/ui/timer-tile.tsx:132-137` | S2  |
| 64px circular white "advance" button on the hero (`code.html:52-54`)                                                            | Not present                                                                                                                                    | S2  |
| **"UP NEXT" 2-column card grid** (`grid grid-cols-2 gap-4`, `rounded-2xl p-6 min-h-[160px]`, time in accent colour, avatar stack, one dashed "Free time!" empty slot) (`code.html:58-104`) | Not present — no `upNext` concept in the codebase                                                                                               | S2  |
| **Right "Kids' Progress" sidebar** (`rounded-3xl` panel; per-child card with 64px avatar, streak row, star pill, `LEVEL n` + `x% TO LEVEL n+1` label, shimmering gold progress bar) (`code.html:108-171`) | Not present. `PersonColumns` (`src/modules/calendar/ui/person-columns.tsx:105-124`) is an events-per-member grid with a colour dot (`:147`) — no stars, no levels, no streaks, no progress bars | S2  |
| "Family Goal — 20 stars to movie night!" footer card (`code.html:166-170`)                                                       | Exists but on a different surface: `savings-goal-card.tsx`                                                                                      | S3  |
| Ambient "now/next" tiles on hub                                                                                                 | `src/modules/timers/ui/ambient-timers.tsx:37` is a plain `grid gap-3 sm:grid-cols-2` of 2 compact tiles — nowhere near the hero treatment       | S2  |

---

## 4. S2 — Calendar

Mockup: `stitch/.../calendar_today_light_mode/code.html`, `…_landscape_hub/code.html`.

| Mockup element                                                                                                                | Implemented state                                                                                                                    | Gap |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **Member filter chip rail** above the grid: `Everyone` pill (filled primary) + one avatar-pill per member with a gradient ring, horizontally scrolling, sticky glass container (`code.html:4-35`) | Not present in `CalendarShell` (`src/modules/calendar/ui/calendar-shell.tsx:136-193`). Member chips exist only on the hub store (`src/modules/rewards/ui/reward-store.tsx:93`) | S2  |
| **Day view = one column per family member**, sharing a single left time axis, with sticky per-member column headers (`code.html:58`, `:80-82`) | `TimeGrid` renders one column **per day** — day view is a single column (`src/modules/calendar/ui/time-grid.tsx:14-20`, `:223-233`). Per-member columns exist only in `PersonColumns`, which `/calendar` never uses | S2  |
| **Cross-column shared-event band** (Family Dinner spanning all member columns, gradient fill, avatar stack) (`code.html:178-197`) | Shared events are a separate stacked strip above the grid (`person-columns.tsx:85`), and not in the calendar at all                     | S2  |
| Time axis 64px wide, **96px per hour** (`h-24`), labels `07:00`–`21:00` (`code.html:40-56`)                                       | 56px gutter (`time-grid.tsx:199` `"w-14 shrink-0"`), **56px per hour**, 06:00–23:00 (`src/modules/calendar/ui/tokens.ts:75-82`)          | S3  |
| Event card: tinted bg + `border-l-4` + `rounded-xl` + `shadow-sm hover:shadow-md`, title in `headline-md`, `tabular-num` time, optional `location_on` row, oversized watermark category icon | **Match on the core treatment**: `src/modules/calendar/ui/event-chip.tsx:109` `"… rounded-lg border-l-4 px-2 py-1 …"` + `bg-cat-*-surface`/`border-cat-*-border` from `src/modules/calendar/ui/tokens.ts:10-62`. Missing: shadow, hover-lift, location row, watermark icon; radius is `lg` not `xl` | S3  |
| Busy/opaque "School" block styled as a neutral low-emphasis card                                                                 | Present: `event-chip.tsx:124` `"border-dashed border-line bg-surface/60"`                                                              | OK  |
| Dashed empty-state block inside a column ("FOCUS TIME") (`code.html:118-121`)                                                    | Not present in the calendar; `/today` has a `wb_sunny` free-day state (`person-columns.tsx:153`)                                       | S3  |
| Current-time line: 1px `bg-error` with a leading dot                                                                            | `time-grid.tsx:267` `"… absolute inset-x-0 z-20 border-t-2 border-now"` — 2px, no dot                                                  | S3  |
| Inline round check-off button on routine events (`code.html:143-146`)                                                            | Not present in the calendar                                                                                                            | S3  |

---

## 5. S2/S3 — Routines

Mockup: `stitch/.../chores_routines_light_mode_landscape_hub/code.html` + `screen.png`.

| Mockup element                                                                                                              | Implemented state                                                                                                                     | Gap |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Day split into **Morning / Afternoon / Evening** sections, each with an icon and a **full-width horizontal progress rule** next to the heading | Sections + progress bar exist: `src/modules/routines/ui/routine-board.tsx:222`, bar `:241-247` (`h-1 w-24 … sm:w-48`, `bg-primary`). Mockup bar is full-bleed and amber; impl is a short `bg-primary` stub | S3  |
| **Secondary vertical rail** inside the content area (`Chores / Events / Meals`, `w-24 … rounded-xl bg-surface-container-lowest`) | Not present                                                                                                                              | S2  |
| Top segmented member filter (`Everyone / Mila / Daan`, filled-primary active pill)                                            | Not present on `/routines`                                                                                                               | S2  |
| Header: title + inline clock (`Routines  07:45 AM`)                                                                          | Title only (`routines/page.tsx:26`); hub variant has a clock (`hub/routines/[memberId]/page.tsx:49-64`)                                   | S3  |
| Routine card: avatar, `Mila • 4 Steps` subtitle, `IN PROGRESS` pill top-right, faint glow behind the active card              | Card `src/modules/routines/ui/routine-card.tsx:52-58`, title `:69`, in-progress pill `:103` (`label-overline … rounded-4xl bg-accent`). No avatar, no glow | S3  |
| Step row: full-width, generous height, circular checkbox left, **completed rows struck through**, active row has a `border-l` accent + trailing arrow | `src/modules/routines/ui/step-row.tsx:83` `h-14 w-full … rounded-lg`, indicator `:93-94` (`size-8 rounded-full`, `bg-primary` when done), strike-through `:103`. Missing: active-row left accent bar and trailing arrow | S3  |
| Completed row shows inline praise ("Great job!")                                                                             | Present: `step-row.tsx:114` (`font-display text-h3 font-bold text-brand-ink`)                                                             | OK  |
| Parent-side routines list                                                                                                     | Generic shadcn: `src/modules/routines/ui/routine-list.tsx:52-53` `<Card>/<CardContent>` + `<Badge>`; steps `<ol>` at `:90-104`             | S3  |

---

## 6. S2/S3 — Rewards: star chart & reward store

Mockups: `stitch/.../mila_s_star_chart_light_mode/code.html`, `reward_store_light_mode/code.html`.

| Mockup element                                                                                                                      | Implemented state                                                                                                                        | Gap |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **Weekly star grid**: rows = tasks (icon medallion + name), columns = Mon–Sun with the current day as a filled circle, cells = outlined/filled star glyphs | Not built. `src/modules/rewards/ui/star-chart.tsx:86-114` is a **7-bar column chart** (`h-32 … rounded-lg bg-muted` track at `:98`, `bg-gold` bars at `:104`) | S2  |
| Big `Mila's Star Chart` page title + subtitle                                                                                          | `rewards/page.tsx:46` `font-display text-h1 font-bold`; hub variant `hub/stars/[memberId]/page.tsx:44-49`                                    | OK  |
| **`5-DAY STREAK` amber pill** in the card header                                                                                       | Streaks deliberately not implemented (`savings-goal-card.tsx:14`)                                                                             | S2 (product decision) |
| **"Next Reward" card**: warm gradient, circular icon medallion, `23 / 30` counter, progress bar, "Just 7 more stars to go!"             | `savings-goal-card.tsx:41` — filled `bg-primary`, `rounded-3xl`, `label-overline` eyebrow `:56`, `text-display-md` title `:57`, gold bar `:78`. Structure matches; the mockup's warm gradient + medallion do not | S3  |
| **Encouragement card** (`Goed bezig, Mila!`, filled primary, smiley medallion)                                                          | Not present as a card                                                                                                                        | S3  |
| Reward store: `CURRENT GOAL` filled hero banner with medallion + `23 / 30` + progress bar                                              | `src/modules/rewards/ui/reward-store.tsx:132-142` is a **star-balance pill** (`rounded-4xl bg-gold/20 px-8 py-4`), not a full-width hero banner | S3  |
| Store grid **4-up** of white cards: circular colour-coded icon medallion, name, star-price pill; locked cards greyed with "27 more stars to go!"; pending cards blurred with "Asked! Waiting for Mom or Dad" | `reward-store.tsx:170` `"grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"`; card `src/modules/rewards/ui/reward-card.tsx:92` `rounded-3xl p-6`, medallion `:58-62`, price pill `:80-85` (`bg-gold/25 text-gold-ink` / `bg-muted text-ink-secondary`). **Close match.** | OK / S3 |
| Member switcher chips at top of store                                                                                                  | Present: `reward-store.tsx:93` (`h-14 … rounded-4xl px-6 font-display text-body-lg`)                                                          | OK  |
| Parent reward catalogue as a card grid                                                                                                 | It is a **list** of generic shadcn cards: `src/modules/rewards/ui/reward-list.tsx:65-80`                                                       | S3  |

---

## 7. S3 — Timers

No dedicated stitch mockup; judged against the design-system spec
(`stitch/.../kynite_design_system_spec.txt`) and the brand guideline.

| Expected                                                | Implemented state                                                                                                                                   | Gap |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| Tabular countdown, glanceable at 2m                     | `src/modules/timers/ui/tokens.ts:27` `COUNTDOWN_DIGIT_CLASS = 'tabular-time font-extrabold text-display-xl leading-none'` → 5rem/80px                     | OK  |
| Circular progress (mockup idiom for time remaining)      | Linear bar: `src/modules/timers/ui/timer-tile.tsx:132-137`                                                                                              | S3  |
| Controls use the shared `Button` (48px hub target)       | Hand-rolled buttons bypassing `<Button>`: `timer-tile.tsx:166-168`, `:189-191`, sized by `tokens.ts:34 TIMER_TAP_TARGET_CLASS`                            | S3  |
| Card radius `2xl` per mockups                            | `timer-tile.tsx:98` `rounded-xl` (12px)                                                                                                                | S3  |

---

## 8. S2 — Marketing, auth, share

These three are the only places where the "shadcn defaults, brand never applied"
diagnosis is actually true.

| Surface                                          | Mockup                                                                | Implemented state                                                                                                                                                                | Gap |
| ------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Marketing homepage                               | `docs/design/homepage/homepage-code-1.html` — 4 sections incl. a pricing table (Free / Basic / Pro), Lexend, `#13ec92` | **Unstyled scaffold**: `src/app/[locale]/(marketing)/page.tsx:33` `"flex min-h-dvh flex-col items-center justify-center gap-2 p-8"`, `:34` `"text-3xl font-semibold"`, `:35` `"text-sm opacity-70"`. Zero brand tokens, no hero, no nav, no footer, no pricing | S2  |
| Auth (sign-in / sign-up / invite)                | No stitch mockup; brand guideline card + primary button spec           | Stock shadcn: `src/modules/family/ui/sign-in-form.tsx:25` `<Card className="w-full max-w-md">`, `:28` `"text-xl"`, `:60` `"text-sm text-destructive"`, `:69` `"text-center text-sm text-muted-foreground"`. Generic type scale throughout; only `text-brand-ink` at `:71`. Same in `sign-up-form.tsx`, `invite-steps.tsx`, `invite-gone.tsx` | S2  |
| Share page (`/s/[token]`)                        | No stitch mockup                                                       | Mixed conventions: `src/modules/sharing/view/share-board.tsx:31` `font-display text-2xl font-bold` (generic size next to a brand family), `:41`/`:57` `font-display text-h3`, `:34`/`:85`/`:148`/`:158` `text-sm text-muted-foreground`, `:158` `tabular-nums` instead of the `tabular-time` utility. Hand-rolled cards `:81`, `:109`, `:156` | S3  |
| Hub pair screen                                  | —                                                                     | Not audited in depth                                                                                                                                                              | —   |

---

## 9. S3 — Component & interaction polish (cross-cutting)

| Guideline / mockup                                                                | Implemented state                                                                                                                       | Gap |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| `transition: all 200ms ease` on interactive elements                                | Correct in `Button` (`src/components/ui/button.tsx:7` `transition-all duration-200 ease-brand`) and hand-rolled surfaces, but not universal | S3  |
| `active:scale-95` on buttons                                                        | Present in `button.tsx:7`, but only 3 literal occurrences of `active:scale-95` in `src/**/*.tsx` — hand-rolled buttons (timers, step rows) use `active:scale-[0.99]` or nothing | S3  |
| Cards: `1px solid` border + `shadow-sm`, radius `xl`/`2xl` (guideline lines 338-350) | `src/components/ui/card.tsx:15` uses `ring-1 ring-foreground/10` **and no shadow**, radius `xl`. Mockup cards are `rounded-2xl`/`rounded-3xl` with `shadow-sm` | S3  |
| `CardTitle` should use the brand type scale                                         | `card.tsx:41` `"font-heading text-base leading-snug font-medium"` — generic `text-base`, weight 500 vs the mockups' 600–700               | S3  |
| Glass surfaces (`backdrop-blur-xl`) on sticky headers and the bottom bar             | The only `backdrop-blur` in `src/` is dialog/sheet overlays + `src/app/dev/design/design-showcase.tsx:131`                                 | S3  |
| Avatars: 2px ring in a member/category colour                                       | `PersonColumns` uses a separate `size-3 rounded-full` dot (`person-columns.tsx:147`) rather than ringing the avatar                        | S3  |
| Icon set coverage                                                                   | The subset ships **41 codepoints** (`src/components/ui/icon-codepoints.ts:11-52`). Mockups use `grid_view`, `space_dashboard`, `query_stats`, `group`, `home`, `celebration`, `self_improvement`, `sports_soccer`, `arrow_forward`, `check_circle`, `person`, `bolt`, `more_horiz` — none present | S3 (blocks §2) |
| Radius scale                                                                        | `--radius: 0.75rem` with multipliers (`globals.css:441-447`) gives `2xl`≈21.6px, `3xl`≈26.4px, `4xl`≈31.2px — non-standard vs. the guideline's 16px `2xl` and the mockups' 16/24px | S3  |

---

## 10. Root causes and effort

| # | Root cause                                                                                                                                                                                          | Evidence                                                                                        | Screens affected | Effort |
| - | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 1 | **Two incompatible design systems, and the code implements the non-stitch one.** Stitch = Indigo `#0040e0` + Amber `#fea619` + Hanken Grotesk/Inter + M3 tonal ramp. Code + brand skill = Green `#13ec92` + Gold + Lexend/Noto Sans. Nothing can "look like the mockups" until one wins. | `stitch/.../calendar_today_light_mode/code.html:1` vs `globals.css:24,32` and `fonts.ts:24,45`   | all              | **S** to decide; **L** to re-skin to stitch, **S** to keep green (retire/annotate `docs/design/stitch/`) |
| 2 | **Layout was never taken from the mockups.** Tokens were implemented; compositions were not. No icon rail, no glass header with clock, no FAB, no NOW hero, no ring progress, no Up Next grid, no Kids' Progress sidebar, no member-column day view, no member filter rail. | §2, §3, §4                                                                                       | shell, today, hub, calendar, routines | **L** |
| 3 | **Two icon libraries, split by accident.** `Icon`/Material Symbols is the house system (`icon.tsx:81`), but the mobile bottom bar — the most-seen nav on phones — uses lucide (`mobile-nav.tsx:4-16`). Separately, the 41-glyph subset lacks most mockup icons. | `mobile-nav.tsx:4-16`, `icon-codepoints.ts:11-52`                                                | mobile nav, any new mockup work | **S** (swap nav icons + extend subset via `scripts/subset-icons.mjs`) |
| 4 | **Marketing / auth / share never got the design system.** These are literal M01 scaffolds on stock shadcn with generic `text-xl`/`text-sm`/`text-3xl`. They are also the first screens a new user sees. | `(marketing)/page.tsx:33-35`, `sign-in-form.tsx:25-69`, `share-board.tsx:31-158`                | 3 surfaces + invite | **M** |
| 5 | **Hierarchy is flat: no filled hero cards, no elevation, no glass.** The mockups lean on a big filled-primary "now/goal" card per screen plus shadow and blur; the app has exactly one (`savings-goal-card.tsx:41`) and `Card` has no shadow at all (`card.tsx:15`). | §3, §9                                                                                           | today, hub, rewards, calendar | **M** |
| 6 | **Radius/spacing scale drifted.** Custom multiplier scale yields 21.6/26.4/31.2px where the guideline says 16px and the mockups use 16/24px; `Card` sits at `xl` where mockups use `2xl`/`3xl`. | `globals.css:441-447`, `card.tsx:15`                                                             | all              | **S** |
| 7 | **Two features the mockups assume were deliberately cut**: streaks (`savings-goal-card.tsx:14`) and levels/XP. Header streak chips, `5-DAY STREAK` pills and `LEVEL n` bars all depend on them. | `savings-goal-card.tsx:14`                                                                       | today, hub, rewards | **M** (if reinstated) — needs a product decision first |

### Severity counts

| Severity | Count |
| -------- | ----- |
| S1       | 8     |
| S2       | 24    |
| S3       | 31    |

### Suggested order

1. **Decide root cause #1.** Everything else is cheaper once the palette/type question is settled. If green wins, mark `docs/design/stitch/` as superseded so the next reader does not repeat this audit.
2. Root cause #3 (icons) — small, unblocks all mockup-faithful work.
3. Root cause #2, shell first (rail + glass header + clock + FAB), then `/today`, then calendar day view.
4. Root cause #4 (marketing/auth/share) — cheap, high first-impression value.
5. Root causes #5, #6 as a single pass over `card.tsx` and the radius scale.
6. Root cause #7 last, and only after a product call.
