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
        Also `tests/unit/utils.test.ts` (`display-3xl` token drift) and
        `tests/unit/oauth-consent/scope-message-key.test.ts` (next-intl module resolution).
        Left alone — out of scope for a lint-tooling swap; fix in R.
- [x] S2 — TypeScript 7 plain (sonnet). Both workspaces: dropped `typescript-native`, `typescript`
      is now plain `^7.0.2`. Confirmed TS 7.0.2's npm package still has no JS compiler API (`ts.createSourceFile`
      is `undefined`), as expected.
      - Found 5 AST-walking test consumers, not the 2 named in the brief — grep also caught
        `tests/unit/i18n/hardcoded-strings.test.ts`, `tests/unit/realtime/event-coverage.test.ts`,
        `tests/unit/append-only-star-ledger.test.ts`. All 5 now `import ts from '@typescript/typescript6'`
        explicitly (added as an `apps/web` devDependency, `6.0.2`); verified the shim's CJS export
        interops correctly as a default import.
      - `apps/web/next.config.ts`: removed `experimental.useTypeScriptCli: false` and its comment.
        `pnpm --filter web exec next build` succeeds, "Finished TypeScript" with no "typescript is
        not installed" — Next 16.3.1 type-checks fine on the native TS7 CLI checker now.
      - `pnpm typecheck`: passes, wall time ~3.4s (both workspaces, `--workspace-concurrency=1`).
      - `pnpm lint`: passes. Hit a transient rtk-hook flake (`[warn] Linter process terminated
        abnormally` / `ESLint output (JSON parse failed...)`) misreading oxlint's output as if it
        were ESLint's — pre-existing rtk/oxlint mismatch from S1, not caused by this step;
        `rtk proxy pnpm lint` bypasses it and passes clean every time.
      - Full unit suite (`vitest run --maxWorkers=1`): 1712 pass, 2 fail (both pre-existing/known:
        `utils.test.ts` display-3xl token drift, `i18n/hardcoded-strings`), 372 skipped. No new
        failures from the TS7/shim swap. The third previously-known failure
        (`oauth-consent/scope-message-key`) did not reproduce this run.
      - CLAUDE.md: rewrote the "TypeScript runs side-by-side" paragraph in `# Notes` to the new
        reality; fixed "Code Quality" section's stale "ESLint" → "oxlint" line (S1 missed it).
        Note: `CLAUDE.md` is in `.prettierignore` — do not run `prettier --write` on it directly,
        it reformats unrelated pre-existing emphasis-style drift across the whole file; use
        `pnpm format:check` (which respects the ignore) to gate it instead.
      - Commit `f12151c`.
- [ ] S3 — dependency lift (sonnet). `pnpm up --latest -r`, one commit per major family
      (next/react, drizzle, better-auth + plugins, zod, tailwind, vitest/playwright, rest).
      better-auth: run `scripts/mcp-smoke.mjs` + DCR curl. Playwright: only `--grep @smoke --workers=1`.
- [ ] S4 — prettier → oxfmt (sonnet). Same options; one reformat commit; keep prettier only for
      extensions oxfmt can't format (check md/css/yml/json). lint-staged + CI updated.
- [ ] R — review S1–S4 diff (sonnet) → fix → merge to main → deploy.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | S1 eslint→oxlint | sonnet | 220k | 153 | done — commit `6947faa` |
| s2 | S2 TypeScript 7 | sonnet | 90k | 55 | done — commit `f12151c` |
