# Toolchain: oxlint, TypeScript 7, dependency lift, oxfmt — tracking

Branch `chore/toolchain`. Budget: 4 builders + 1 reviewer (user "go", 2026-09-13).
Gates never run concurrently (shared CPU). Each step = own commit(s) on the branch.

## Steps

- [ ] S1 — eslint → oxlint (sonnet). Both workspaces, lint-staged, CI. Port `no-restricted-imports`
      module/package-boundary patterns (incl. `!` negations), react-hooks, next core-web-vitals.
      Drop eslint-plugin-storybook. `pnpm lint` must be fast and not OOM.
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
