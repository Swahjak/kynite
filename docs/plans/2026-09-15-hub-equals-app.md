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
- D32 (owner, 2026-10-14): WCAG contrast requirements dropped, design leads. Contrast asserts/checks are removed, not fixed; colours and tokens stay as designed. Other a11y checks stay.
- D33 (owner, 2026-10-14): google calendar discovery contract as in M4-T3 (owner/writer/reader stored, only primary enabled, rooms and free/busy excluded).
- D34 (owner, final 2026-10-15: "don't care"): bin icon tile teal (orange is reward-only).
- D35 (owner, 2026-10-15): time-of-day logic and date/time formatting use the family timezone (fallback Europe/Amsterdam), never the device/server TZ.

## Resume here (checkpoint 2026-10-15, after M5)

State: production deployed 2026-10-15 16:13 (Railway `0bc77f44`, commit 5641090: M4 + M5-T1); health, redirects and discovery verified. M5-T2 (03d45b0) merged but NOT deployed yet. Main CI green. No background processes.

Only remaining M3 step: Fully kiosk start URL → `/nl/today` (owner action on the wall).

R done earlier: opus security + sonnet general review; fix units R2–R4 (`requireManager` on /manage, pair ends member session, /today controls on principal, sheet close, etc.); e2e baselines refreshed.

## Units (all done)

Gates per unit: `pnpm typecheck` once, `pnpm exec oxlint --threads 1 <changed files>`, vitest scoped `--maxWorkers=1`. Playwright `--workers=1`.

- [x] **H0** (`2287b4d`, D14) mcp excluded from `hardcoded-strings`. **H1** (`895fec1`) headers onto `TodayHeader`/`PageHeader surface`. **H2a** (D17, D18) surface resolver + "Weergave in deze browser". **H2** (D9, D16, D17) one responsive shell.
- [x] **H3** (`89391f5`, D12): one route tree `(main)`/`(clock)`, member-or-device gate, `proxy.ts` pre-filter + `/hub/*` redirects.
- [x] **H4** (D10, D22): Beheer under `/manage/*`, own settings at `/account`, 308 redirects; per-person view deleted.
- [x] **H5** (D23–D27): e2e + docs on the one tree, auth/data, loader/proxy coverage, spec triage (D26), pre-paint script, D27; dead code removed.
- [x] **R** (D28–D31): reviews + fixes + gates.

## M4 — contrast checks out (D32), wave done

Route correction: kynite is not registered in work-ledger and has no `.pi/project.json`, so units ran as Claude sonnet subagents in worktrees under `/var/www/worktrees/kynite/` (not peep-pi).

- [x] **M4-T1** #10 (`1a42e4f`): axe `color-contrast` disabled in shared `e2e/utils/axe.ts`, two contrast-only tests deleted (D32).
- [x] **M4-T2** #11 (`ab166f3`): red integration tests were test gaps, not prod bugs: device-pairing auth mock lacked `api.signOut`; family-scope fixtures for `task`/`weather_snapshot`; settings-authorization needed required `formattingLocale`.
- [x] **M4-T3** #12 (`94d26f6`): google-calendar-picker test follows `594c1aa` contract (D33): owner/writer/reader stored, only primary enabled, rooms and free/busy excluded.
- [x] **M4-T4** #13 (`e965085`): routine bin icon tile red → teal (D34, code fix); `display-3xl` registered in `FONT_SIZE_TOKENS` (tailwind-merge dropped `text-display-3xl` or the colour class on ambient clock / timer ring); nested-card-borders test updated to D4; border-width-scale allows the D4 step circle `border-[3px] border-[#dcdad4]` in `step-row.tsx` only.
- [x] **M4-T5** #14 (`a141587`): CI `@visual` exclusion moved to config `grepInvert` via `E2E_GREP_INVERT` (CLI grep is not applied to dependency projects; `perf` depends on app/hub/share).

## M5 — family timezone (D35), wave done

Claude sonnet subagents in worktrees.

- [x] **M5-T1** #15 (`5641090`): server-rendered timers header clock passes the family timezone; `AmbientClock`/`TodayClock` were already correct via `useDateTimeFormat`; regression test in `timers-page-split.test.tsx`.
- [x] **M5-T2** #16 (`03d45b0`): one `hourIn` in `src/lib/hour-in-zone.ts` (h23), used by routines-board daypart (likely hydration-mismatch source; hub e2e under TZ=UTC: 0 "Hydration failed"), use-hub-theme, reload-gate (`timeZone` required), pre-paint-theme (zone serialized with `<` escaped); routines/[memberId] page passes timeZone; tests pin `process.env.TZ='UTC'` per file.

## Agent log (summary)

- s6 sonnet scout (81k); H0–H2a: sonnet dispatchers 59–171k per unit, reviews 31–57k; OpenCode ≈ $0.2 per unit.
- H2/H3a–g/H4 (OpenCode `offload-lead`, 14 runs of the 40-run cap, logged ≈ $1.3 — dashboard ≈ 4x): reviews sonnet 62–78k, opus 85–107k; they caught ~10 🔴 (route collision, ungated `/manage/*`, four merge losses, manifest dropped).
- R: reviews opus 113k/74k, sonnet 216k/84k/80k; fixes R2 89k, R3 95k, R4 105k; e2e runs 54–99k.
- H4 finished and all of H5 by Claude sonnet subagents; token overruns vs the 80k budget: H5a 127k, H5a2 234k, H5b 140k, H5f 149k+, H5h 122k, H5i 138k.
- M5: dev 77k (+fix round to 82k), 109k; fix round 60k; deploy 42k; reviews 22k/34k.
- M4: dev units 55k/79k/68k/81k/71k, reviews 19–38k, diagnostics haiku 66k/68k + sonnet 71k/52k.

### Lessen

- Merge losses: a page merge is lossless only if someone diffs both originals prop by prop; four losses passed typecheck, oxlint, unit suite and `next build`. A changed test premise is a finding for the orchestrator, never to be absorbed into the test; trace a red assertion to its subject before touching it.
- D21 follow-up: route collisions and `'use server'` non-function exports are only caught by `next build`.
- Runner: the digest keeps ~300 chars of the final report, so briefs end with "write the full report to `<scratchpad>/<unit>-report.md`"; the digest also attributes concurrent main-thread edits to the run (check `git diff`); the model silently skips half a brief (2x) and the runner timeout/step cap can end a run unfinished.
- OpenCode runs: harness "low memory" kills hit long backgrounded Bash with 14–18 GiB free; use short foreground launches, separate waiters, detached for >10 min. A blocked out-of-scope attempt (`DENIED`) is logged, not a stop. `runs.jsonl` cost is ≈ 4x too low (cache tokens).
- Integration tests need the test DB and were not run during M3: "vitest green" claims must say whether integration ran.
- Regression tests for timezone behaviour must pin `process.env.TZ` to a zone that differs from the family zone; on the owner's Amsterdam laptop an unpinned test passes without the fix.
- Never run tests in parallel agents on the owner's laptop (load ~30–36): one test run at a time, `--workers=1`.
- Subagent budget: units that combine "run the whole e2e project + fix" blow the 80k budget. Split e2e triage per project or per spec group.
- Reviewers must not checkout/detach in the main checkout (one did, and restored it). The brief must say so explicitly.
- e2e asserts on `/today` are time-of-day sensitive (folded live/past rows). Seed relative to now and use `e2e/utils/timeline.ts` `openFoldedRows`.

## Open follow-ups / Parking

- Server `formatDateTime` (`src/i18n/formatting-locale.ts:64`) still has optional `timeZone`; making it required breaks 6 calls in star-chart, star-week-card, routine-manager, `today-header:143` + its test, each needing an instant-vs-date-key judgement.
- `Europe/Amsterdam` fallback literal repeated in ≥4 places; `DEFAULT_TIMEZONE` exists only in `modules/google/domain/mapping.ts:21`: make it a shared constant. `toWall` in `modules/calendar/domain/zone.ts` is a third hour-in-zone variant.
- `/dev/design` `design-showcase.tsx:174` text "contrast is verified at WCAG AA" is wrong after D32.
- e2e axe spec titles still say "no WCAG AA violations"; `axe.ts` comment "no exclusion list" next to `disableRules`.
- Tests: settings-authorization invalid-timezone test lacks a positive control; `weather_snapshot` fixture uses `payload: {} as never`; google-calendar-picker lacks a non-primary owner case and two texts still mention the owner-only rule; nested-card-borders doesn't test the member `rowDone` tint path; `proxy-auth.test.ts` should reset `seen.request` per case; `page-data.test.ts` has no deny-grade case.
- `no-negative-marking` scanner doesn't cover `modules/today/ui` and `modules/calendar/ui` (theme banner red is decorative; needs allowlist).
- Flaky e2e: `calendar.spec.ts:174`, `invite.spec.ts:154`, `auth-flow.spec.ts:97`; new: `hub/pairing.spec.ts:156` (got `/nl/sign-in?callbackUrl=…` instead of `/nl/pair` after revoke).
- `ci.yml:90` and `e2e/README.md` comments still say "flag"; `new RegExp(E2E_GREP_INVERT)` crashes on invalid regex.
- Hydration warning on `/manage/routines` (`value="false"` input, suspected `Switch`), unverified.
- SW page cache is not cleared when a different member signs in. SW never caches a redirect: offline cold boot on `/nl/hub` gets the browser error page.
- Manifest scope `/nl/` (English households). `kynite.surface` cookie is per browser.
- `requireManager` sign-in callback drops the query string. `x-kynite-path` not stripped in the proxy's share/invite branches (hygiene).
- Phone first-tap loss on /calendar: SSR renders wide (`use-is-wide.ts:46`), phone layout swaps at hydration. 3/36. `openEventDialog` keeps a bounded `toPass`.
- SheetClose `role="link"` not verified in a browser.
