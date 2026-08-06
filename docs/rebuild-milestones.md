# Kynite — Greenfield Rebuild Milestones

**Date:** 2026-08-06
**Branch:** `greenfield`
**Inputs:** `docs/prd.md` (v2) · `docs/architecture.md` · `docs/research/psychology-and-product-principles.md` · `docs/brand-guideline.md` · `docs/design/stitch/stitch_kynite_family_design_system/kynite_design_system_spec.txt`

## Purpose

This is the single source of progress truth for the Kynite greenfield rebuild. Every milestone below is a self-contained, shippable slice with acceptance criteria concrete enough that "done" is not a judgement call: commands that must exit 0, routes and files that must exist, behaviours that must be demonstrable. No milestone is ticked on the author's say-so — each closes with an Opus code review whose verdict is recorded in this file. Read top to bottom; the ordering encodes dependency, not preference.

## Legend

| Marker | Meaning |
|---|---|
| `- [ ] Status` | not started, or in progress |
| `- [x] Status` | complete — review verdict recorded below it |
| `_pending_` | review not yet run |
| `_approved_` | Opus review passed; milestone may be ticked |
| `_changes requested_` | review found blockers; milestone stays unticked until re-reviewed |

## Rules

1. **A milestone is ticked only after an Opus code review verdict is recorded** in its **Review verdict** line. Self-assessment does not close a milestone.
2. **Every milestone ends with a conventional commit on `greenfield`** (`feat:`, `fix:`, `chore:`, …) referencing the milestone id, e.g. `feat(m04): drizzle schema baseline`.
3. **`pnpm typecheck && pnpm lint && pnpm test:run` must pass before each commit.** No exceptions, no `--no-verify`.
4. Acceptance criteria are the contract. If a criterion turns out wrong, amend this file in the same commit that changes the behaviour — never silently drift.
5. Milestones ship in order. Parallel work is allowed only where no dependency exists, and the branch history must still read sequentially.

---

## M01 — Scaffold + CI

- [x] Status
- **Scope:** Create the `greenfield` branch and stand up an empty but fully wired Next.js 16 (App Router, Turbopack, `proxy.ts`) application on Node 24 with pnpm. Configure TypeScript strict mode, Tailwind 4, the shadcn CLI targeting Base UI primitives, Drizzle + drizzle-kit against Postgres, ESLint 10 + Prettier, Vitest 4, Playwright 1.62, husky + lint-staged + commitlint. Add a zod-validated `server/env.ts` that refuses to boot on missing secrets, and a single CI script that runs the full gate.
- **Acceptance criteria:**
  - Branch `greenfield` exists and is checked out; first commit is a conventional commit.
  - `pnpm install --frozen-lockfile` succeeds from a clean checkout.
  - `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm build` each exit 0.
  - `pnpm e2e` runs a smoke spec against a booted dev server and passes.
  - `tsconfig.json` has `"strict": true` and `@/*` → `./src/*`.
  - Files exist: `src/app/[locale]/layout.tsx`, `src/server/env.ts`, `src/server/db/index.ts`, `drizzle.config.ts`, `components.json` (shadcn, `base-nova` preset — shadcn 4.16 removed new-york, Base UI primitives), `eslint.config.*`, `vitest.config.ts`, `playwright.config.ts`, `.husky/pre-commit`, `.husky/commit-msg`, `commitlint.config.*`.
  - `src/server/env.ts` throws at boot when `DATABASE_URL` is unset — covered by a passing Vitest unit test.
  - A commit with a non-conventional message is rejected by commitlint (demonstrable).
  - `pnpm ci` (or documented equivalent) runs typecheck + lint + test:run + build in one command and exits 0.
  - ESLint enforces the module-boundary rule (`no-restricted-imports` banning deep `modules/*/**` imports) with at least one test fixture proving it fires.
- **Review verdict:** _approved_ — Opus review 2026-08-06: all gates verified independently green; one blocker (workflow ran reserved `pnpm ci`) fixed to `pnpm run ci`. Carry-forwards: relative deep-import escape hatch in boundary rule (close by M03), restore dev docker-compose at M04, eager `getEnv()` in instrumentation.ts at M03, jsdom/Testing Library at M02, CI dummy secret → GitHub secret at M03. Update (M06 review): icons now render by codepoint, not by ligature — the subset dropped ligatures for the reasons in `scripts/subset-icons.mjs`, and the subset font is ~23 KB.

## M02 — Design system + theming

- [x] Status
- **Scope:** Implement the Kynite visual language as Tailwind 4 theme tokens and shadcn/Base UI primitives, per `docs/brand-guideline.md` and the Stitch design-system spec. Self-host Lexend (display) and Noto Sans (body) plus Material Symbols Outlined; wire brand primary `#13ec92`, gold `#D4A84B`, the eight category colors, and light/dark theming as CSS variables. Generate the core primitives (button, card, dialog, sheet, avatar, badge, tabs, input, select, toast) with kiosk-grade 48px minimum targets. Ship an internal `/dev/design` demo route rendering every token and primitive in both themes.
- **Acceptance criteria:**
  - `src/app/globals.css` defines the full token set: primary `#13ec92`, gold `#D4A84B`, and the eight category colors (blue, purple, orange, green, red, yellow, pink, teal) with background/border/text variants in both themes.
  - Fonts are self-hosted (no runtime request to `fonts.googleapis.com`); Lexend and Noto Sans render via `next/font`; Material Symbols Outlined available as a component.
  - Typography scale from the brand guideline is expressed as Tailwind utilities/tokens, including a tabular-numerals treatment for `00:00` time displays.
  - Route `/dev/design` exists (non-production-linked), renders all tokens and primitives, and toggles light/dark.
  - Playwright visual-regression snapshots exist for `/dev/design` in light and dark; `pnpm e2e:visual` passes.
  - An axe accessibility check on `/dev/design` reports zero contrast violations at WCAG AA in both themes.
  - Every interactive primitive renders at ≥48×48px in its hub variant — asserted by an automated target-size audit.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved_ — Opus review 2026-08-06: gates + all 10 design e2e specs verified independently; axe zero A/AA violations both themes; contrast token deviations endorsed (brand stays #13ec92 as fill, new --brand-ink/--gold-ink for text). Three requested fixes applied: latin-ext font chain (fallback:[] + explicit chain), Badge hub 32→48px, brand-guideline docs synced. Carry-forwards: subset Material Symbols to ~50KB via build-time Icon-usage scan (hard budget, M06/M07); target-size audit doesn't open dialog/sheet/toast/select overlays; rename Icon data-icon→data-icon-name + wire Material Symbols into primitive icon-padding (M06); add maxDiffPixels cap to visual config; replace waitForTimeout(150) with document.fonts.ready; move /dev production gate into dev/layout.tsx.

## M03 — Auth + family/profiles

- [x] Status
- **Scope:** Wire better-auth (email/password) with the Drizzle adapter, session cookie carrying `activeFamilyId` and `memberId`. Model the `family` and `member` entities including avatar, color, role (`owner`/`adult`/`child`/`caregiver`), `birthDate` and `rewardHorizon`. Build sign-up, sign-in and the first-run family creation flow, plus member CRUD in the parent app. Establish `modules/family/authorize.ts` as the single `can(principal, action, resource)` chokepoint.
- **Acceptance criteria:**
  - Routes exist and function: `(auth)/sign-in`, `(auth)/sign-up`, `api/auth/[...all]`, `(app)/family`.
  - Sign-up creates a `family` + an `owner` `member` in one transaction; the session cookie contains `activeFamilyId` and `memberId`.
  - Children can be created as `member` rows with `userId = null` (no login), each with avatar, color and `rewardHorizon`.
  - `modules/family/authorize.ts` exports `can()`; every Server Action in the codebase calls it as its first statement — enforced by a lint rule or an automated repo-wide test.
  - Unit tests cover the full permission matrix from `docs/architecture.md` §7, including that no principal can remove stars.
  - An unauthenticated request to any `(app)` route redirects to sign-in.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved_ — Opus review 2026-08-06: gates verified independently (134/134 with DB, 18/18 e2e); permission matrix verbatim vs architecture §7; session fixation, open redirect, cross-family forgery, SQL injection all clear. Blocker fixed: AST authorization auditor was blind to arrow/function-expression Server Actions — now audits VariableStatement forms + inline-directive guard, fixture asserts 4 findings. Also fixed: scoped-share fail-open on subjectless resources, avatarUrl constrained to known set, sign-up orphan-account compensating delete, /dev tree production-gated in layout + tmpsc scratch page deleted, revocation-lag comment, architecture ordering doc. Carry-forwards: action-level authorization integration tests (adult calling createMemberAction, forged cross-family memberId) at M04; consider `server-only` package for queries.ts.

## M04 — DB schema + migrations baseline

- [x] Status
- **Scope:** Land the complete Drizzle schema from `docs/architecture.md` §3 as slice-owned `modules/*/schema.ts` files with a single generated migration baseline. Covers devices, google accounts, calendars, events (RRULE/RDATE/EXDATE, `recurrenceParentId`, etag, version, soft delete), routines, routine steps, completions, star ledger, rewards, redemptions, share links, push subscriptions, device sessions and `event_log`. Enforce the hard invariants at the database level, not in application code.
- **Acceptance criteria:**
  - `pnpm db:generate` produces no diff on a clean tree (schema and migrations are in sync).
  - `pnpm db:migrate` applies cleanly to an empty Postgres 17 and is idempotent on re-run.
  - `star_ledger` carries `CHECK (amount > 0)`; an integration test asserts that inserting `amount = 0` or a negative amount raises a DB error.
  - View `member_star_balance` exists and derives balance as earned minus approved-redemption cost; covered by an integration test.
  - `completion` has `unique(memberId, routineStepId, occurrenceDate)` and `unique(clientId)`; a double-insert test proves idempotency.
  - `event` has `index(familyId, startsAt)` and `unique(calendarId, googleEventId)`.
  - Every family-scoped table carries `familyId`; verified by an automated schema assertion test.
  - `event_log` uses `bigserial` primary key with `index(familyId, id)`.
  - Integration tests run against a real Postgres (testcontainer or `pnpm e2e:setup` DB), skipping cleanly when `DATABASE_URL` is absent.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved_ — Opus review 2026-08-06: all ten criteria verified independently (190/190 with DB; migration idempotent on fresh PG 17; view definition, CHECK constraint, uniques/indexes confirmed by live introspection; architecture §3 fidelity table-by-table with only additive deviations). Test quality praised: exemption-list honesty test, non-vacuous cascade seeding, real-action authorization tests (M03 carry-forward closed). Folded in per review preference: google_account unique relaxed to (familyId, googleUserId) + architecture §3 amended + integration test. Carry-forwards: cross-family composite FK integrity (unique member(family_id,id) + composite FKs) is hard prerequisite before any RLS milestone; M05 OAuth "already linked" lookup must scope by activeFamilyId; NULLS DISTINCT on (calendarId, googleEventId) permits local-not-yet-pushed duplicates — M05 push path must handle.

## M05 — Google Calendar sync engine

- [x] Status
- **Scope:** Build `modules/google`: OAuth linking of multiple Google accounts per family with encrypted token storage and single-flight refresh; calendar discovery and per-calendar enablement; incremental sync via `syncToken` with `singleEvents=false`; push channel `events.watch` registration plus the webhook handler; the pg-boss renewal, polling and token-refresh jobs; and the two-way write path with `If-Match` etag and last-write-wins conflict resolution.
- **Acceptance criteria:**
  - Route `api/webhooks/google-calendar` exists, verifies `X-Goog-Channel-Token`, matches `X-Goog-Resource-ID`, enqueues `google:sync-calendar` and returns 200 without syncing inline — the e2e latency guard for this route is **<2000ms on the dev server** (job enqueue, not the optimistic-UI path); the **<100ms** budget is the M10 UI criterion (line below, "completion tap → visual done"), a different measurement entirely and not this route's bar.
  - OAuth flow requests `access_type=offline&prompt=consent` and the calendar read/write scope; tokens are AES-GCM encrypted at rest with a versioned ciphertext prefix.
  - Registered pg-boss jobs: `google:sync-calendar` (singleton per calendarId, 5× backoff), `google:poll` (`*/15 * * * *`), `google:renew-channels` (`*/30 * * * *`), `google:refresh-tokens` (`*/15 * * * *`), `google:push-event`.
  - Vitest fixture suite (no live API) covers: initial full sync, incremental sync-token flow, `410 GONE` → full resync + `sync.status` emission, tombstone deletion, `412 Precondition Failed` → LWW by `updated` with ties to Google, and echo suppression on our own etag.
  - RRULE fidelity tests pass for every custody pattern in `docs/architecture.md` §3: `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO`, 2-2-3 rotation, `FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3`, plus EXDATE + `recurrenceParentId` override round-trip.
  - `invalid_grant` on refresh sets `status = 'reauth_required'` and surfaces in the UI.
  - Manual demonstrable check: linking a real Google account imports its calendars and events; an edit made in Google Calendar appears in Kynite via webhook within the poll interval.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved after fixes_ — Opus review 2026-08-06: gates verified independently (312/312 with DB after fixes, 23 e2e); all eight high-stakes design claims verified (AES-GCM envelope, signed OAuth state, derived HMAC channel token, stately queues, LWW ties-to-Google, claim-before-insert idempotency — several mutation-tested); both M04 carry-forwards closed. Three blockers fixed: enqueue() no longer drops jobs when JOBS_ENABLED=false (flag gates workers only), /settings/google read path + reauth banner authorization-gated (canOwn google:link), two vacuous invariant tests made real (call-log ordering + second-tombstone integration case, mutation-verified). Hardening: transactional publish(), channels.ts test suite + null-expiration renewal fix, HMAC domain separation, 404→409 adopt in pushUpdate, encryption-at-rest integration assertion, explicit-column reauth query, dead exports removed. Architecture doc amended. Carry-forwards: M06 resolves pendingSync representation + wires enqueueEventPush + calendar-timezone fallback; Google actions publish no realtime events (wire by M10); manual real-account link check still to run before M18 deploy (steps in M05 report).

## M06 — Calendar UI

- [x] Status
- **Scope:** Build the calendar surfaces for both the parent app and the hub: day, week, month and agenda/list views (FR3), a per-person column "today" view for the hub board, full event CRUD from the Controller writing through to Google, drag-and-drop rescheduling, and category color coding per the design system. Recurrence expands on read against a cached per-view window.
- **Acceptance criteria:**
  - Routes exist: `(app)/calendar`, `(app)/today`, `(hub)/page.tsx` ambient board.
  - All four layouts (day, week, month, agenda) render and switch without a full reload.
  - The hub "today" view renders one column per member, ordered by `member.sortOrder`, with each member's own color.
  - Creating, editing and deleting an event from the Controller round-trips to the linked Google Calendar and reflects on the hub.
  - Drag-and-drop reschedule updates `startsAt`/`endsAt`, bumps `version`, and pushes to Google; a failed push marks the event `pendingSync` with a non-blocking pip.
  - Recurring series render expanded instances; editing a single instance creates a `recurrenceParentId` child + parent `EXDATE`.
  - Category colors resolve from the eight-color palette; private calendars render busy-only on the hub.
  - Playwright visual snapshots exist for each view at both hub tablet and mobile viewports.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved after fixes_ — Opus review 2026-08-06: gates verified independently (364/364 with DB pre-fix, 380/380 post-fix; 47 e2e); recurrence engine passed reviewer's 13 adversarial RFC-5545 cases incl. canonical WKST fixture; DnD e2e non-vacuous (live DB assertion); busy-only redaction confirmed server-side; icon subset 23KB with type-safe names. Three blockers fixed: push-retry worker now shares pushEventWithRetry (pip clears on successful retry), pendingSync set/clear covered both directions by integration tests with fake-api failure injection, ownerMemberId/attendeeMemberIds family-scope-validated with forged-id integration tests. Also: DST autumn-overlap now resolves pre-transition (matches Google), poll worker re-enqueues pending pushes (cap 50), pushed/skipped discriminated outcome, icons source pinned to SHA, exact-count auditor assertion. Bonus catch: enqueueCalendarSync/enqueueEventPush bypassed queueName() — colon names would make pg-boss throw (swallowed) in production; fixed. Carry-forwards: pull path upsert ignores pendingSyncAt (gate before M10, noted in architecture §5); FUTURE_ANCHOR 2027-03-10 snapshot time bomb; EXTRA_ICONS hand-list for indirect icon usages.

## M07 — Routines/chores

- [x] Status
- **Scope:** Build `modules/routines`: a parent-facing routine builder (title, icon, owner member, schedule RRULE + time of day + grace days, ordered steps with optional timer seconds), and the child-facing hub routine screen with oversized single-tap step completion. Completion feedback leads with specific competence-signalling praise text plus non-strobing confetti; the star lands second. Missed steps render dimmed — never a penalty mark.
- **Acceptance criteria:**
  - Routes exist: `(app)/routines` (builder), `(hub)/routines/[memberId]` (child screen).
  - A parent can create a routine with ≥2 ordered steps, assign an owner member, and set a schedule; steps reorder and persist `sortOrder`.
  - Tapping a step on the hub marks it complete in a single tap, with no confirmation dialog and no spinner.
  - Completion UI renders praise text as the visual headline and the star award as a secondary element — asserted by a visual-regression snapshot and a DOM-order test.
  - No UI surface renders a red X, a negative delta, a "streak lost" state, or any cross-sibling comparison — asserted by an automated repo scan test over routine/reward UI plus a Playwright assertion on the missed-step state.
  - Missed steps render with the dimmed treatment; an absent completion row produces no error state.
  - Confetti presets are non-strobing and intensity-configurable; one module per animation under `components/celebration/`.
  - Unit tests cover step ordering, grace-day logic and occurrence-date derivation in `modules/routines/domain/`.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved after fixes_ — Opus review 2026-08-06: gates verified independently (474/474 with DB, 59 e2e); completion transaction sound (onConflictDoNothing absorbs only PK/uniques, star never double-awarded, fade path proven); psychology sweep independently clean (neutral voice, opacity-60-only missed state, no red confetti); praise DOM-order test real. Blocker fixed: five stale tablet baselines regenerated + visual tolerance tightened (maxDiffPixels 2500→400 — tolerance had swallowed an entire nav item). Also: CI gate job now runs integration tests (postgres service + migrations — proofs previously never ran in CI), midnight-rollover flake frozen, negative-marking scan pin made transitive + variant="destructive" caught, StarPop hydration fix, confetti test seam removed, architecture §2 domain-exemption synced. Notes: completion:write is family-wide per §7 (any member can credit any member) — product decision to revisit before M08 currency; pre-M12 hub carries a parent session (owner-level wall tablet) — M12 exposure; new flake seen once in google-channels integration test (1/476, unreproduced) — watch at M08.

## M08 — Star ledger + rewards

- [x] Status
- **Scope:** Build `modules/rewards` on the append-only ledger: stars awarded on completion and via manual/bonus/surprise parent actions; a per-child reward catalogue defaulting to privilege/experience presets with no money category; redemption requests from the hub with parent approval/denial; savings-goal progress for the `savings` horizon and instant redemption for `instant`; and the per-routine fade/graduation path.
- **Acceptance criteria:**
  - Routes exist: `(app)/rewards` (catalogue + approvals), `(hub)/store`, per-member star chart on the hub.
  - Completing a routine step inserts exactly one `star_ledger` row in the same transaction as the completion; a replayed `clientId` inserts none.
  - No code path anywhere updates or deletes a `star_ledger` row — asserted by an automated repo scan plus the DB `CHECK`.
  - "Stars earned" displayed to a child is monotonic; "stars available" derives from `member_star_balance`; unit tests cover both.
  - `rewardHorizon = 'instant'` (ages ~4–7) renders an icon-heavy, minimal-text instant-redemption UI; `'savings'` (ages ~8–12) renders progress bars and weekly totals. Both covered by visual snapshots.
  - Reward `category` is constrained to `privilege | experience | treat`; a test asserts no money/allowance category exists in schema or seed presets.
  - A denied redemption leaves the balance unchanged and produces no penalty UI — integration test.
  - Flipping `routine.rewardEnabled = false` sets `fadedAt`, stops star awards for that routine only, and renders a graduation badge; other routines are unaffected — integration test.
  - No screen renders more than one child's totals together — Playwright assertion across all reward surfaces.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved after fixes_ — Opus review 2026-08-06: gates verified independently (565/565 with DB after fixes, 82 e2e); migration 0003 (redemption client_id unique + partial unique (member,reward) WHERE requested) proven against live Postgres — denied rows don't block re-request; append-only AST scan and money-framing rule mutation-verified real; psychology sweep independently clean (neutral denial "Not right now"/"Nu even niet", denial never reaches child surface, no sibling comparison, hopeful dimmed state, no currency). Blockers fixed: concurrent-approval double-spend (lock was on redemption row, not member — reproduced earned 10/spent 20/available −10; now member-row FOR UPDATE + race integration test) and vacuous spendsStars-vs-view pin (compared constant to itself; now regex-extracts view where-clause from schema source, mutation-verified). Also fixed: append-only scan extended to drizzle/*.sql migrations incl. drop-constraint, denial vocabulary added to negative-marking wordlist (mutation-verified). Carry-forwards: redemption:request family-wide per §7 — child can drain sibling's balance (worse than completion:write; amend §7 to own-scope before M12); requiresApproval dead column (wire to instant-horizon auto-approve or drop); reward hard-delete un-spends fulfilled redemptions (consider soft-delete); en "Stars to spend" should match nl framing; instant store leads with available not cumulative total (research Decision 2); no praise moment on approval; google-channels flake unreproduced (9 clean runs).

## M09 — Timers

- [x] Status
- **Scope:** Build `modules/timers`: server-authoritative start time with local ticking, visual countdown rendering on the hub sized for 6-foot legibility, and routine transition warnings ("Shoes on in 5 minutes") that fire as neutral board copy. Timers start from a routine step's `timerSeconds` or ad hoc from the Controller, and survive a hub reload.
- **Acceptance criteria:**
  - Route `(hub)/timers` exists; the ambient board renders an active timer without navigation.
  - Timer state persists server-side; reloading the hub mid-countdown resumes at the correct remaining time (±1s) — Playwright test with a frozen clock.
  - Starting or stopping a timer from the Controller reflects on the hub in <2s via realtime (verified in M10; stubbed with polling until then).
  - Transition warnings fire at the configured lead time and use neutral board voice — copy reviewed against FR30, with a test asserting no second-person parental phrasing in timer strings.
  - Countdown digits use tabular numerals at Display M scale or larger; visual snapshot at hub viewport.
  - Timer chime respects the configurable volume/intensity setting and never strobes.
  - Unit tests cover remaining-time derivation, overrun behaviour and clock skew.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved_ — Opus review 2026-08-06: all eight criteria met; server-authoritative timers (start+duration rows, state derived from clock, client offset from server echo) with all four psychology-law guards mutation-verified (FR30 voice scan, legibility pin, non-strobing vs real keyframes, negative-marking on timer UI); gates independently reproduced (623/623 with DB ×2, 7/7 timer e2e incl. hub visual); M09 flake not reproduced in 5 DB runs. Carry-forwards: clientId replay-after-stop returns error not idempotent success (fix before M11 outbox); latent step-timer scope bypass — authorize on input.memberId then overwrite with step.ownerMemberId (close before M12 device/share principals); publish-rollback untested (M10 owns); listRunningTimers unbounded WHERE (add startedAt window); isNonStrobing threshold not pinned to 333ms literal; hub stop tagged source:'mobile' (repo-wide convention); ChimeSettings on ambient board (M12); tautological line countdown.test.ts:50. Note: reviewer accidentally reverted messages/nl+en.json and globals.css during mutation testing, recovered fully — diffs re-verified by orchestrator (key parity 14/14, keyframes intact).

## M10 — Realtime SSE

- [x] Status
- **Scope:** Implement `modules/realtime`: transactional `publish()` writing to `event_log` and issuing `pg_notify` on the per-family channel, a `GET /api/sse` route handler with a dedicated `LISTEN` connection pool, 25s heartbeat and `Last-Event-ID` replay, and a client subscriber that reconciles optimistic state. Retrofit all mutation paths (completions, events, timers, redemptions, sync jobs) onto `publish()`, and land the <100ms optimistic completion flow end to end.
- **Acceptance criteria:**
  - Route `src/app/api/sse/route.ts` exists, responds `text/event-stream` with `Cache-Control: no-store`, `X-Accel-Buffering: no`, and emits a `: ping` comment every 25s.
  - `publish()` inserts into `event_log` and calls `pg_notify` inside the caller's transaction; a rolled-back write emits no notification — integration test.
  - Reconnect with `Last-Event-ID` replays only rows with `id > cursor` in order; a gap exceeding retention or 500 rows emits `{type:"resync"}` — integration tests for both paths.
  - Each SSE stream takes a connection from a dedicated listen pool, is capped at ~20 concurrent streams per family, and releases on `AbortSignal` — test asserts no connection leak after 50 connect/disconnect cycles.
  - The originating device ignores echoes of its own `clientId` — test.
  - Playwright perf guard asserts completion tap → visual done < 100ms and **fails the build** on regression.
  - Playwright two-context test: a Controller change is reflected on the hub in <2s.
  - Offline tap queues to the IndexedDB outbox, the celebration is never rolled back, and the write lands idempotently on reconnect — test.
  - Every `RealtimeEvent.type` in `docs/architecture.md` §4 is published by its owning slice; asserted by an exhaustiveness test.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _approved after fixes_ — Opus review 2026-08-07: all eleven criteria met and independently reproduced (684/684 with DB ×5 zero flake, 96/96 Playwright, build clean with /api/sse dynamic, no drizzle drift); five mutation tests confirmed exhaustiveness scan, transactional rollback, listener-leak guard and <100ms perf guard all non-vacuous (optimism removed → 2174ms vs 100ms budget); cross-family leakage unrepresentable (principal-derived familyId, replay + {ref} read-back family-predicated, neighbour-household test); celebration-never-rolled-back correct against useOptimistic revert semantics (sticky celebrated set); M07 undo correction (undone_at stamp, tick/untick ×4 = one star) proven. Blocker fixed: three new realtime integration suites lacked repo-standard BETTER_AUTH env stubs (DB-only invocation failed 8 tests; now 687/687 with DATABASE_URL alone). Also fixed: heartbeat interval leak on abort-during-replay, parseCursor int8-range check (19-digit cursor no longer errors stream), .catch on {ref} read-back, architecture §4 amended (actor.clientId; per-family-channel LISTEN fan-out, 21st stream 429). Carry-forwards: event_log retention trim job missing (RETENTION_DAYS dead export — wire nightly job); echo suppression tested pure-function only (component test wanted); global unique(client_id) should be (family_id, client_id); undoCompletionAction has no UI caller; timers clientId replay-after-stop still open (M11 outbox); dev-mode "destination stream closed early" noise; M09 realtime-stream flake root-caused (buffer cleared after publish) and fixed — 30+ clean DB runs.

## M11 — PWA/offline + push

- [ ] Status
- **Scope:** Add the Serwist service worker (`src/app/sw.ts`) with scope-aware runtime rules: precache + StaleWhileRevalidate app shell and CacheFirst assets for the hub, NetworkFirst for the parent app. Mirror family state to IndexedDB and boot the hub from IDB before reconciling. Implement VAPID web push end to end: subscription upsert, `push:send` fan-out per endpoint, and reminder routing to the task **owner**.
- **Acceptance criteria:**
  - Files exist: `src/app/sw.ts`, web app manifest; both hub and parent app are installable (Lighthouse PWA installability passes).
  - Hub boots and renders the last-known schedule with the network disabled — Playwright offline test.
  - The offline indicator derives from SSE connection state, not `navigator.onLine` — asserted by a test that fakes `onLine: true` with a dead stream.
  - Route `api/push/subscribe` exists and upserts by `endpoint`; `404`/`410` deletes the subscription; 3 consecutive failures disables it — integration tests.
  - `reminders:scan` (`* * * * *`, 90s look-ahead) and `reminders:dispatch` jobs exist; dispatch routes to `ownerMemberId`, never the creator, with idempotency key `(routineId, occurrenceDate, memberId)` — integration test proving a restart cannot double-notify.
  - Redemption requests fan out to all adults; one `push:send` job per endpoint so a dead device blocks nobody.
  - Push opt-in is never prompted on first load — asserted by a Playwright test on cold entry.
  - Service worker skip-waiting posts `RELOAD_HUB`; the hub reloads only when idle >5 min or nightly — unit test on the reload gate.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M12 — Hub kiosk mode + device pairing

- [ ] Status
- **Scope:** Build the device pairing flow and kiosk session model: a parent generates a 6-digit code (10-min TTL) in settings, `(hub)/pair` exchanges it for a `device` + `device_session`, and the opaque token lives in an httpOnly cookie with a 1-year sliding expiry. Finish the wall-display layout — fullscreen, dark-capable, 6-foot type, no browser chrome — and constrain device-session capability to completions, timers and redemption requests only. Carry-forward note (M06 review): the hub currently renders light-theme only at `(hub)/hub`, with no kiosk layout of its own — it reuses the app shell. M12 owns making it fullscreen, dark-capable, 6-foot type, and (per this scope) the pairing/addressing that puts a real device session behind it.
- **Acceptance criteria:**
  - Routes exist: `(app)/settings/devices`, `(hub)/pair`.
  - A generated code pairs a device, expires after 10 minutes, and is single-use — integration tests for all three.
  - The device session cookie is httpOnly, `SameSite=Lax`, secure, 1-year expiry, and slides on each use — asserted by an integration test on cookie attributes and renewal.
  - A device session can write completions, timers and redemption *requests*, and is rejected for settings, calendar edits, star awards and approvals — one authorization test per denied capability.
  - Revoking a device drops the hub to the pair screen on the next request or SSE tick — Playwright test.
  - The hub layout renders fullscreen with no browser chrome in standalone mode; body text meets the 6-foot legibility scale; all targets ≥48×48px — automated audit.
  - A paired hub survives a browser reload and a simulated multi-day gap with no login screen.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M13 — Caregiver share links

- [ ] Status
- **Scope:** Build `modules/sharing`: 32-byte base64url tokens stored SHA-256 hashed with the raw value shown once (plus QR), resolving to a request-scoped principal with no cookie and no session row. Serve the `(share)/s/[token]` read-only view scoped to a subset of members and calendars, with `viewer` and `contributor` roles, expiry/revocation, and usage telemetry visible to parents.
- **Acceptance criteria:**
  - Route `(share)/s/[token]` exists and renders the consolidated schedule with no account and no session cookie set.
  - Tokens are stored hashed only; a test asserts no raw token is persisted anywhere, and the raw value is unrecoverable after creation.
  - The `(share)` route tree imports zero Server Actions — enforced by a lint rule and a repo-scan test; a proxy rule blocks mutations from this tree.
  - `viewer` links are strictly read-only; `contributor` links may tick completions only for members inside `scope` — integration tests for both, plus a denial test for out-of-scope members.
  - Private calendars render busy-only on share views.
  - Responses carry `noindex` and `Referrer-Policy: no-referrer` — asserted by a header test.
  - Expired and revoked links return a friendly gone state, not a stack trace; `lastUsedAt` and `useCount` update and are visible in `(app)/settings`.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M14 — Second-parent onboarding

- [ ] Status
- **Scope:** Deliver the zero-data-entry second-parent flow (FR26): the owner sends an invite, the invitee opens `(auth)/invite/[token]`, claims an existing unclaimed `member` row by picking an avatar and color, links their own Google account, and immediately sees their calendar merged into the family view. No manual entry is required anywhere in the path.
- **Acceptance criteria:**
  - Route `(auth)/invite/[token]` exists; invites are single-use, expiring and revocable.
  - Accepting an invite attaches a better-auth `user` to an **existing** `member` row (claim, not create) — integration test asserting the member id is unchanged.
  - The flow is exactly three interactions: accept → pick avatar/color → grant Google access. A Playwright test asserts the invitee types no free-text data at any step.
  - Immediately after the flow, the invitee's own Google Calendar events appear merged in the family view — Playwright test with a mocked Google account.
  - The second parent has `adult` role capabilities per the permission matrix (own calendars, own Google links) without owner-only rights.
  - The invite link cannot be replayed after acceptance; a second use returns a friendly already-claimed state.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M15 — i18n nl/en

- [ ] Status
- **Scope:** Complete next-intl coverage across every surface — marketing, auth, parent app, hub, share view, push notification bodies and email — with `nl` as default locale and `en` supported. All hub-facing copy is reviewed against FR30's neutral-board voice rule in both languages.
- **Acceptance criteria:**
  - `messages/nl.json` and `messages/en.json` exist with identical key trees; a test fails on any missing or orphaned key in either file.
  - A repo-scan test fails on hardcoded user-facing strings in `src/app` and `src/modules/*/ui` (allowlist for dev-only routes).
  - Locale-segmented routing works: `/` redirects to `/nl`, `/en/...` renders English; the locale persists across navigation and after sign-in.
  - Push notification bodies and reminder copy are localized per family `locale`.
  - Dates, times and week start render per `family.timezone` and `weekStartsOn` — unit tests including a DST boundary.
  - Hub copy in both locales is neutral-board voice (no "mama says", no imperative attributed to a parent) — asserted by a copy-review checklist test over the hub message namespace.
  - Playwright visual snapshots for the hub board and routine screen in both locales.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M16 — Settings

- [ ] Status
- **Scope:** Build `(app)/settings`: family settings (name, locale, timezone, week start), member management with per-child reward horizon and birth date, per-routine graduation toggles surfaced in one place, notification preferences per adult, hub display preferences (default view, per-calendar color coding and visibility), Google account management, device list and share-link management.
- **Acceptance criteria:**
  - Route `(app)/settings` exists with sections: family, members, routines/graduation, notifications, calendars, devices, share links.
  - Changing a child's `rewardHorizon` immediately switches that child's hub reward UI between instant and savings modes — Playwright test.
  - Per-routine graduation toggles are listed together and flip `rewardEnabled`/`fadedAt` for that routine only.
  - Notification preferences are per adult member and honoured by `reminders:dispatch` — integration test.
  - Hub display preferences (default view, per-calendar color, `visibility: family|private`) persist and take effect on the hub without re-pairing.
  - Owner-only sections (member roles, family deletion) are denied to `adult` principals — authorization tests.
  - Changing `family.locale` or `timezone` re-renders all surfaces correctly without a re-login.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M17 — E2E suite

- [ ] Status
- **Scope:** Consolidate Playwright into a per-surface project suite (`hub` tablet + device session, `app` mobile + account session, `share` no session) covering every critical journey end to end against a seeded test database. Include visual regression, axe accessibility and the completion-tap perf guard as first-class suites rather than incidental tests.
- **Acceptance criteria:**
  - `pnpm e2e:full` (setup → run → teardown) exits 0 from a clean machine.
  - Playwright projects `hub`, `app` and `share` are configured with distinct viewports and storage states.
  - Journey specs exist and pass: sign-up + family creation; second-parent invite claim; routine completion with praise + star; reward request → parent approval; Google Calendar sync smoke (mocked API); hub pairing and revocation; caregiver share-link read-only access; offline hub boot.
  - Visual-regression suite covers hub board, routine card states (todo/done/faded), star chart and the celebration end-frame — deterministic via frozen clock, seeded confetti RNG and animations disabled except the frame under test.
  - Axe suite asserts zero WCAG AA violations on hub, app and share surfaces.
  - Perf guard asserts completion tap → visual done < 100ms and fails the run on regression.
  - Every test seeds its own family via the factory; the suite passes when run with `--repeat-each=2` and in randomized order (no shared-state coupling).
  - Google is the only mocked boundary; no internal module is mocked.
  - Gate green: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_

## M18 — Parity verification + deploy

- [ ] Status
- **Scope:** Author (if not yet present) and then verify `docs/rebuild-parity.md` item by item against the new application, recording pass/fail per line with evidence. Deploy the `greenfield` app to the existing VPS, reusing the current environment and secrets, behind Caddy with SSE-safe proxying, systemd with `Restart=always`, migrations run before the new build starts, and nightly `pg_dump` backups intact.
- **Acceptance criteria:**
  - `docs/rebuild-parity.md` exists and every item carries an explicit verdict (pass / fail / intentionally dropped, with a one-line reason for anything not pass).
  - Zero unresolved `fail` items; any intentional drop is signed off in the parity doc.
  - Release runs end to end on the VPS: `git pull → pnpm install --frozen-lockfile → pnpm drizzle-kit migrate → pnpm build → systemctl reload kynite`.
  - Migrations are backward-compatible with the previously running version (expand/contract) — verified by reloading against the old process still serving.
  - `server/env.ts` validates all required secrets at boot (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `VAPID_PUBLIC/PRIVATE_KEY`, `TOKEN_ENCRYPTION_KEY`); the process refuses to start if any is missing.
  - `GET /api/health` returns HTTP 200 in production and reports DB connectivity plus last successful sync.
  - Production SSE is unbuffered: a live stream on the deployed host delivers events within 2s and receives heartbeats (verified with `curl -N`).
  - A real hub tablet pairs against production and completes a routine step with visible confetti.
  - Nightly `pg_dump` to offsite storage is confirmed running; a restore is smoke-tested once.
  - Gate green on the deployed commit: `pnpm typecheck && pnpm lint && pnpm test:run`.
- **Review verdict:** _pending_
