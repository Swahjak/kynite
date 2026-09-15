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
- D6 (owner, 2026-09-15 ~11:45): now that agy answers again, code units are limited to flash models: U3, U4 and every fix loop go to `agy-delegate --tier flash`. The Claude-builder detour (b1, b1b, b2) was the quota workaround only; b2 finishes because it was already running. Reviews stay on sonnet.
- Layout values from the mockups win over current code (radii 16/8, ring 3px at 32–36px, 64px rows, 46px circle).

## Milestones

Branch `feat/design-drift-m1`. Each unit = one `agy-delegate --tier flash --yolo --dir /var/www/personal/kynite --timeout 20m` run with `AGENTS.md` (repo root, executor rules) + this file as the brief; reviewer = Claude subagent (sonnet) on the diff; gates rerun by main thread.

- [x] **U1 — package primitives** (`8d12487`, follow-up commit below; new `memberClasses` keys `tileSoft`/`checkDone` still to add to both `MEMBER_COLOR_CLASSES` maps in U2, plus `doneLabel` via next-intl) (`packages/ui`). Tokens first: add `--member-<slot>-hue` (335/245/196/312/90/30) to `tokens.css` light + dark and derive the extra steps the routines mockups use from it — `tegel` `oklch(95% 0.03 h)`, `tegel-zacht` `oklch(97% 0.015 h)`, `tegel-klaar` `oklch(95% 0.03 h)`, `rij-klaar` `oklch(97% 0.02 h)`, `inkt-tegel` `oklch(45% 0.1 h)`, `inkt-klaar` `oklch(62% 0.06 h)`, `nu-baan` `oklch(93% 0.05 h)`, `nu-inkt` `oklch(38% 0.1 h)`, `nu-lijn` `oklch(86% 0.06 h)`; dark theme re-tuned the way the existing four steps are. Extend `MEMBER_COLOR_CLASSES` (`apps/web/src/modules/family/ui/tokens.ts`, and the deliberate duplicate in `modules/calendar/ui/tokens.ts`) with class names for them. `StepRow` (both variants): the whole row is one `<button>` (min 64px, padding 9px 12px, radius 8, gap 12), circle 46px decorative `aria-hidden` (white + 3px `#dcdad4` border; done: member lijn fill, white 30px filled check with `kyn-pop`), icon tile 38px radius 8 in `tegel-zacht` (done `tegel-klaar`), icon 22px `inkt-tegel` (done `inkt-klaar`), title 18px/600 (done `#8a8c98` strikethrough), done row background `rij-klaar`; member colour arrives as a `memberClasses` prop of class strings (structural, no import from the app). `RoutineCard`: radius 16, padding 16, tile 52px `tegel` + icon 28px, NU badge `nu-baan`/`nu-inkt`, NU card border `nu-lijn`, KLAAR pill `#eceae4`/`#5f6274`, done tile icon `inkt-klaar`; drop every orange/green state variant that no mockup shows. `ProgressBar`: `trackClassName` (member baan) + `fillClassName` (member lijn), remove the orange 100% variant. Stories updated for each variant; vitest for the row-is-the-button semantics (no nested interactive, `aria-pressed`/`aria-checked` preserved).
- [x] **U2 — routines surfaces** (`2a19c37`) (`apps/web/src/modules/today/ui/routines-board.tsx`, `modules/routines/ui/*`, `(hub)/routines/[memberId]`): pass member classes into U1 components; column head 3px member lijn bottom line (exists on taken, verify) + 40px ring 3px; routine progress card wassing + lijn bar; remove orange gradient/ring/head on 100% (keep the small "Alles gedaan · +N sterren" chip); task rows whole-row tap; solo page same. `MemberFilter` selection ring indigo 2px, unselected opacity 0.45.
- [x] **U3 — Vandaag hub** (`0a3c36d`; U3-rest parked: filter beside the clock + voorbij toggle in the card header) (`modules/today/ui/*`): timeline row 4px line = owner member lijn (two owners: 180° split gradient, no owner: `#b6b3ab`), category colour moves to the icon tile only, rail dots 10px member lijn, NU row `rgba(93,95,239,0.07)` indigo; kid cards: face ring 3px + member baan progress track; avatar filter moves from the card header to beside the clock (36px faces, `Iedereen` pill), "voorbij" toggle takes its place in the card header; FAB 64px indigo with 4 pills; radii 16/8 via tokens; delete `today-tabs.tsx`, `today-tab-personen.tsx`, `today-tab-sterren.tsx` if unreferenced (verify `(app)/today` first).
- [x] **U4 — Kalender + Beloningen hub** (`5e4c08d`; day-agenda rows keep the category dot, no owner colour in that component) (`modules/calendar/ui/*`, `modules/rewards|store ui`): agenda/event rows `border-left:3px` member lijn (category on the tile), column heads `border-bottom:3px` member lijn, face-row rings 3px, remove the oversized indigo-ringed face row, filter selection ring indigo; store/rewards avatar chips wassing `95% 0.025` + 3px ring, selected chip indigo border. Radii 8 on tiles/rail where the mockup changed them.
- D8 (owner, 2026-09-15 12:30, "waarom geen subagents om de agy agents uit te zetten"): agy chains are driven by a sonnet dispatcher subagent (map + prompts + run + verify + oxlint), the main thread only dispatches, reviews, gates and commits. Memory: agy-dispatcher-subagent.
- D7 (owner, 2026-09-15 11:58, "laten we dat eens proberen"): agy flash gets **micro-units** only: one file, 1–3 edits, file:line + current snippet + target snippet in the prompt, an explicit ban on viewing any other file, no gates inside the run (orchestrator runs oxlint/typecheck once per batch). A sonnet investigator maps the edit sites first; the micro-units run serially in one background chain, cost logged per run.
- R1 test policy (owner, 2026-09-15 11:45: "manage the time, be critical about which tests run"): one `pnpm typecheck` after U3/U4; oxlint on changed files only; vitest only `tests/unit/{routines,today,calendar,rewards}` + `tests/unit/i18n/hardcoded-strings`; Playwright hub project only, `@visual` straight to `--update-snapshots` (the colours change by design, a failing first run proves nothing) then spot-check the PNGs; `@smoke` hub + routines specs; kiosk/axe only the specs covering routines/taken/hub. No @heavy, no perf, no app project, no full vitest.
- [x] **R1 — review + gates + baselines** (done 12:42; see R1 run 3) (main thread + reviewer agents): per-unit sonnet review, fix loops back to agy (flash, `--continue` only after quota/timeout), `pnpm typecheck`, scoped oxlint, vitest, then Playwright `@visual` hub project `--workers=1` with the `.env.local` move/restore rule; regenerate hub baselines; kiosk audit (48px floors) green; axe on routines/taken/hub. Merge, `railway up`.
- [ ] **M3 — hub = app (D2-A)**: separate plan `docs/plans/<date>-hub-equals-app.md`, own cap; includes the "management" page idea and the `CLAUDE.md` stale reference.

### Cap (D3, approved 2026-09-15)

M1 (U1–U4 + R1): 6 agy runs (4 units + 2 retries), 4 Claude review agents (sonnet), plus the 1 scout already spent. Escalate a unit to a Claude builder only when flash fails twice on it. Fix loops after review also go to agy (counted in the 2 retries; above that, ask).

Lessons (12:20): flash **High** thinks ~40k tokens for a 3-line edit (4m40, $0.30); flash **Low** does the same class of edit in 5–60 s for $0.02–0.12. Micro-units need a file:line map first, which costs a sonnet investigator plus orchestrator prompt-writing — net Claude saving vs a sonnet builder is modest (≈213k vs ≈350k sonnet for U3+U4) and main-thread turns go up. `tests/unit/i18n/hardcoded-strings` fails on this branch with 43 hits, all in `src/app/api/mcp/tools/*.ts` — pre-existing, not from M1.

R1 run 1 (12:19–12:24, hub project, a11y/kiosk selection): 20 passed, 2 failed. (1) kiosk-audit kalender: filter button 32×32 after m07 shrank the face — fixed by m14 (`size-12` hit target around the 32px face). (2) axe store: 4 colour-contrast hits, all in `reward-card.tsx` (`opacity-60` locked tile, `label-overline`) and a `.px-3.5` element — pre-existing, not touched by M1, logged not fixed. The snapshot-update commands were malformed (`--update-snapshots <file>` parsed the file as the mode); rerun as `-u` after the state lift lands.

R1 run 2 (12:47): kiosk-audit kalender + axe hub board green after m14 and the state lift (5 passed). Visual baselines: `-u <file>` parses the file as the mode; use `--update-snapshots=all` before the spec paths (run 3).

R1 run 3 (12:28–12:39, `--update-snapshots=all`): hub visual 38 passed / 2 failed, app routines visual 5 passed; 32 baselines regenerated and spot-checked (hub board rails, kalender column heads, routines board, store ring). The 2 failures are `calendar.spec.ts:278 hub agenda board` (tablet + mobile): the spec still asserts `pill-tab-dag`, but the hub page dropped the board tab pills on 2026-09-03 (`b4ce25c`, rail destinations) — pre-existing test rot, not M1; its `hub-agenda-*` baselines are therefore stale. Logged for M3 together with `hardcoded-strings` (43 MCP-tool hits) and the 4 axe contrast hits in `reward-card.tsx`. Hub `/hub/kalender` shows the member faces twice (header `FaceStack` + `CalendarShell` filter row) — pre-existing layout, candidate for the M3 header merge.

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
| b1 | U1 primitives | sonnet (builder) | 169k | 74 | done (over budget 120k/50); gates green in main thread; left out: tile variant restyle, KLAAR pill, RoutineCard→StepRow memberClasses forwarding, 52px tile/28px icon, 12px row padding |
| r1 | U1 review | sonnet (cavecrew-reviewer) | 51k | 11 | done: 0 blocking, 1 question (memberClasses forwarding, deferred to b1b) |
| b1b | U1 leftovers (tile variant, KLAAR pill, forwarding, sizes, padding) | sonnet (builder) | 150k | 67 | done (retry 1 of 2 spent); gates green in main thread |
| b2 | U2 routines surfaces | sonnet (builder) | 147k | 65 | done, committed `2a19c37` (review batched with U3/U4) |
| agy-u3 | U3 Vandaag hub | gemini 3.8 flash-high | 506k in / 21k out / 1.87M cache ≈ $0.60 | 191 steps | failed: 47 view_file + 49 run_command, 0 writes, 3 context truncations (re-read loop), 4 stream interruptions, ended 429 `RESOURCE_EXHAUSTED` |
| agy-u4 | U4 Kalender + Beloningen | gemini 3.8 flash-high | 792k in / 68k out / 7.81M cache ≈ $1.43 | 84+ steps | failed: same read loop, 0 writes, ended 429 |
| i3 | U3 edit-site map (file:line) | sonnet (cavecrew-investigator) | 39k | 21 | done |
| i4 | U4 edit-site map (file:line) + follow-up | sonnet (cavecrew-investigator) | 117k | 37 | done |
| agy-m01 | tokens.css timeline-line-muted | 3.8 flash-high | 111k in / 42k out (39k thinking) / 809k cache ≈ $0.30 | 3 steps, 4m40 | ok |
| agy-m02…m10 | event-row railStyle, timeline rail, FAB, kid card, column head, calendar filter, store chip, event-chip rails+radii, radii | 3.8 flash-low, serial | 340k in / 30k out / 874k cache ≈ $0.43 total | 4m36 for 9 units | all ok (m08 left the store page for a follow-up) |
| i5 | state-lift map (Vandaag header) | sonnet (cavecrew-investigator) | 40k | 18 | done |
| d1 | U3-rest dispatcher: maps + writes prompts + runs the flash-lo chain | sonnet (general-purpose) | 131k | 67 | done; 8 agy runs all verbatim, agy total 190k in / 10k out / 240k cache ≈ $0.20; two <5-line hand fixes (barrel export, `avatarUrl ?? null`) |
| agy-lift-09/10 | opacity-80 floor, headerEnd gate | 3.8 flash-low | 46k in / 0.8k out / 33k cache ≈ $0.04 | 2 runs | ok; committed `2da9f9e` |
| r-lift | review state lift | sonnet (cavecrew-reviewer) | 45k | 8 | done: 2 bugs (opacity-45 fails axe AA → back to 80; past toggle shown while filtered) → d1 fix loop |
| agy-m14 | calendar filter button 48px hit target | 3.8 flash-low | 19k in / 0.9k out / 22k cache ≈ $0.02 | 1 run | ok |
| r234 | review U2 commit + U3/U4 diff | sonnet (cavecrew-reviewer) | 57k | 27 | done: 1 risk (FAB lost its 56/64 step), 1 nit (stale comment) |
| agy-m11…m13 | fixes: FAB `size-14 sm:size-16`, comment, store chip ringClass | 3.8 flash-low | 82k in / 2k out / 143k cache ≈ $0.07 | 34 s | ok |

U3/U4 scope notes from i3/i4: NU row already `bg-primary/7`; the timeline rail has no dots (bar only, kept); `today-tabs*` are used by `(app)/today`, kept; `day-agenda-row` has no owner colour available (category dot stays); the avatar-filter-beside-the-clock and the "voorbij"-toggle-in-the-card-header moves need lifted state across 3–4 files — **parked as U3-rest**, not a micro-unit.
| r1b | U1 leftovers review | sonnet (cavecrew-reviewer) | 39k | 7 | done: 2 risk + 1 question, all "unconditional new look for unmigrated callers"; accepted per D4, U2 migrates every call site |

agy cost on a pay-as-you-go key (3.8 Flash promo $0.75/$3.75/$0.075 per 1M in/out/cached; lower bound, cache storage not reported): agy-0 $0.06, agy-u1 $1.71, agy-u1b $0.70, total ≈ $2.50 (≈ $5 at the post-2026 rate).

Update (2026-09-15 ~11:40): agy answers again on `flash-lo` and `flash` (two pings, 11.8k in each, `SUCCESS`); the quota reset early. U2 stays on the running sonnet builder; executor for U3/U4 is the owner's call.

Blocker (2026-09-15 10:45): the agy account's weekly quota is exhausted on every Gemini model (3.8/3.7/3.6 flash, 3.1 pro all 429, reset ≈2026-09-22). Two U1 runs burned ~2.4M input + ~5M cache_read on reading and 503 retries without a single file write. Options: (a) wait for the reset, (b) run U1–U4 on Claude subagents (sonnet builders) under the same cap, (c) upgrade the Antigravity plan. Owner (2026-09-15): **(b)**, and keep the token volume down — one sonnet builder per unit, explicit read lists, no mockup reads, ≤120k tokens / ≤50 tool calls per agent, digest-only replies; reviews via cavecrew-reviewer.
