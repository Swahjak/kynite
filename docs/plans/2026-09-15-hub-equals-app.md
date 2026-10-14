# M3 — hub = app (D2-A)

Owner ask (2026-09-15): one route tree. Member and hub device render the same pages; the principal decides the controls. Follows `2026-09-15-design-drift.md` (M1, M2 done). Orchestrator mode. H0–H4 were run via OpenCode (DeepSeek V4, D8 pattern); H4 completion and H5 by Claude sonnet subagents with opus/sonnet reviews. Branch `feat/hub-equals-app`, units sequential in the main checkout. `AGENTS.md` (modified) and `opencode.json` (untracked) are the owner's: never stage them.

## Context

- Groups before M3: `(app)`, `(hub)`, `(hub-clock)`, `(auth)`, `(marketing)`, `(share)`; now one shared tree (`(main)`, `(clock)`), `/hub/*` redirected in `proxy.ts`.
- `surface` varies presentation, never data (`TodayHeader` pattern). e2e projects: `app` (390x844), `hub` (1280x800), `share`, `perf`.

## Decisions

- D23 (owner, 2026-10-13/14): no cookie on the shared tree → `/sign-in?callbackUrl`. `/clock` and `/pair` stay device-only (no cookie → `/pair`). The sign-in page sends a device principal to `/today` and ignores the callback. Sign-in has a link "Dit scherm koppelen" → `/pair`.
- D24 (owner): privacy is decided by principal (device = busy-only, with a loader backstop); the default calendar view by surface (hub|desktop → family `hubDefaultView`, app → day).
- D25 (owner): the pair screen clears user caches before pairing. The hub manifest has `start_url /nl/today`, `scope /nl/`, `id` unchanged.
- D26 (owner): on a themed day, live timeline rows stay open (`foldLive={!banner}`); the "Nu" tint and label stay.
- D27 (owner): kiosk tap targets are ≥48px on hub/desktop. Hub-project 390px desktop-UA visual shots are dropped (the phone is covered by the app project).
- D28 (owner, 2026-10-14): design over contrast. Live event-row times contrast (`event-row.tsx:210,216`) is parked with the other contrast failures; praise ≥ star (equal size) and the quiet grace row without dimming are intended, e2e asserts kept accordingly.
- D29: TimerControls restored for members on `/timers`; the device keeps quick start.
- D30: weather first on the phone (above the theme banner).
- D31: push URLs keep opening the family board.

## Resume here (checkpoint 2026-10-14, after R review + fixes)

State: H0–H5 and the R review fixes committed on `feat/hub-equals-app`; PR open to `main`. No background processes running.

R done: opus security review + sonnet general review; 11b16dd (opencode.json/AGENTS.md) dropped from history, `opencode.json` now ignored (backup branch `backup/hub-equals-app-pre-R1`). Fix units: R2 (`requireManager` on every /manage page, pair ends the member session + `signOutFailed`), R3 (/today controls on principal, /timers member controls, weather order), R4 (sheet close, routines header surface, device rail order, next-intl vitest inline, cleanup). e2e baselines refreshed (rail, routine builder, settled stars), calendar greeting pinned.

Gates: typecheck/oxlint/build green; vitest only the 4 design-token reds; e2e app 90/100 (rest parked contrast + 3 flaky); hub targeted green except parked store contrast; share skipped (owner, unchanged since the green run); @smoke 9/9.

R remaining: merge PR, `railway up`, discovery endpoints, Fully start URL → `/nl/today` (owner action on the wall).

## Units (all done; R remaining steps in Resume)

Gates per unit: `pnpm typecheck` once, `pnpm exec oxlint --threads 1 <changed files>`, vitest scoped to touched slices `--maxWorkers=1`. Playwright `--workers=1`.

- [x] **H0** (`2287b4d`, D14): `src/app/api/mcp` excluded from `hardcoded-strings`.
- [x] **H1** (`895fec1`): routines/store/board headers onto the `TodayHeader`/`PageHeader surface` pattern.
- [x] **H2a** (D17, D18): surface resolver (principal + cookie + UA hint) → `data-surface` on `<html>`, Tailwind variants, "Weergave in deze browser" setting; audit count 62 → 64.
- [x] **H2** (D9, D16, D17): one responsive shell, one destination list, kiosk behaviours only for the device principal.
- [x] **H3** (`89391f5`, D12): one route tree `(main)`/`(clock)`, member-or-device gate, `proxy.ts` pre-filter + `/hub/*` redirects; units H3a–g incl. merge-loss restores (weather density, NU strip, phone FAB actions, greeting, `today-board` testid) and the `'use server'` build fix.
- [x] **H4** (D10, D22): Beheer under `/manage/*` (layout gate), own settings at `/account`, 308 redirects for `/settings/**`, `/family`, `/rewards`; per-person view (`TodayTabs`/`TodayTabPersonen`/`nowEventKey`) deleted.
- [x] **H5** (2026-10-14, D23–D27): e2e + docs moved to the one tree, delivered by Claude sonnet subagents:
  - H5a/a2: e2e path swap + `app` project. H5b: `hub` project + visual baselines.
  - H5c/H5d: docs (`CLAUDE.md`, architecture note) + service-worker hub-shell on the shared paths.
  - H5e: auth/data (D23–D25), private calendar.
  - H5f: FAB pointer-events, weather hydration, praise size, replacement tests; dead code removed (StarMatrix, TodayTabSterren, use-today-tab).
  - H5g: loader/proxy coverage. H5h: spec triage (D26). H5i: pre-paint script once via `useServerInsertedHTML`, D27, timer spec, unpair spec race.
  - Reviews: opus on H5d/H5e (2 rounds)/H5g, sonnet on the rest. H5h got a third fix round on owner approval.
- [x] **R — review + fixes + gates** (2026-10-14, D28–D31): see Resume. Merge + deploy remain.

## Agent log (summary)

- s6 sonnet scout (81k); H0–H2a: sonnet dispatchers 59–171k per unit, reviews 31–57k; OpenCode ≈ $0.2 per unit.
- H2/H3a–g/H4 (OpenCode `offload-lead`, 14 runs of the 40-run cap, logged ≈ $1.3 — dashboard ≈ 4x): reviews sonnet 62–78k, opus 85–107k; they caught ~10 🔴 (route collision, ungated `/manage/*`, four merge losses, manifest dropped).
- R: reviews opus 113k/74k, sonnet 216k/84k/80k; fixes R2 89k, R3 95k, R4 105k; e2e runs 54–99k.
- H4 finished and all of H5 by Claude sonnet subagents; token overruns vs the 80k budget: H5a 127k, H5a2 234k, H5b 140k, H5f 149k+, H5h 122k, H5i 138k.

### Lessen

- Merge losses: a page merge is lossless only if someone diffs both originals prop by prop; four losses passed typecheck, oxlint, unit suite and `next build`. A changed test premise is a finding for the orchestrator, never to be absorbed into the test; trace a red assertion to its subject before touching it.
- D21 follow-up: route collisions and `'use server'` non-function exports are only caught by `next build`.
- Runner: the digest keeps ~300 chars of the final report, so briefs end with "write the full report to `<scratchpad>/<unit>-report.md`"; the digest also attributes concurrent main-thread edits to the run (check `git diff`); the model silently skips half a brief (2x) and the runner timeout/step cap can end a run unfinished.
- OpenCode runs: harness "low memory" kills hit long backgrounded Bash with 14–18 GiB free; use short foreground launches, separate waiters, detached for >10 min. A blocked out-of-scope attempt (`DENIED`) is logged, not a stop. `runs.jsonl` cost is ≈ 4x too low (cache tokens).
- Red unit files (none from M3): `no-negative-marking` (`modules/routines/ui/tokens.ts:108`), `utils` font scale misses `--text-display-3xl`, `ui/nested-card-borders` is stale vs D4, `border-width-scale`. The four `next-intl/navigation` resolve failures are fixed (inline in vitest).
- Never run tests in parallel agents on the owner's laptop (load ~30–36): one test run at a time, `--workers=1`.
- Subagent budget: units that combine "run the whole e2e project + fix" blow the 80k budget. Split e2e triage per project or per spec group.
- Reviewers must not checkout/detach in the main checkout (one did, and restored it). The brief must say so explicitly.
- e2e asserts on `/today` are time-of-day sensitive (folded live/past rows). Seed relative to now and use `e2e/utils/timeline.ts` `openFoldedRows`.

## Open follow-ups / Parking

- Contrast failures (11+), parked by the owner for one token unit after M3 (these specs stay red): settings `.border-primary` 4.35; `/dev/design` label-overline 4.04, bg-now 3.76, bg-gold/16 4.09; hub store label-overline 2.3, locked reward 2.99/2.3, `.px-3.5` 3.2; calendar strike-through `text-cat-purple-fg` 3.1, 8px face initials 3.32; plus live event-row times (`event-row.tsx:210,216`, D28) and the calendar past-event row.
- The 4 design-token red unit files (see Lessen).
- Flaky e2e: `calendar.spec.ts:174`, `invite.spec.ts:154`, `auth-flow.spec.ts:97`.
- SW page cache is not cleared when a different member signs in.
- Manifest scope `/nl/` (English households).
- `kynite.surface` cookie is per browser.
- `requireManager` sign-in callback drops the query string.
- Phone first-tap loss on /calendar: SSR renders wide (`use-is-wide.ts:46`), the phone layout swaps at hydration. 3/36. `openEventDialog` keeps a bounded `toPass`.
- Hydration warning on `/manage/routines` (`value="false"` input, suspected `Switch`), unverified.
- `x-kynite-path` not stripped in the proxy's share/invite branches (hygiene only).
- 🔵 tests: `proxy-auth.test.ts` should reset `seen.request` per case; `page-data.test.ts` has no deny-grade case.
- SheetClose `role="link"` not verified in a browser.
- Deploy condition: Fully kiosk start URL → `/nl/today`. The SW never caches a redirect, so an offline cold boot on `/nl/hub` gets the browser error page.
