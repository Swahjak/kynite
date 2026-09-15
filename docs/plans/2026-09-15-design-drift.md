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
- D3 (owner): cap set after D1. Proposed below.
- D4 (orchestrator, 2026-09-15, pending owner veto): where `Actieve routines` / `Taken en routines` still contradict Ledenkleuren + the six aligned mockups, the code follows **Ledenkleuren**: done disc/dot green 155 with white check, NU badge/block indigo, one carrier per element, canon wassing/inkt steps via the existing tokens. Member colour on a step/task row = icon tile wassing + inkt (the row's one carrier); the done circle is state, not identity.
- D5 (owner, 2026-09-15): agy runs on `--tier flash` only; Claude side reviews.
- Layout values from the mockups win over current code (radii 16/8, ring 3px at 32–36px, 64px rows, 46px circle).

## Milestones

Branch `feat/design-drift-m1`. Each unit = one `agy-delegate --tier flash --yolo --dir /var/www/personal/kynite --timeout 20m` run with `AGENTS.md` (repo root, executor rules) + this file as the brief; reviewer = Claude subagent (sonnet) on the diff; gates rerun by main thread.

- [ ] **U1 — package primitives** (`packages/ui`): `StepRow` (tile + list variants) and the task row shape become one 64px `<button>` covering the whole row, circle decorative (`aria-hidden`), no nested interactive; `StepRow`/`RoutineCard` take `memberClasses` (wassing/inkt/lijn class strings) and apply them to the icon tile only; done circle green 155 + white check (`kyn-pop`), NU badge indigo; `ProgressBar` takes a track class (member baan) + fill class (member lijn); drop the orange 100% variants. Stories updated. Unit tests for the button semantics.
- [ ] **U2 — routines surfaces** (`apps/web/src/modules/today/ui/routines-board.tsx`, `modules/routines/ui/*`, `(hub)/routines/[memberId]`): pass member classes into U1 components; column head 3px member lijn bottom line (exists on taken, verify) + 40px ring 3px; routine progress card wassing + lijn bar; remove orange gradient/ring/head on 100% (keep the small "Alles gedaan · +N sterren" chip); task rows whole-row tap; solo page same. `MemberFilter` selection ring indigo 2px, unselected opacity 0.45.
- [ ] **U3 — Vandaag hub** (`modules/today/ui/*`): timeline row 4px line = owner member lijn (two owners: 180° split gradient, no owner: `#b6b3ab`), category colour moves to the icon tile only, rail dots 10px member lijn, NU row `rgba(93,95,239,0.07)` indigo; kid cards: face ring 3px + member baan progress track; avatar filter moves from the card header to beside the clock (36px faces, `Iedereen` pill), "voorbij" toggle takes its place in the card header; FAB 64px indigo with 4 pills; radii 16/8 via tokens; delete `today-tabs.tsx`, `today-tab-personen.tsx`, `today-tab-sterren.tsx` if unreferenced (verify `(app)/today` first).
- [ ] **U4 — Kalender + Beloningen hub** (`modules/calendar/ui/*`, `modules/rewards|store ui`): agenda/event rows `border-left:3px` member lijn (category on the tile), column heads `border-bottom:3px` member lijn, face-row rings 3px, remove the oversized indigo-ringed face row, filter selection ring indigo; store/rewards avatar chips wassing `95% 0.025` + 3px ring, selected chip indigo border. Radii 8 on tiles/rail where the mockup changed them.
- [ ] **R1 — review + gates + baselines** (main thread + reviewer agents): per-unit sonnet review, fix loops back to agy (flash, `--continue` only after quota/timeout), `pnpm typecheck`, scoped oxlint, vitest, then Playwright `@visual` hub project `--workers=1` with the `.env.local` move/restore rule; regenerate hub baselines; kiosk audit (48px floors) green; axe on routines/taken/hub. Merge, `railway up`.
- [ ] **M3 — hub = app (D2-A)**: separate plan `docs/plans/<date>-hub-equals-app.md`, own cap; includes the "management" page idea and the `CLAUDE.md` stale reference.

### Cap (proposal, D3)

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
