# M3 — hub = app (D2-A)

Owner ask (2026-09-15): one route tree. Member and hub device render the same pages; the principal decides the controls. Follows `2026-09-15-design-drift.md` (M1, M2 done). Orchestrator mode; code units go to **OpenCode (DeepSeek V4)** via `~/.claude/skills/opencode/opencode-delegate.mjs`, driven by a sonnet dispatcher subagent per unit (D8 pattern); reviews on the Claude side (sonnet `unit-reviewer`). First use of OpenCode on this repo: any runner/permission/flag anomaly is reported to the owner as-is, not worked around.

Branch `feat/hub-equals-app`, units sequential in the main checkout (no parallel writers, so no worktrees). `AGENTS.md` (modified) and `opencode.json` (untracked) are the owner's: never stage them.

## Facts (scout s6, 81k)

- Groups `(app)`, `(hub)`, `(hub-clock)`, `(auth)`, `(marketing)`, `(share)`. `(app)/layout.tsx:40-49` gates member (device → `/hub`); `(hub)/layout.tsx` has no gate by design, each page calls `requireHubDevice()` (`modules/devices/hub-gate.ts:27`); `proxy.ts:101-183` is a cookie pre-filter (device cookie for `/hub/*` except `/hub/pair`).
- Same component on both sides already: Vandaag (`TodayHeader surface`, `TodayLive`, `loadHubBoardComposition`), Kalender (`CalendarShell`). `TodayHeader` documents the target pattern: `surface` varies presentation, never data.
- Genuinely different UIs under one name: `(app)/routines` = routine **builder** vs `(hub)/hub/routines` = check-in board (`RoutinesPageBoard`); `(app)/rewards` = parent management (approvals, balances, award) vs `(hub)/hub/store` = child shelf; `(app)/timers` = `TimerControls` vs `(hub)/hub/timers` board + `/hub/timer` fullscreen.
- Tree-exclusive: app `family`, `settings/*`, `oauth/consent`; hub `pair`, `timer`, `taken`, `routines/[memberId]`, `stars/[memberId]`, `store`, `(hub-clock)/hub/clock`.
- Hardcoded `/hub/*`: `proxy.ts:179`, `hub-gate.ts:29,78`, `components/hub/hub-rail.tsx:68-92` (closed href union), `components/hub/idle-return.tsx:71-81`, `(app)/layout.tsx:45`.
- Chrome: `(app)` = `AppRail` + `MobileNav`, `FabSlot`, `GoogleReauthBanner`; `(hub)` = `KioskShell` (rail), pre-paint theme script (`HUB_THEME_STORAGE_KEY`), `TimerActivityProvider`, `HubReloadController`, `ChimeSettingsPanel`, `RailTimerTile`.
- Headers: `TodayHeader` (unified already), `routines-page-board.tsx:179-207`, `routines-board.tsx:135-163`, `hub/store/page.tsx:77-100` bespoke; app pages use `PageHeader` (`routines/page.tsx:32` opts out).
- e2e: projects `app` (390×844), `hub` (1280×800), `share`, `perf`; specs app 20, hub 17, share 2.

## Decisions

- D9 (owner): **one chrome for everyone** — one responsive shell; kiosk-only behaviour (idle-return to the clock, `HubReloadController`, pre-paint theme, chime panel) is what the device principal switches on, not a second layout.
- D10 (owner): **Beheer page** — everything device-denied (routine builder, rewards management/approvals/award, family, settings, calendars, devices) gathers under one "Beheer" area; the everyday pages become read/tap surfaces for everyone (check-in board, shelf, timers board).
- D11 (owner): M3 scope includes header unification, test rot (hub agenda board spec + stale baselines, `hardcoded-strings`), `CLAUDE.md` stale refs. Excludes the `reward-card.tsx` axe hits.
- D12 (proposed, owner to confirm): **URLs** — one tree on unprefixed English paths (`/today`, `/calendar`, `/routines`, `/tasks`, `/store`, `/timers`, `/manage/*`, `/pair`, `/clock`); every `/hub/*` path permanently redirects to its twin, so the Fully start URL keeps working unchanged.
- D13 (proposed): **density** — the `surface` presentation prop stays and follows the principal (device = wall scale); layout and navigation identical. Alternative: viewport-driven (CSS breakpoints), costlier because `surface` is decided server-side today.
- D14 (orchestrator): `hardcoded-strings` excludes `src/app/api/mcp/**` — tool descriptions are English LLM-host text by design (`tools/instructions.ts`), not UI copy.
- D15 (orchestrator): executor OpenCode `deepseek-v4-pro` (default), `--flash` only for mechanical renames/moves; max 2 retries per brief, then escalate to owner.

## Units

Gates per unit: `pnpm typecheck` once, `pnpm exec oxlint --threads 1 <changed files>`, vitest scoped to touched slices `--maxWorkers=1`. Playwright only in H6/R (`--workers=1`, `.env.local` move/restore, visual straight to `--update-snapshots=all`).

- [ ] **H0 — hardcoded-strings green** (D14): scope the scan in `apps/web/tests/unit/i18n/hardcoded-strings.test.ts` to skip `src/app/api/mcp/**`. First OpenCode trial.
- [ ] **H1 — one page header**: `routines-page-board.tsx`, `routines-board.tsx`, `hub/store/page.tsx` headers onto the `TodayHeader`/`PageHeader surface` pattern (title, optional date, member filter slot, clock slot, back link). No route changes.
- [ ] **H2 — one shell** (D9): merge `AppRail`/`MobileNav` and `KioskShell`/`HubRail` into one responsive shell with one destination list (Vandaag, Kalender, Routines, Taken, Winkel, Timers, Beheer-if-allowed); kiosk behaviours mounted only for the device principal.
- [ ] **H3 — one route tree** (D12, blocked on owner): new group with a layout that accepts member **or** device; hub pages become the canonical pages at the new paths; per-page gate helper replacing `requireHubDevice()` (member|device, keeps the per-page pattern); `proxy.ts` pre-filter accepts either cookie on the shared tree; `/hub/*` redirects; rail/idle-return/hub-gate hrefs; `/pair`, `/clock`.
- [ ] **H4 — Beheer** (D10): `/manage` index + move routine builder, rewards management, family, settings links under it; member-only gate (device gets redirected to `/today`); Beheer entry in the shell only when the principal can manage. Delete the now-orphaned `(app)` duplicates (app today tabs, `today-tabs.tsx` & co if unreferenced).
- [ ] **H5 — e2e + docs**: move hub/app specs and fixtures to the new paths, rewrite `calendar.spec.ts:278 hub agenda board` (pill tabs gone since `b4ce25c`), regenerate visual baselines; `CLAUDE.md` Calendar Component section + stale `calendar-context.tsx` ref; architecture note on the one tree.
- [ ] **R — review + gates + deploy**: sonnet review of the branch diff, full scoped gates, `@smoke` app+hub, merge, `railway up`, check discovery endpoints, then Fully start URL on the wall (redirect).

## Cap (proposed)

OpenCode: ≤25 runs (≈15 briefs + retries). Claude: one sonnet dispatcher per unit ≤120k (7), one `unit-reviewer` per unit (7), ≤2 investigators buffer. Overrun → ask.

## Agent log

| id | model | role | tokens | tool uses | note |
|---|---|---|---|---|---|
| s6 | sonnet (Explore) | scout hub vs app | 80.6k | 27 | facts above |
