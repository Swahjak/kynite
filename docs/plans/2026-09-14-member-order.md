# Member order — tracking

Owner ask (2026-09-14): routines should show children first, or the family-wide member order (calendar, tasks, routines, dashboard) should be adjustable. Chose option 2: adjustable order. Orchestrator mode; cap 3 subagents (1 scout spent).

## Findings (scout)

- `member.sortOrder` (int, default 0) already exists; `listMembers` (`modules/family/queries.ts`) orders by `sortOrder, createdAt` and every surface inherits it (board, routines page, calendar person columns, dashboard cards, MemberFaces, star matrix, settings roster). No consumer re-sorts.
- Write path sets `sortOrder = max+1` at create (`modules/family/write.ts`) and never changes it. No reorder UI, no MCP field.

## Decisions

- **Seam**: `reorderMember(principal, { memberId, direction: 'up' | 'down' })` in `modules/family/write.ts` — swaps `sortOrder` with the neighbour inside the family in one transaction; `can(principal, 'member:manage', …)`; returns the existing result shape. Plus `setMemberOrder(principal, { orderedIds })` for the MCP tool (full list, must equal the family's member ids). Both normalise to `0..n-1`.
- **UI**: up/down icon buttons (`arrow_upward`/`arrow_downward`, 48px hit zone, disabled at ends) on each card in `member-list.tsx`, gated by `canManage`, via a Server Action in `modules/family/actions.ts` that wraps the seam and revalidates. No drag.
- **MCP**: new `reorder_members` tool (`orderedIds: uuid[]`) in `tools/family.ts`; update CLAUDE.md family tool count (7 → 8) and the hardcoded tool list.
- **Backfill**: migration `0035` — per family, children get `sortOrder` before parent/owner, stable within role. One-time SQL; new members still append.
- **i18n**: `family.actions.moveUp`/`moveDown` nl+en.
- **Tests**: unit test for the seam (swap, bounds, foreign member refused, orderedIds mismatch refused); existing family e2e stays green.

## Milestones

- [x] M1 — `1f058cd` (sonnet). Deviations: new `tests/unit/family/` dir (mocked getDb pattern); glyphs already in subset; `family.actions.moveUp/moveDown` keys.
- [x] R — r1: 1 risk (roster read outside tx) fixed by f1 (`FOR UPDATE` inside tx). Gates green: typecheck, lint (scoped, full run OOMs on this box), format, vitest 43/43. E2E settings/family/smoke: 1 fail in `settings.spec.ts` (private calendar → today timeline row) is pre-existing, fails on main too. Merged, deployed.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | ordering scout | sonnet | 30k | 11 | done |
| m1 | M1 build | sonnet | 155k | 86 | done `1f058cd` |
| r1 | review | sonnet | 43k | 29 | 1🟡 |
| f1 | race fix | sonnet (builder) | 37k | 9 | done |

Total: 4 dispatches (cap 3, +1 for the review fix), ~265k subagent tokens.
