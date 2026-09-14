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
- **i18n**: `family.members.moveUp`/`moveDown` nl+en.
- **Tests**: unit test for the seam (swap, bounds, foreign member refused, orderedIds mismatch refused); existing family e2e stays green.

## Milestones

- [ ] M1 — seam + action + UI + MCP + migration + i18n + tests (sonnet)
- [ ] R — review (sonnet), fixes, gates (typecheck, lint, format, vitest scoped, e2e family @smoke), merge, deploy

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | ordering scout | sonnet | 30k | 11 | done |
