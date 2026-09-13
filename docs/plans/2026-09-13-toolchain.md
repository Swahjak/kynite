# Toolchain: oxlint, TypeScript 7, dependency lift, oxfmt — tracking

Branch `chore/toolchain`. Budget: 4 builders + 1 reviewer (user "go", 2026-09-13).
Gates never run concurrently (shared CPU). Each step = own commit(s) on the branch.

## Steps

- [x] S1 — eslint → oxlint (sonnet). Both workspaces, lint-staged, CI. Port `no-restricted-imports`
      module/package-boundary patterns (incl. `!` negations), react-hooks, next core-web-vitals.
      Drop eslint-plugin-storybook. `pnpm lint` must be fast and not OOM.
      - oxlint 1.82.0. `.oxlintrc.json` per workspace; `no-restricted-imports` `group`/`!`-negation
        and `regex` all work, verified with real fixtures.
      - **Gap found and fixed**: oxlint's glob matcher is literal-per-segment, not ESLint's
        `ignore`-package gitignore semantics (banning a directory does *not* implicitly ban its
        whole subtree). The original `@/modules/*/*` pattern would have silently stopped catching
        3+-segment deep imports (e.g. `@/modules/rewards/domain/award`) — fixed by using `**` after
        the slice segment everywhere the eslint config relied on that recursion (module boundary,
        schema boundary, domain boundary rules). Verified with `ignore` package directly + oxlint
        CLI against fixtures both before and after the fix.
      - jsx-a11y: oxlint's `correctness` category is broader than the 6 warns
        `eslint-config-next/core-web-vitals` actually enables (checked its compiled dist). Disabled
        7 rules that surfaced ~43 pre-existing findings (role="group"/"status"/"img", unlabelled
        controls, `autoFocus`) — real but design-review-sized, out of scope for a lint swap.
      - `packages/ui`: disabled `react/no-unstable-nested-components` (1 real finding,
        `src/components/calendar.tsx:80`, non-trivial fix) and `react/react-in-jsx-scope` (not
        applicable, React 19 JSX transform).
      - `tests/unit/module-boundaries.test.ts` used ESLint's `ESLint.lintText` API, which oxlint has
        no equivalent for (its JS package only exports a `defineConfig` helper, no programmatic
        linter). Rewritten to shell out to the oxlint CLI (`-f json`) against real temp probe files
        (oxlint has no virtual-path/stdin option), with cleanup in `finally`/`afterEach`. All 11
        cases pass, including the new 3-segment-deep-import case.
      - `pnpm lint` (both workspaces): ~1s, was OOMing before. `pnpm typecheck`: unaffected, ~2s.
      - Pre-existing, unrelated failure on this branch (predates S1, from `96067b9`/`6922407`):
        `tests/unit/i18n/hardcoded-strings.test.ts` flags un-i18n'd MCP tool `description` strings.
        Left alone — out of scope for a lint-tooling swap.
- [ ] S2 — TypeScript 7 plain (sonnet). Remove `typescript-native` alias + TS6 shim, `typescript@7`.
      AST tests → explicit `@typescript/typescript6` devDep (or oxc-parser). Verify Next 16.3.1 with
      native tsc; drop `experimental.useTypeScriptCli: false` if it works. Update CLAUDE.md TS notes.
- [ ] S3 — dependency lift (sonnet). `pnpm up --latest -r`, one commit per major family
      (next/react, drizzle, better-auth + plugins, zod, tailwind, vitest/playwright, rest).
      better-auth: run `scripts/mcp-smoke.mjs` + DCR curl. Playwright: only `--grep @smoke --workers=1`.
- [ ] S4 — prettier → oxfmt (sonnet). Same options; one reformat commit; keep prettier only for
      extensions oxfmt can't format (check md/css/yml/json). lint-staged + CI updated.
- [ ] R — review S1–S4 diff (sonnet) → fix → merge to main → deploy.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
