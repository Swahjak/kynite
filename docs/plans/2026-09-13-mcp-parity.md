# MCP parity with app surface — tracking

Goal: `/api/mcp` exposes the same domain surface the app UI does (routines, tasks, rewards/store, family, timers), per-domain read/write scopes.

Decisions (2026-09-13):

- Scopes per domain: `kynite:<domain>.read` / `.write` (routines, rewards, family, timers; calendar + tasks exist). Declared in BOTH `src/server/auth.ts` (`MCP_SCOPES`) and `src/server/mcp-auth.ts`.
- Write seams take a `Principal` and call `can()` themselves; `actions.ts` become thin wrappers over the seam (pattern: `modules/tasks/write.ts`). MCP never imports `actions.ts`.
- Tool files split per domain: `src/app/api/mcp/tools/<domain>.ts` exporting `register<Domain>Tools(server, principal, scopes)`; `route.ts` only wires them. Shared helpers (`ok`, `toolError`) move to `src/app/api/mcp/tools/shared.ts`.
- Out of scope: google (sync internals), sharing/devices/notifications/oauth-consent (admin plumbing), auth actions (sign-in/up, invites accept), `today` (composition — its writes go through routines).
- Subagent budget cap: 8 (user). Per-agent log below.

## Milestones

- [x] M1 — plumbing + routines (opus, pattern-setting)
  - [x] scopes for all four new domains in both files; tools/ split; `shared.ts`
  - [x] routines: extract `modules/routines/write.ts` seams from actions; tools `list_routines`, `get_routine`, `create_routine`, `update_routine`, `delete_routine`, `set_routine_active`, `set_routine_reward`, `complete_step`, `undo_completion`
  - [x] unit tests for each tool handler (mocked seams) in `tests/unit/mcp/routines.test.ts`
- [x] R1 — review M1 (sonnet) → fix → commit `3380021`
- [x] M2 — tasks + timers (sonnet)
  - [x] tasks: `list_tasks` (today window + optional date), `get_task`, `toggle_task`, `delete_task`; seams for toggle/delete
  - [x] timers: `list_timers` (running + recent), `start_timer`, `stop_timer`, `pause_timer`, `resume_timer`, `extend_timer`; seam extraction
- [x] M3 — rewards (sonnet)
  - reads: `list_rewards`, `get_reward`, `list_redemptions`, `get_star_totals`, `list_star_history`
  - writes: `create_reward`, `update_reward`, `delete_reward`, `award_stars`, `request_redemption`, `decide_redemption`, `fulfill_redemption`
- [x] M4 — family (sonnet)
  - reads: `get_family`, `get_member` (list_members exists; move under family scope, keep old any-of fallback)
  - writes: `create_member`, `update_member`, `delete_member`, `update_family`
- [x] R2 — review M2–M4 together (sonnet) → 0 findings → commit
- [x] Docs: CLAUDE.md MCP section (tool list, tools/ layout), `scripts/mcp-smoke.mjs` untouched

## M1 notes (deviations from the Decisions)

- **Consent labels came along.** The Decisions only name `auth.ts` + `mcp-auth.ts`;
  `modules/oauth-consent/page-data.ts` keeps a third, deliberately independent copy
  (scope → message key), so all eight new scopes were added there and to
  `messages/{nl,en}.json` `oauth.scopes` as well, or the consent screen would render
  `oauth.unknownScope` for every new grant.
- **`list_members` is now any-of `family.read | calendar.read | tasks.read`** rather
  than the old calendar/tasks pair — M4's "keep old any-of fallback", pulled forward
  because the tool moved into `tools/family.ts` in this milestone anyway. No existing
  token loses access.
- **`completeStep` is a re-export of `recordCompletion`,** not a new wrapper: that
  function already *was* the principal-taking seam (M13, for the share link) and
  already checks `can('completion:write', { memberId })` against the subject member.
  A forwarding function would only be a second place for the two to drift.
- **Seam results carry `memberIds`.** `tasks/write.ts` returns just `{ ok, taskId }`,
  but the routines actions have to revalidate the boards that changed (including the
  *previous* owner on a re-assignment), and `next/cache` may not enter the seam — so
  `RoutineWriteResult` names the members and `actions.ts` revalidates them.
- **`routineSchema` moved into `write.ts`** (with `scheduleOf`/`resolveInput`);
  `actions.ts` now only turns `FormData` into the plain object the seam validates.
- **Gate note:** root `pnpm lint` OOMs on this machine (`[warn] Linter process
  terminated abnormally`) even at 6 GB heap; `pnpm exec eslint .` in each workspace
  passes clean. Pre-existing, not caused by M1.

## M2 notes (deviations from the Decisions)

- **No separate `task:complete`/`timer:control`-vs-write scope split.** The
  Decisions define one scope pair per domain (`kynite:tasks.read/.write`,
  `kynite:timers.read/.write`); `toggle_task` therefore gates on
  `MCP_TASKS_WRITE` at the token layer even though the `can()` check inside
  is `task:complete` (a broader grade — child/device `allow`). Same shape as
  M1's `complete_step`/`undo_completion` gating on `MCP_ROUTINES_WRITE` while
  checking `completion:write` underneath — one write scope per domain, the
  `can()` matrix is what actually narrows.
- **`list_tasks` reuses `listTodayTasks` rather than a new query,** per the
  brief. `date` overrides both the `todayKey` and the `since` anchor (a
  `2026-01-01T12:00:00Z` instant, so `startOfDay` in the family's zone lands
  on the right wall day regardless of DST); `memberId` filters in the tool
  layer after the fetch, since the query has no such parameter and one row
  set is cheap to filter for a household-sized list.
- **Timers seam results reuse the existing `action-state.ts` types**
  (`StartTimerState`, `StopTimerState`, …) rather than a new `{ok, ...}`
  shape — that module already carries the richer vocabulary these writes
  need (`replayed`, `atMaximum`), and `modules/routines/write.ts#undoCompletion`
  already set the precedent of a seam returning its slice's own status-shaped
  result instead of the generic `{ok:true}|{ok:false}` pair.
- **`actions.ts`'s revalidation stayed unconditional** (`await
  revalidateTimers()` after every seam call, regardless of the result), to
  match the pre-refactor behaviour exactly rather than only revalidating on a
  successful status — the original code revalidated even when the seam's own
  transaction returned a business error (e.g. `alreadyRunning`), only
  skipping it on an early `assertCan`/validation failure that never reached
  the transaction. Collapsing that distinction costs one redundant
  `revalidatePath` call on a handful of error paths, never a behaviour change
  a caller could observe.
- **`list_timers`/`get_timer` responses omit `clientId` and `startedByMemberId`**
  (idempotency plumbing and an internal actor id) alongside `familyId`,
  matching `list_routines`' internal-column redaction.

## M3 notes (deviations from the Decisions)

- **`get_star_totals`'s "whole family when omitted" reuses `listStarTotals`**
  (a `Map<memberId, StarTotals>`), serialized as a plain object
  (`Object.fromEntries`) since MCP tool payloads are JSON — same shape
  decision as everywhere else in this route (no `Map`/`Set` crosses the tool
  boundary).
- **`list_redemptions`' `status` filter is an array** (`REDEMPTION_STATUSES[]`),
  matching `listRedemptions`' own `statuses` option, rather than a single
  enum — an MCP client asking for "everything decided" needs
  `['denied','fulfilled']` in one call, same as `loadRewardsPage` already does
  server-side.
- **`seedRewardPresetsAction` has no tool**, per the brief — it is UI-only
  onboarding (preset titles arrive pre-translated from the client) and
  `write.ts`'s doc comment states why it stays unextracted.
- **Gate note:** `pnpm exec prettier --check`/`--write` invoked directly (not
  via `pnpm format:check`) silently returns a canned
  "Prettier: All files formatted correctly" with exit 1 on this machine —
  an RTK (Rust Token Killer) hook intercepting the bare command. `rtk proxy
  pnpm exec prettier …` bypasses the interception and shows the real
  per-file diagnostics; that surfaced 3 files genuinely needing
  `--write` (trivial wrapping), now fixed.

## M4 notes (deviations from the Decisions)

- **`get_family`/`get_member` read straight off `getFamily`/`getMember`**
  (`modules/family/queries.ts`), which already existed — no new query needed.
- **`create_member`'s tool schema accepts `role: owner`** (the full
  `MEMBER_ROLES` enum) rather than a filtered enum, and relies on the seam's
  own `singleOwner` refusal — same defence-in-depth `update_member` already
  needs for the role-immutability check, so the tool layer doesn't duplicate
  a business rule the seam enforces anyway.
- **No separate "can't delete self" guard was added.** `member:manage` is
  `deny` for every column but `owner` (§7's matrix), and the owner row can
  never be deleted (`cannotRemoveOwner`) — so an owner can't reach their own
  row through `delete_member` either, without a second guard. This was
  verified against the matrix rather than added as a new check.
- **`updateFamilyAction`/`createMemberAction`/`updateMemberAction`/
  `deleteMemberAction` kept their pre-existing `memberInput()`/`assertCan()`
  double-validation shape** (parse once in `actions.ts` for the early
  `invalidInput` return, parse again inside the seam) rather than switching
  to rewards'/timers' "build a plain object, let the seam validate" pattern —
  minimizes the diff against working code; the seam is still the sole source
  of truth for the validation rules themselves (schemas moved to
  `write.ts`, not duplicated).
- **Gate note:** none beyond the established ones — `pnpm exec eslint` flagged
  two now-dead imports (`locales`, `FORMATTING_LOCALES`) left in `actions.ts`
  after their schemas moved to `write.ts`; removed. `rtk proxy … prettier
  --write` reflowed two long lines in `write.ts`. Root `CLAUDE.md` already
  fails `prettier --check` before this change (pre-existing, verified via
  `git stash`) — not touched further.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| inv | inventory | sonnet | 52k | 13 | done |
| m1 | M1 plumbing+routines | opus | 127k | 41 | done (resumed for R1 fix) |
| r1 | R1 review M1 | sonnet | 83k | 29 | done — 1🔴 list_calendars dropped |
| m2 | M2 tasks+timers | sonnet | 188k | 69 | done |
| m3 | M3 rewards | sonnet | 166k | 42 | done |
| m4 | M4 family + docs | sonnet | 199k | 104 | done |
| r2 | R2 review M2–M4 | sonnet | 109k | 29 | done — 0 findings |
