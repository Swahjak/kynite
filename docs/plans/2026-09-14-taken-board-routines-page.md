# Taken board + Actieve routines page — tracking

Owner ask (2026-09-14): bring the hub taken board in line with the refreshed `Taken en routines.dc.html` mockup, add the family-wide routines page from `Actieve routines.dc.html`, and make the routines on the today/dashboard page link to the routine page. Orchestrator mode; subagent cap 6 (2 scouts spent).

## Decisions

- **Routes follow the mockup nav.** The family board moves from `/hub/routines` to `/hub/taken`; `/hub/routines` becomes the family-wide "Actieve routines" page; `/hub/routines/[memberId]` stays as-is and is the link target for a member's routine block and dashboard card. Between M2 and M3 `/hub/routines` redirects to `/hub/taken` so nothing 404s.
- **Board** (`modules/today/ui/routines-board.tsx`): routine steps leave the column; one collapsed progress card per column ("Ochtendroutine", "X van Y stappen", bar) links to `/hub/routines/[memberId]`. Daypart comes from the clock (`daypartFromHour`), no tabs. New "Wie" member filter (Iedereen pill + 32px faces in 48px hit zones, multi-select) replaces them. Column progress counts **tasks only**. Pool column 280px fixed; member columns `flex: 0 0 calc(33.333% - 10px)`, `min-width: 340px`, horizontal scroll, swipe hint footer. Task row 64px, 46px check circle (already so — verify).
- **Wie filter** is a shared client component (`modules/today/ui/member-filter.tsx`, `MemberFace` from `@kynite/ui`), reused by M3. Selection is client state only (no URL param).
- **Actieve routines page**: one column per member (same width model), head with 52px face, "X van Y stappen" + inline bar + %, daypart bands (ochtend/middag/avond, hidden when empty) each with 6px bar, `RoutineCard` accordion (existing `@kynite/ui` composite; NU / KLAAR states) with checkable `StepRow`s, first not-done routine open, pager dots in the footer. Loader: extend `modules/routines/page-data.ts` with a family-wide variant of `loadMemberRoutines` (or map over members), device principal allowed as on `[memberId]`. `TodayLive` mounted.
- **Dashboard link**: `KidStatCard` on `/hub` (`modules/today/ui/kid-stat-card.tsx` wrapper) becomes a link to `/hub/routines/[memberId]` via the package's `render` prop + `next/link`, whole card tappable (≥48px). `(app)/today` gets the same link only if it renders the same card; the app has no checklist page, so no new app route.
- **Celebration is louder** (owner, 2026-09-14). Completing a single task or step: `StarPop` from the tap origin plus a short confetti burst (`useConfetti`, existing `ConfettiProvider`), check circle pop. Completing a **whole routine**: a bigger moment — full confetti, the routine card's "KLAAR" state enters with the spring/bounce from DESIGN.md, a celebrate banner naming the child and the stars earned; on the board the column's 100% state (orange ring, shimmer bar, "Alles gedaan · +N sterren") is kept. Praise copy before the star count (psychology rules). Respect `prefers-reduced-motion`.
- Hub nav (wherever the hub's tab rail lives): add "Taken" (checklist icon) → `/hub/taken`, keep "Routines" → `/hub/routines`. i18n nl/en.
- Tests: move/adjust `tests/unit/today/routines-board.test.ts` + e2e specs that hit `/hub/routines` for the board (`hub/visual/routines.spec.ts`, `celebration`, `completion-perf`, `offline-outbox`, `axe`, `kiosk-audit`); new visual baselines for `/hub/taken` and `/hub/routines`; kiosk audit must stay green (48px floors — the pre-existing 40px pill-tab failure disappears with the tabs).

## Milestones

- [x] M1+M2 — board (sonnet). `a3e3523` on feat/taken-board-routines-page. Route move + redirect, `MemberFilter`, routine progress card + link, tasks-only progress, widths/scroll, nav item, tests.
- [x] M3 — Actieve routines page at `/hub/routines` (opus). `d807b92`. Deviations: steps complete-only (no un-tap, matches `[memberId]`); `StepRow variant="tile"` 80px instead of 64px hand-built rows; star pill = stars earned today from the board; `swipe` glyph pending M5.
- [x] M4 — dashboard card link (sonnet). `7bb9e47`. Baselines/kiosk audit run deferred to R (Playwright, main thread).
- [x] M5 — icons (sonnet). `5031731` `05e90df` `1656119` `9913af2` `b610491` + step-icon render follow-up. Deviations: no `sink` glyph in Material Symbols; task icon has no picker (tasks slice is create/toggle/delete by design) — set via `create_task` MCP or suggested from the title. Owner (2026-09-14): routines and tasks are missing icons. Today: `routine.icon` nullable with an 8-entry `ROUTINE_ICONS` subset (`modules/routines/ui/tokens.ts`, fallback `task_alt`); `routine_step.icon` column exists but no picker, not in the MCP schema, always null; `task` has no icon column at all (`routines-board.tsx` draws one fixed `TASK_ROW_ICON`). Work: (1) extend the icon subset (`packages/ui/scripts/subset-icons.mjs` → `icon-codepoints.ts` + woff2, `pnpm icons:check`) with the mockup's household set — dentistry, checkroom, restaurant, backpack, wash, nutrition, menu_book, auto_stories, wc, crib, pets, lunch_dining, directions_car, sink, local_laundry_service, pedal_bike, shopping_cart, countertops, toys, bedroom_baby, delete, potted_plant, mail, wb_twilight, celebration, emoji_events, swipe, self_improvement, plus the current eight — one shared `ACTIVITY_ICONS` list; (2) `suggestIcon(title)` keyword map (nl+en: tanden→dentistry, aankleden→checkroom, ontbijt/eten→restaurant, tas→backpack, …) used as the default whenever `icon` is null for routines, steps and tasks; (3) step icon: picker per step in `routine-dialog.tsx`, `icon` in the MCP `create_routine`/`update_routine` step schema, rendered by `StepRow`; (4) task icon: `icon` column + migration on `modules/tasks/schema.ts`, picker in the task editor, `create_task`/`update` MCP input, board row uses it. Icon picker = one shared component (grid of 48px tiles) reused by routine, step and task editors.
- [ ] R — review → fix → merge → deploy.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | code map | sonnet | 60k | 20 | done |
| s2 | mockup spec | sonnet | 59k | 4 | done |
| m12 | M1+M2 board | sonnet | 230k | 147 | done `a3e3523`; `swipe`/`restart_alt` glyphs deferred to M5 |
| r1 | review M1+M2 | sonnet | 66k | 30 | 1 bug (star banner) + 2 nits |
| f1 | fix r1 | sonnet (builder) | 37k | 18 | done, gates run by main |
| m3 | M3 routines page | opus | 183k | 62 | done `d807b92`; resumed for r2 fixes |
| r2 | review M3 | sonnet | 88k | 27 | 2 risks + 1 nit |
| m4 | M4 dashboard link | sonnet | 122k | 48 | done `7bb9e47` |
| m3b | r2 fixes (resumed m3) | opus | +18k (201k total) | 12 | done `cdcaaff`, retired |
| m5 | M5 icons | sonnet | 263k | 251 | done, 5 commits; first run aborted (plan not on branch, my fault); retired at ceiling |
| m5b | StepRow icon render | sonnet | — | — | running |
