# Design drift — Ledenkleuren, Vandaag, hub = app

Owner ask (2026-09-15): the Claude Design mockups are ahead of the code. Biggest miss: the member-colour rules in `Ledenkleuren.dc.html` barely show in the rendered app. Separately: the hub should be the same surface as the web app, only with lowered permissions, and every step/task row must be tappable as a whole. Orchestrator mode; code units go to Antigravity (`agy-delegate --tier flash`), reviews stay on the Claude side.

Design syncs: `7caade9` (first Vandaag/routines pull), `c87f15d` (owner's member-colour alignment pass, 8 mockups; Ledenkleuren/DESIGN.md unchanged).

## Findings

Scouts s1–s4 (before the alignment pass):

- Token layer already matches Ledenkleuren 1:1: `--member-<slot>-{wassing,baan,lijn,inkt}` in `packages/ui/src/styles/tokens.css:341-369`, six hues (335/245/196/312/90/30), `MEMBER_COLOR_CLASSES` in `modules/family/ui/tokens.ts:38` (+ duplicate `modules/calendar/ui/tokens.ts:175`).
- Carriers missing or overruled on the rendered surfaces: Vandaag timeline line = category colour, kid cards face-wassing only; routines board icon tiles neutral, done step green block, NU indigo block, 100% column fully orange (`routines-board.tsx:335-381`, `step-row.tsx:135-273`, `routine-card.tsx:162,271`); Kalender event line = category colour, no column-head line, oversized face row with indigo ring.
- Vandaag diff: tabs gone, avatar filter moves beside the clock (app: `today-timeline-filter.tsx:63` in the card header; `today-header.tsx:229` static `FaceStack`), "voorbij" toggle in the card header (`today-past-rows.tsx` has the collapse), FAB exists (`today-fab.tsx:80`), radii 16/8, dead-ish `today-tabs.tsx` / `today-tab-personen.tsx` / `today-tab-sterren.tsx`.
- Hub/app split: route groups `(hub)`, `(hub-clock)`, `(app)`; `requireHubDevice()` (`modules/devices/hub-gate.ts:27`); principal union member|device|share, 20-capability matrix (`modules/family/authorize.ts:82`), device denied on all `*:write`/`*:manage`. Settings are one DB store; hub-only prefs are per-device localStorage (`kynite.hub.theme`, `kynite.today.tab`, `kynite.today.day-view`). `CLAUDE.md`'s `components/calendar/contexts/calendar-context.tsx` reference is stale.
- Whole-row tap: mockups bind toggle on the row (`s.toggle`/`t.toggle`); code binds on the 46px circle only.

Scout s5 (diff of `c87f15d`):

- Canon values now shared by Vandaag, Kalender, Beloningen, Design System, Vandaag met thema's: wassing `oklch(95% 0.025 H)`, baan `oklch(90% 0.05 H)` (progress track), lijn `oklch(58% 0.14 H)` (4px row/card line, 3px column-head line, ring), inkt `oklch(38% 0.09 H)`. Done check green `oklch(58% 0.14 155)`. NU indigo `#5d5fef`. Selection ring indigo 2px. Orange untouched (reward only).
- Vandaag: shared two-child rows use a `linear-gradient(180deg, A 50%, B 50%)` split on the one 4px line; no-owner rows go neutral grey `#b6b3ab`; own-user avatar gets a 3px lijn ring; progress track is member baan.
- Kalender: agenda rows `border-left:3px solid lijn`, column heads `border-bottom:3px solid lijn`, face-row rings 3px/2px, FAB indigo, radii 16/12 → 8 on tiles/rail.
- Rings: mockups use 3px on 32–36px avatars (Ledenkleuren says 2px@24, 3px@36–48) — house rounding, follow the mockups.
- **Not aligned**: `Actieve routines.dc.html` and `Taken en routines.dc.html` only got hue constants + header avatar. Their templates still fill the done circle/dot in member lijn, tint the NU badge by member hue, stack a member-tinted card border on the NU card, and use off-canon steps (`94% 0.03`, `95% 0.03`, `97% 0.015`, `45% 0.1`).

## Decisions

- D1 (owner, 2026-09-15): design side resolves the rule conflict first. Done: `c87f15d`.
- D2 (owner): **A** — one route tree; `(hub)` goes, member and device render the same pages, the principal decides the controls. Explore a dedicated "management" page gathering everything device-denied. Own plan, own cap, after M1–M2.
- D3 (owner, 2026-09-15): cap approved as proposed below.
- D4 (owner, 2026-09-15): **follow the designs.** Every screen follows its own mockup verbatim, including `Actieve routines` / `Taken en routines` as they stand: done circle/dot filled in the member's lijn, NU badge tinted by the member hue (`93% 0.05 H` / `38% 0.1 H`), NU card border `86% 0.06 H`, tile steps `95% 0.03 H` / `97% 0.015 H`, icon inkt `45% 0.1 H`. Ledenkleuren is the rulebook only where a screen's mockup is silent. Vandaag's Takenlijst keeps its green check because that mockup says so.
- D5 (owner, 2026-09-15): agy runs on `--tier flash` only; Claude side reviews.
- Layout values from the mockups win over current code (radii 16/8, ring 3px at 32–36px, 64px rows, 46px circle).

## Milestones

Branch `feat/design-drift-m1`. Each unit = one `agy-delegate --tier flash --yolo --dir /var/www/personal/kynite --timeout 20m` run with `AGENTS.md` (repo root, executor rules) + this file as the brief; reviewer = Claude subagent (sonnet) on the diff; gates rerun by main thread.

- [ ] **U1 — package primitives** (`packages/ui`). Tokens first: add `--member-<slot>-hue` (335/245/196/312/90/30) to `tokens.css` light + dark and derive the extra steps the routines mockups use from it — `tegel` `oklch(95% 0.03 h)`, `tegel-zacht` `oklch(97% 0.015 h)`, `tegel-klaar` `oklch(95% 0.03 h)`, `rij-klaar` `oklch(97% 0.02 h)`, `inkt-tegel` `oklch(45% 0.1 h)`, `inkt-klaar` `oklch(62% 0.06 h)`, `nu-baan` `oklch(93% 0.05 h)`, `nu-inkt` `oklch(38% 0.1 h)`, `nu-lijn` `oklch(86% 0.06 h)`; dark theme re-tuned the way the existing four steps are. Extend `MEMBER_COLOR_CLASSES` (`apps/web/src/modules/family/ui/tokens.ts`, and the deliberate duplicate in `modules/calendar/ui/tokens.ts`) with class names for them. `StepRow` (both variants): the whole row is one `<button>` (min 64px, padding 9px 12px, radius 8, gap 12), circle 46px decorative `aria-hidden` (white + 3px `#dcdad4` border; done: member lijn fill, white 30px filled check with `kyn-pop`), icon tile 38px radius 8 in `tegel-zacht` (done `tegel-klaar`), icon 22px `inkt-tegel` (done `inkt-klaar`), title 18px/600 (done `#8a8c98` strikethrough), done row background `rij-klaar`; member colour arrives as a `memberClasses` prop of class strings (structural, no import from the app). `RoutineCard`: radius 16, padding 16, tile 52px `tegel` + icon 28px, NU badge `nu-baan`/`nu-inkt`, NU card border `nu-lijn`, KLAAR pill `#eceae4`/`#5f6274`, done tile icon `inkt-klaar`; drop every orange/green state variant that no mockup shows. `ProgressBar`: `trackClassName` (member baan) + `fillClassName` (member lijn), remove the orange 100% variant. Stories updated for each variant; vitest for the row-is-the-button semantics (no nested interactive, `aria-pressed`/`aria-checked` preserved).
- [ ] **U2 — routines surfaces** (`apps/web/src/modules/today/ui/routines-board.tsx`, `modules/routines/ui/*`, `(hub)/routines/[memberId]`): pass member classes into U1 components; column head 3px member lijn bottom line (exists on taken, verify) + 40px ring 3px; routine progress card wassing + lijn bar; remove orange gradient/ring/head on 100% (keep the small "Alles gedaan · +N sterren" chip); task rows whole-row tap; solo page same. `MemberFilter` selection ring indigo 2px, unselected opacity 0.45.
- [ ] **U3 — Vandaag hub** (`modules/today/ui/*`): timeline row 4px line = owner member lijn (two owners: 180° split gradient, no owner: `#b6b3ab`), category colour moves to the icon tile only, rail dots 10px member lijn, NU row `rgba(93,95,239,0.07)` indigo; kid cards: face ring 3px + member baan progress track; avatar filter moves from the card header to beside the clock (36px faces, `Iedereen` pill), "voorbij" toggle takes its place in the card header; FAB 64px indigo with 4 pills; radii 16/8 via tokens; delete `today-tabs.tsx`, `today-tab-personen.tsx`, `today-tab-sterren.tsx` if unreferenced (verify `(app)/today` first).
- [ ] **U4 — Kalender + Beloningen hub** (`modules/calendar/ui/*`, `modules/rewards|store ui`): agenda/event rows `border-left:3px` member lijn (category on the tile), column heads `border-bottom:3px` member lijn, face-row rings 3px, remove the oversized indigo-ringed face row, filter selection ring indigo; store/rewards avatar chips wassing `95% 0.025` + 3px ring, selected chip indigo border. Radii 8 on tiles/rail where the mockup changed them.
- [ ] **R1 — review + gates + baselines** (main thread + reviewer agents): per-unit sonnet review, fix loops back to agy (flash, `--continue` only after quota/timeout), `pnpm typecheck`, scoped oxlint, vitest, then Playwright `@visual` hub project `--workers=1` with the `.env.local` move/restore rule; regenerate hub baselines; kiosk audit (48px floors) green; axe on routines/taken/hub. Merge, `railway up`.
- [ ] **M3 — hub = app (D2-A)**: separate plan `docs/plans/<date>-hub-equals-app.md`, own cap; includes the "management" page idea and the `CLAUDE.md` stale reference.

### Cap (D3, approved 2026-09-15)

M1 (U1–U4 + R1): 6 agy runs (4 units + 2 retries), 4 Claude review agents (sonnet), plus the 1 scout already spent. Escalate a unit to a Claude builder only when flash fails twice on it. Fix loops after review also go to agy (counted in the 2 retries; above that, ask).

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | Ledenkleuren rules vs app | sonnet | 61k | 6 | done |
| s2 | hub/app map | sonnet | 55k | 19 | done |
| s3 | Vandaag diff vs app | sonnet | 105k | 15 | done |
| s4 | hub/app settings overlap | sonnet | 38k | 15 | done |
| s5 | design diff `c87f15d` digest | sonnet | 119k | 48 | done |
| agy-0 | smoke (workspace packages) | gemini flash-lo | 84k in / 0.3k out | — | ok |
| agy-u1 | U1 primitives | gemini 3.8 flash-high | 1.69M in / 44k out / 3.76M cache | 148 steps | failed: 503 capacity all run, print timeout 25m, nothing written (retry 1 spent) |
| agy-u1b | U1 primitives, retry | gemini 3.8 flash-high | 721k in / 18k out / 1.28M cache | — | failed: `Individual quota reached ... Resets in 166h52m` (429), nothing written |
| b1 | U1 primitives | sonnet (builder) | | | running |

Blocker (2026-09-15 10:45): the agy account's weekly quota is exhausted on every Gemini model (3.8/3.7/3.6 flash, 3.1 pro all 429, reset ≈2026-09-22). Two U1 runs burned ~2.4M input + ~5M cache_read on reading and 503 retries without a single file write. Options: (a) wait for the reset, (b) run U1–U4 on Claude subagents (sonnet builders) under the same cap, (c) upgrade the Antigravity plan. Owner (2026-09-15): **(b)**, and keep the token volume down — one sonnet builder per unit, explicit read lists, no mockup reads, ≤120k tokens / ≤50 tool calls per agent, digest-only replies; reviews via cavecrew-reviewer.
