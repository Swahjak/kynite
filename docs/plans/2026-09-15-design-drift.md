# Design drift — Ledenkleuren, Vandaag, hub = app

Owner ask (2026-09-15): the Claude Design mockups are ahead of the code. Biggest miss: the member-colour rules in `Ledenkleuren.dc.html` barely show in the rendered app. The Vandaag mockup was updated. Separately: the hub should be the same surface as the web app, only with lowered permissions. Orchestrator mode.

Design sync `7caade9` pulled Vandaag, Actieve routines, Taken en routines (etags in `docs/design/claude-design/.etags.json`).

## Findings (scouts s1–s3)

- Token layer already matches Ledenkleuren 1:1: `--member-<slot>-{wassing,baan,lijn,inkt}` in `packages/ui/src/styles/tokens.css:341-369`, six hues (335/245/196/312/90/30), `MEMBER_COLOR_CLASSES` in `modules/family/ui/tokens.ts:38` (+ duplicate `modules/calendar/ui/tokens.ts:175`).
- The carriers are missing or overruled on the rendered surfaces (baselines checked by eye):
  - Vandaag `/hub`: timeline left line = category colour, member only as 24px chip; kid cards face-wassing only, no ring/line. Mockup: 4px member line on rows/cards, rail dots.
  - Routines board `/hub/routines`: icon tiles neutral (mockup: member wassing); done step green block (new mockup: member wassing + member lijn disc); NU indigo (new mockup: member wassing/inkt); 100% column goes fully orange (gradient + ring + head) — the mockup's own "Niet: de hele kaart in de ledenkleur" and orange hijacks identity; new mockup removed the orange takeover (`routines-board.tsx:335-381`, `step-row.tsx:135-273`, `routine-card.tsx:162,271`).
  - Taken `/hub/taken`: head line + routine progress card wassing correct.
  - Kalender `/hub/kalender`: event card line = category colour; column head has no baan/3px line; oversized face row with indigo ring top-right.
- Rule conflict inside the design project: Ledenkleuren (2026-09-03) says green stays the checkmark, NU stays indigo, orange stays the reward. Actieve routines + Taken (edited 2026-09-14) moved done disc/tile and NU badge to member hue, dropped green. Vandaag (2026-09-15) keeps green check in Takenlijst and indigo NU. → decision D1.
- Vandaag diff: tabs gone (app already has real routes instead), avatar filter moves from the Dagoverzicht header to beside the clock (app: still in card header, `today-timeline-filter.tsx:63`; header has a static `FaceStack`), "voorbij" toggle replaces it in the card header (collapse exists: `today-past-rows.tsx`), quick-actions grid → FAB (app has it), radii 20/14 → 16/8 (token check), weather/routines/tasks cards exist. Dead-ish: `today-tabs.tsx`, `today-tab-personen.tsx`, `today-tab-sterren.tsx` (check `(app)/today`).
- Hub/app split today: two route groups `(hub)` and `(app)` (+ `(hub-clock)`), two layouts (`KioskShell` + `hub-rail.tsx` vs `AppRail`/`MobileNav`), per-page `requireHubDevice()` gate (`modules/devices/hub-gate.ts:27`), principal union member|device|share with a `device` column in the 20-capability matrix (`modules/family/authorize.ts:82`; device denied on every `*:write`/`*:manage`, allowed on `completion:write`, `task:complete`, `redemption:request`, `timer:control`, `calendar:view`). Loaders mostly shared per module; `today` has three (`page-data-hub.ts`, `page-data.ts`, `page-data-board.ts`). Domain pairs: calendar, routines, rewards/stars/store, timers duplicated in UI; tasks hub-only; settings/family app-only. `data-surface='hub'` now only drives dark theme + calendar comments (type scale removed 2026-09-15). Playwright projects `app` (phone) / `hub` (tablet, device session). Split documented in `docs/architecture.md` §2/§7, no ADR.

- Settings overlap (s4): household settings are one DB store shared by both surfaces (`family.hubDefaultView` via `HubDisplayForm`, calendar visibility/colour, weather location — all gated by `display:manage`, device denied). Hub-only, device-local: theme mode `kynite.hub.theme` (`components/hub/use-hub-theme.ts`), `kynite.today.tab`, `kynite.today.day-view`, confetti seen-flag. The `device` row carries no display prefs. The app has no theme toggle at all. `CLAUDE.md`'s `components/calendar/contexts/calendar-context.tsx` reference is stale (file gone).
- Owner (2026-09-15): whole step/task row must be tappable, kids miss the 46px circle. Mockups already bind the toggle on the row (`s.toggle`/`t.toggle`); code binds it on the circle only. Scope: `StepRow` tile variant, task rows in `routines-board.tsx`, solo `[memberId]` page; row = one button (64px min), circle decorative, no nested interactive.

## Decisions

- D1 (owner, 2026-09-15): the design side resolves the conflict first — a design agent aligns all mockups in Claude Design with one member-colour rule set. Code waits; next step is a design sync (etag diff) once the owner signals, then milestone 1 is specced from the aligned mockups.
- D2 (owner, 2026-09-15): **A** — one route tree; `(hub)` goes, member and device render the same pages, the principal decides the controls. Owner idea to explore in the design pass: one dedicated "management" page that gathers everything device-denied (`*:manage`, family, devices, Google, sharing, subscriptions) in one place instead of the current settings sub-tree.
- D3 (owner): cap set after the D1 design lands.

## Waiting on

Owner signal that the Claude Design mockups are aligned. Then: `list_files` etag diff → pull changed files → spec milestone 1 (member-colour carriers, Vandaag layout, whole-row tap) and the D2-A route merge (own plan, own cap).

## Milestones

(filled after D1–D3)

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | Ledenkleuren rules vs app | sonnet | 61k | 6 | done |
| s2 | hub/app map | sonnet | 55k | 19 | done |
| s3 | Vandaag diff vs app | sonnet | 105k | 15 | done |
| s4 | hub/app settings overlap | sonnet | 38k | 15 | done |
