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
        Note: `CLAUDE.md` was in `.prettierignore` (now `.oxfmtrc.json`'s `ignorePatterns`, since
        S4) — do not run the formatter's write mode on it directly, it reformats unrelated
        pre-existing emphasis-style drift across the whole file; use `pnpm format:check` (which
        respects the ignore) to gate it instead.
      - Commit `f12151c`.
- [x] S3 — dependency lift (sonnet). `pnpm outdated -r` found 30 outdated packages, all
      patch/minor except vitest's major. Six commits, one per family, gated (typecheck + oxlint +
      unit tests) before each:
      - **a** (`c255a63`) next 16.3.1→16.3.5, react/react-dom 19.2.8→19.3.0,
        @types/react(-dom)→19.3.0, next-intl 4.13.6→4.14.4. All patch/minor within the same Next
        minor — no doc-breaking-change section applied. `next build` run once, green.
      - **b** drizzle-orm/drizzle-kit/pg — already at latest (not in the outdated list), no commit
        needed.
      - **c** (`240bb2e`) better-auth + @better-auth/cimd,mcp,oauth-provider 1.7.2→1.7.4. Found and
        fixed a real regression along the way: 1.7.3 reverted the 1.7.0–1.7.2 `account.issuer`
        requirement back to plain `providerId`/`accountId` identity (better-auth's own 1.7 upgrade
        guide, confirmed via `--depth 1` clone). Dev server 500'd on both `.well-known` MCP
        discovery endpoints with `SCHEMA_MISMATCH` until fixed. Dropped `issuer` and its unique
        index from `auth-schema.ts` (back to the exact pre-1.7 shape), generated drizzle migration
        `0033_nervous_roxanne_simpson.sql`, applied it, rewrote the stale comment block in
        `auth.ts`. Also dropped the `@better-auth/oauth-provider` patch (loopback-port-variance for
        `localhost`): upstream PR #11090 shipped the same fix natively in 1.7.3
        (`stripLoopbackRedirectPort`), so `patchedDependencies` and the patch file are gone.
        Verified: `mcp-smoke.mjs` all green, DCR curl 201 with capped `kynite:*`-plus-OIDC scopes,
        `http://` non-loopback redirect 400.
      - **d** (`7cb30dd`) zod 4.4.3→4.6.4, @base-ui/react 1.7.0→1.8.0, lucide-react 1.31.0→1.45.0,
        shadcn 4.18.0→4.21.0. tailwindcss/@tailwindcss/postcss already latest, untouched.
      - **e** (`e788142`) vitest + @vitest/coverage-v8 4.1.10→5.0.0 (major), @playwright/test
        1.62.1→1.63.0, storybook + @storybook/react-vite 10.5.8→10.6.0, @storybook/addon-mcp
        0.7.0→10.6.0 (now tracks storybook's own versioning; incidentally fixed the unmet
        `valibot` peer warning noted in S1/family-a). Checked vitest 5's migration guide in full —
        `clearMocks`-by-default, removed `test.sequential`/`describe.sequential`, `toThrow('')`
        semantics, hoisted-mock-call enforcement: none match anything in this repo (grepped).
        `storybook:build` run once, green.
      - **f** (`e0e88eb`) everything else: subset-font, @testing-library/user-event, vite,
        @types/pg, @vitejs/plugin-react, tailwind-merge, pg-boss, @types/node,
        @testing-library/react, lint-staged. All patch/minor.
      - Nothing held back — `pnpm outdated -r` is clean after family f.
      - Final full gate: `pnpm typecheck`, `rtk proxy pnpm lint`,
        `pnpm --filter web exec vitest run --maxWorkers=1` (1712 pass / 2 fail, same three
        pre-existing failures as S1/S2: `utils.test.ts` display-3xl,
        `i18n/hardcoded-strings.test.ts`, `oauth-consent/scope-message-key.test.ts` — no new
        failures at any point across all six families), `next build`, and Playwright
        `--grep @smoke --workers=1` against `e2e:setup`'s test DB (9/9 pass) — all green. Had to
        `playwright install chromium` once (new `@playwright/test` binary version); `--with-deps`
        needs sudo unavailable in this sandbox, plain `install chromium` was sufficient.
        `.env.local` moved aside and restored per the e2e gotcha; ports 3100/3101 and the test DB
        container torn down afterward.
- [x] S4 — prettier → oxfmt (sonnet). oxfmt 0.67.0. Its compatibility matrix now has full
      support for JS/TS/JSX/TSX/JSON/YAML/Markdown/CSS/SCSS/Less/HTML — every extension this repo
      formatted with prettier — so prettier drops entirely rather than keeping a narrowed role.
      - `.oxfmtrc.json` at root via `oxfmt --migrate=prettier` (then hand-verified against the
        config docs): `semi`/`singleQuote`/`trailingComma: "es5"`/`printWidth: 100`/`tabWidth: 2`
        map 1:1 to the prettier options. `sortPackageJson` explicitly set `false` (oxfmt defaults
        it on; prettier never touched key order) to keep behavior identical; `sortImports` and
        `sortTailwindcss` stay off (both were off before — no prettier-plugin-tailwindcss was
        configured, so there was no class-sorting behavior to carry over, and no plugin-parity
        gap to report).
      - `.prettierignore`'s patterns moved verbatim into `ignorePatterns` (oxfmt also
        auto-reads `.prettierignore` in the cwd if present, but a single source of truth is
        clearer); `.prettierignore` and `prettier.config.mjs` deleted.
      - `oxfmt --check .`: 12 of 889 files (~1.3%) — well under the 5% stop threshold. Every
        diff is the same cosmetic pattern: a multi-member union type sitting at/near
        `printWidth: 100` that prettier kept packed on one line, which oxfmt wraps one member
        per line with a leading `|`. No semantic difference in any of the 12 (verified full diff,
        not just samples) — see the `style: reformat with oxfmt` commit.
      - Scripts: root/`apps/web`/`packages/ui` `format`/`format:check`/lint-staged entries now
        call `oxfmt` instead of `prettier --write`/`--check`. `oxfmt` added as a devDependency in
        all three `package.json` (matching where `prettier` used to be listed) since lint-staged
        runs each package's config from that package's own directory and needs the binary
        resolvable there — a root-only devDependency isn't visible to `apps/web`/`packages/ui`
        under pnpm's isolated `node_modules`. `prettier` removed from all three.
      - CI: `.github/workflows/ci.yml`'s `pnpm run ci` never called `format`/`format:check`
        directly (checked — no prettier/format reference in the workflow at all), so no CI
        change was needed.
      - CLAUDE.md: Commands block's "Format with Prettier" → "Format with oxfmt", root-tooling
        list's "prettier" → "oxfmt", Code Quality's "oxlint with Next.js and Prettier
        integration" → "oxlint with Next.js integration, oxfmt for formatting". Updated the S2
        note above (this file) that referenced `.prettierignore`, since that file is gone.
      - **Gap found and fixed**: unlike `prettier --write <ignored-file>` (a silent no-op),
        `oxfmt <ignored-file>` exits 1 with "Expected at least one target file" when every
        positional argument is excluded by `ignorePatterns` — hit for real committing this very
        file (`docs/` is ignored, lint-staged passes exact staged paths). Added
        `--no-error-on-unmatched-pattern` (the flag oxfmt's own migrate-from-prettier guide
        recommends for this) to every lint-staged `oxfmt` invocation in all three
        `package.json`s; `format`/`format:check` run over whole-tree globs so they never hit this.
      - Verified lint-staged end-to-end: added trailing whitespace to a staged `.ts` file,
        ran `pnpm exec lint-staged` directly — it invoked `oxlint --fix` then `oxfmt`, which
        silently normalized the file back to clean (lint-staged then refused to leave an empty
        commit, confirming the fix actually applied).
      - Gates: `pnpm typecheck` green, `rtk proxy pnpm lint` green (oxlint, both workspaces),
        `pnpm format:check` clean (`oxfmt --check`, 889 files), full unit suite
        (`vitest run --maxWorkers=1`): 1735 pass / 2 fail / 372 skipped — the same three
        pre-existing failures as S1–S3 (`utils.test.ts` display-3xl, `i18n/hardcoded-strings`,
        `oauth-consent/scope-message-key`), no new failures from the format swap.
      - Two commits: `958906f` (config/scripts, no reformat) and `ad7c0e0` (reformat only, 12
        files, +43/-13).
- [ ] R — review S1–S4 diff (sonnet) → fix → merge to main → deploy.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | S1 eslint→oxlint | sonnet | 220k | 153 | done — commit `6947faa` |
| s2 | S2 TypeScript 7 | sonnet | 119k | 74 | done — commit `f12151c` |
| s3 | S3 dependency lift | sonnet | 173k | 157 | done — commits `c255a63`, `240bb2e`, `7cb30dd`, `e788142`, `e0e88eb` |
| s4 | S4 prettier→oxfmt | sonnet | 125k | 55 | done — commits `958906f`, `ad7c0e0` |
