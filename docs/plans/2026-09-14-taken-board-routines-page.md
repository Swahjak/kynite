# Taken board + Actieve routines page — tracking

Owner ask (2026-09-14): bring the hub taken board in line with the refreshed `Taken en routines.dc.html` mockup, add the family-wide routines page from `Actieve routines.dc.html`, and make the routines on the today/dashboard page link to the routine page. Orchestrator mode; subagent cap 6 (2 scouts spent).

## Decisions

- **Routes follow the mockup nav.** The family board moves from `/hub/routines` to `/hub/taken`; `/hub/routines` becomes the family-wide "Actieve routines" page; `/hub/routines/[memberId]` stays as-is and is the link target for a member's routine block and dashboard card. Between M2 and M3 `/hub/routines` redirects to `/hub/taken` so nothing 404s.
- **Board** (`modules/today/ui/routines-board.tsx`): routine steps leave the column; one collapsed progress card per column ("Ochtendroutine", "X van Y stappen", bar) links to `/hub/routines/[memberId]`. Daypart comes from the clock (`daypartFromHour`), no tabs. New "Wie" member filter (Iedereen pill + 32px faces in 48px hit zones, multi-select) replaces them. Column progress counts **tasks only**. Pool column 280px fixed; member columns `flex: 0 0 calc(33.333% - 10px)`, `min-width: 340px`, horizontal scroll, swipe hint footer. Task row 64px, 46px check circle (already so — verify).
- **Wie filter** is a shared client component (`modules/today/ui/member-filter.tsx`, `MemberFace` from `@kynite/ui`), reused by M3. Selection is client state only (no URL param).
- **Actieve routines page**: one column per member (same width model), head with 52px face, "X van Y stappen" + inline bar + %, daypart bands (ochtend/middag/avond, hidden when empty) each with 6px bar, `RoutineCard` accordion (existing `@kynite/ui` composite; NU / KLAAR states) with checkable `StepRow`s, first not-done routine open, pager dots in the footer. Loader: extend `modules/routines/page-data.ts` with a family-wide variant of `loadMemberRoutines` (or map over members), device principal allowed as on `[memberId]`. `TodayLive` mounted.
- **Dashboard link**: `KidStatCard` on `/hub` (`modules/today/ui/kid-stat-card.tsx` wrapper) becomes a link to `/hub/routines/[memberId]` via the package's `render` prop + `next/link`, whole card tappable (≥48px). `(app)/today` gets the same link only if it renders the same card; the app has no checklist page, so no new app route.
- Hub nav (wherever the hub's tab rail lives): add "Taken" (checklist icon) → `/hub/taken`, keep "Routines" → `/hub/routines`. i18n nl/en.
- Tests: move/adjust `tests/unit/today/routines-board.test.ts` + e2e specs that hit `/hub/routines` for the board (`hub/visual/routines.spec.ts`, `celebration`, `completion-perf`, `offline-outbox`, `axe`, `kiosk-audit`); new visual baselines for `/hub/taken` and `/hub/routines`; kiosk audit must stay green (48px floors — the pre-existing 40px pill-tab failure disappears with the tabs).

## Milestones

- [ ] M1+M2 — board (sonnet). Route move + redirect, `MemberFilter`, routine progress card + link, tasks-only progress, widths/scroll, nav item, tests.
- [ ] M3 — Actieve routines page at `/hub/routines` (opus).
- [ ] M4 — dashboard card link + baselines/kiosk audit for new routes (sonnet).
- [ ] R — review → fix → merge → deploy.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | code map | sonnet | 60k | 20 | done |
| s2 | mockup spec | sonnet | 59k | 4 | done |
