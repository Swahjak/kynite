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
- D12 (owner, approved): **URLs** — one tree on unprefixed English paths (`/today`, `/calendar`, `/routines`, `/tasks`, `/store`, `/timers`, `/manage/*`, `/pair`, `/clock`); every `/hub/*` path permanently redirects to its twin, so the Fully start URL keeps working unchanged.
- D13 (owner, approved): **density** — the `surface` presentation prop stays and follows the principal (device = wall scale); layout and navigation identical. Alternative: viewport-driven (CSS breakpoints), costlier because `surface` is decided server-side today.
- D16 (owner, approved): **mobile nav** — bottom nav follows the Kalender mockup: Vandaag · Kalender · Taken (`/tasks`) · Sterren (`/store`) + Meer; the existing `nav-overflow-sheet.tsx` holds Actieve routines, Timers, Beheer (Beheer only when the principal can manage). Beheer is an index (routine builder, rewards + approvals, family, settings, devices, sharing), not loose items in Meer. Tablet width: the rail shows every destination, no Meer. The old bottom-nav "Routines"/"Rewards" (builder/management) move under Beheer.
- D17 (owner, approved): **surface resolver** — `app | desktop | hub`, resolved server-side per request, first match wins: (1) device principal → `hub`; (2) per-browser cookie `kynite.surface` (member choice, `app | desktop` only — `hub` is reserved for paired devices); (3) default from `Sec-CH-UA-Mobile` / User-Agent: mobile → `app`, else `desktop`. Exposed as `data-surface` on `<html>` + Tailwind `@custom-variant app|desktop|hub`; the server-side `surface` prop reads the same resolver (supersedes D13's "follows the principal"). **For now `desktop` renders exactly like `hub`** (owner: touch tweaks for the wall come later); `app` gets sensible mobile defaults from the existing mobile designs (Kalender mockup bottom nav, D16).
- D18 (owner, 2026-09-15): `data-surface` is written server-side by the locale root layout via `getSurface()` (accepts `privacy`/`terms` going dynamic); the resolver is the sole writer — the hub pre-paint script and `useHubTheme()` keep the theme only. The `tokens.css` `[data-surface=hub]` type-scale override stays hub-only until H3. iPadOS Safari reports a Mac UA and therefore resolves to `desktop` (= hub presentation), which is fine.
- OpenCode anomaly log: H2a run 2 tried `rm -rf apps/web/.vitest` (out of scope), blocked by the permission map (`DENIED:1`), nothing removed. Owner: works as intended, continue; DENIED on a blocked out-of-scope attempt is logged, not a stop. Runner reports new files as `+1` lines each (cosmetic).
- OpenCode anomaly log (22:30–22:45): two `--flash` runs launched from the main thread as a background Bash were killed by the Claude Code harness ("system is running low on memory"). Run 1: swap was 8.0/8.0 GiB full, two stale `opencode` processes alive (owner: stopped), `/tmp` tmpfs 6.5 GiB (cleaned to 1.2 GiB: stray `/tmp/.pnpm-store`, `node-compile-cache`, stale `go-build`). Run 2: killed again with 14 GiB available and swap 3.6 GiB — but its edit had landed (correct, verified); no digest and no `runs.jsonl` entry. Cause unknown; the dispatcher-driven foreground runs never hit it.
- D14 (orchestrator): `hardcoded-strings` excludes `src/app/api/mcp/**` — tool descriptions are English LLM-host text by design (`tools/instructions.ts`), not UI copy.
- D15 (orchestrator): executor OpenCode `deepseek-v4-pro` (default), `--flash` only for mechanical renames/moves; max 2 retries per brief, then escalate to owner.

## Units

Gates per unit: `pnpm typecheck` once, `pnpm exec oxlint --threads 1 <changed files>`, vitest scoped to touched slices `--maxWorkers=1`. Playwright only in H6/R (`--workers=1`, `.env.local` move/restore, visual straight to `--update-snapshots=all`).

- [x] **H0 — hardcoded-strings green** (`2287b4d`, D14): `src/app/api/mcp` added to `EXCLUDED_DIR_SEGMENTS`. First OpenCode trial: 1 run, deepseek-v4-pro, $0.008, 16.5k in / 0.7k out / 81k cache, 34 s, no flags.
- [x] **H1 — one page header** (`895fec1`; 4 OpenCode runs incl. 1 fix loop, $0.028; hub visual baselines for routines/taken/store will move, regenerated in H5): `routines-page-board.tsx`, `routines-board.tsx`, `hub/store/page.tsx` headers onto the `TodayHeader`/`PageHeader surface` pattern (title, optional date, member filter slot, clock slot, back link). No route changes.
- [x] **H2a — surface resolver** (D17, D18; 11 OpenCode runs ≈ $0.062 pro + 1 flash run with no cost record; review 2🔴 fixed, audit count 62 → 64): server helper (principal + cookie + UA hint) → `data-surface` on `<html>` in the locale layout, Tailwind custom variants in `packages/ui/src/styles` (or `globals.css` if the package can't know the attribute), a member setting "Weergave in deze browser" (app/desktop) writing the cookie; `surface` props wired to the resolver (`desktop` maps to the hub presentation for now). Unit test the resolution order.
- [ ] **H2 — one shell** (D9, D16, D17): merge `AppRail`/`MobileNav` and `KioskShell`/`HubRail` into one responsive shell with one destination list (Vandaag, Kalender, Routines, Taken, Winkel, Timers, Beheer-if-allowed); kiosk behaviours mounted only for the device principal.
- [ ] **H3 — one route tree** (D12, blocked on owner): new group with a layout that accepts member **or** device; hub pages become the canonical pages at the new paths; per-page gate helper replacing `requireHubDevice()` (member|device, keeps the per-page pattern); `proxy.ts` pre-filter accepts either cookie on the shared tree; `/hub/*` redirects; rail/idle-return/hub-gate hrefs; `/pair`, `/clock`.
- [ ] **H4 — Beheer** (D10): `/manage` index + move routine builder, rewards management, family, settings links under it; member-only gate (device gets redirected to `/today`); Beheer entry in the shell only when the principal can manage. Delete the now-orphaned `(app)` duplicates (app today tabs, `today-tabs.tsx` & co if unreferenced).
- [ ] **H5 — e2e + docs**: move hub/app specs and fixtures to the new paths, rewrite `calendar.spec.ts:278 hub agenda board` (pill tabs gone since `b4ce25c`), regenerate visual baselines; `CLAUDE.md` Calendar Component section + stale `calendar-context.tsx` ref; architecture note on the one tree.
- [ ] **R — review + gates + deploy**: sonnet review of the branch diff, full scoped gates, `@smoke` app+hub, merge, `railway up`, check discovery endpoints, then Fully start URL on the wall (redirect).

## Cap (owner: approved as a soft limit)

OpenCode: ≤25 runs (≈15 briefs + retries). Claude: one sonnet dispatcher per unit ≤120k (7), one `unit-reviewer` per unit (7), ≤2 investigators buffer. Overrun → ask.

## Agent log

| id | model | role | tokens | tool uses | note |
|---|---|---|---|---|---|
| s6 | sonnet (Explore) | scout hub vs app | 80.6k | 27 | facts above |
| d-h0 | sonnet | H0 dispatcher | 58.8k | 9 | 1 OpenCode run $0.008 |
| d-h1 | sonnet | H1 dispatcher | 101.6k | 29 | 3 OpenCode runs $0.024 (pro, 160 s total, no flags); PageHeader gained `leading`/`meta` |
| r-h1 | sonnet (unit-reviewer) | H1 review | 30.6k | 7 | 2🔴 routines boards on PageHeader default `surface="app"` on hub routes, 1🟡 prop docs; fix loop back to d-h1 |
| d-h2a | sonnet | H2a dispatcher (incl. resume after the DENIED stop) | 140.8k | 31 | 8 OpenCode runs $0.041 (pro; 55k in / 15k out / 1.35M cache); 2× DENIED on blocked out-of-scope shell (`rm -rf .vitest`, chained `git stash list`), work correct; found a 3rd `data-surface` writer in the hub-clock layout |
| r-h2a | sonnet (unit-reviewer) | H2a review | 57.0k | 27 | 2🔴 1🟡 1🔵: action without assertCan (audit test fails), `/hub/pair` resolves `desktop` (downgraded: unpaired ≠ hub, desktop = hub presentation, not fixed), cookie flags, stale type-scale comments (the `[data-surface=hub]` override was already gone from tokens.css) |
| d-h2a (resumed ×2) | sonnet | H2a fix loop | 171.5k total | 18 | 2 OpenCode `--session` runs $0.021 (assertCan, cookie flags, comments); audit count 62 → 64 = `reorderMemberAction` (`1f058cd`, pre-existing miss on main) + `setSurfacePreferenceAction`; bump sent straight from main thread (flash, first flash data point) |
| d-h1 (resumed) | sonnet | H1 fix loop | +5.9k (107.5k total) | 36 total | 1 OpenCode run `--session`, $0.004, 37 s, no flags |
