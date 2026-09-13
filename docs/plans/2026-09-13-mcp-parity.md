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
- [ ] R1 — review M1 (sonnet) → fix → commit
- [ ] M2 — tasks + timers (sonnet)
  - tasks: `list_tasks` (today window + optional date), `get_task`, `toggle_task`, `delete_task`; seams for toggle/delete
  - timers: `list_timers` (running + recent), `start_timer`, `stop_timer`, `pause_timer`, `resume_timer`, `extend_timer`; seam extraction
- [ ] M3 — rewards (sonnet)
  - reads: `list_rewards`, `get_reward`, `list_redemptions`, `get_star_totals`, `list_star_history`
  - writes: `create_reward`, `update_reward`, `delete_reward`, `award_stars`, `request_redemption`, `decide_redemption`, `fulfill_redemption`
- [ ] M4 — family (sonnet)
  - reads: `get_family`, `get_member` (list_members exists; move under family scope, keep old any-of fallback)
  - writes: `create_member`, `update_member`, `delete_member`, `update_family`
- [ ] R2 — review M2–M4 together (sonnet) → fix → commit
- [ ] Docs: CLAUDE.md MCP section (tool list, tools/ layout), `scripts/mcp-smoke.mjs` untouched

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

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| inv | inventory | sonnet | 52k | 13 | done |
| m1 | M1 plumbing+routines | opus | 127k | 41 | done (resumed for R1 fix) |
| r1 | R1 review M1 | sonnet | 83k | 29 | done — 1🔴 list_calendars dropped |
