# AGENTS.md — rules for delegated executors (Antigravity / agy)

Read `CLAUDE.md` in this directory first: it is the full project guide (commands, workspace
layout, design system, Next.js 16 caveats). Also read `apps/web/AGENTS.md` before touching
`apps/web`. This file only adds the rules for an executor that works on a task handed to it
by the orchestrator.

## Hard rules

- Work only on the branch you are told to use. Never switch branches, never commit, never
  push, never run `git stash`/`reset`/`checkout --`. Leave the working tree for review.
- Stay inside the paths named in the task. If the task needs a change outside them, stop and
  report it instead of expanding scope.
- Never edit `node_modules/`, lockfiles, `.env*`, CI config, or installed tooling to make a
  check pass. A gate that fails is reported as failing, with the exact error line.
- No `Co-Authored-By`, `Created-By` or other AI attribution anywhere.
- Tokens live only in `packages/ui/src/styles/tokens.css` and `utilities.css`. Never hardcode
  a colour, radius or type step in a component when a token exists; add the token first.
- Strings shown to users go through `next-intl` (`apps/web/messages/nl.json` + `en.json`).
  Package components (`packages/ui`) take labels as props with an English default.
- `@kynite/ui` may not import `next-intl`, `next/*`, `server-only` or anything from the app.
- Design source of truth: `docs/design/claude-design/*.dc.html` mockups, with
  `Ledenkleuren.dc.html` as the colour rulebook. When the task quotes a value from a mockup,
  use that value.

## Gates (run from the repo root, serially, never in parallel)

```bash
pnpm exec oxlint --threads 2 <changed paths>
pnpm typecheck                                   # runs web + ui serially
pnpm --filter web exec vitest run <matching test files> --maxWorkers=1
```

Do not run Playwright (`pnpm e2e*`) unless the task says so; visual baselines are regenerated
by the orchestrator.

## Report format

End your reply with a fenced block:

```
===DIGEST===
files changed: <path — one-line what>
gates: <lint ok|fail: line> / <typecheck ok|fail: line> / <vitest ok|fail: line>
decisions: <anything you chose that the task left open>
left out: <anything in the task you did not do, and why>
```

Put bulky detail in files, not in the reply.
