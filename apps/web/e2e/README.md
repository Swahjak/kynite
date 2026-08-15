# E2E tests

Playwright specs under `e2e/tests/`, organized by surface (`app/`, `hub/`,
`share/`) and mirrored by the `app`, `hub`, `share` projects in
`playwright.config.ts` (each depends on `setup`). A separate `perf` project
runs only `hub/realtime/completion-perf.spec.ts`, with dependencies on
`app`, `hub` and `share`.

## Tag taxonomy

Tests are tagged so a narrow, cheap subset can be run without touching the
full suite:

- `@smoke` — the critical-path handful (sign-up/sign-in, calendar CRUD,
  routine completion, hub board render, plus `smoke.spec.ts`). Kept under 15
  tests; this is the gate to run when CPU budget is tight.
- `@visual` — every screenshot/snapshot spec (`**/visual/*.spec.ts`).
  Slow and prone to pixel-diff noise; skip these for a fast functional pass.
  **Out of the CI gate for the alpha** (`ci.yml` runs `--grep-invert @visual`):
  while the interface is being rebuilt every snapshot diff is a deliberate
  change, so the gate was red by design and told you nothing. 18 of the 40
  baselines cover the calendar and Vandaag — both open work — and the two
  design-system shots move with any token edit. Keep running them locally when
  you want to _look_ at a change; `pnpm e2e:visual:update` re-blesses them. At
  feature freeze: one full update run, then drop the flag from `ci.yml`.
- `@heavy` — anything slow or load-sensitive: the `completion-perf` guard,
  `kiosk-audit.spec.ts`, the axe/accessibility specs, and the calendar
  drag-and-drop tests.

Untagged tests are the ordinary middle tier — everything else.

Tags compose with `--project` slicing, so you can combine a tag filter with
a specific project.

## Targeted runs

```bash
# Quick gate: the critical-path smoke set only
pnpm exec playwright test --grep @smoke --workers=1

# Functional app tests only: skip visual snapshots and heavy/slow specs
pnpm exec playwright test --project=setup --project=app --grep-invert "@visual|@heavy" --workers=1

# The perf guard specifically, without re-running its app/hub/share dependencies
pnpm exec playwright test --project=perf --no-deps --workers=1
```

Notes:

- `.env.local` must be moved aside before running e2e (it otherwise leaks
  dev-only env into the test run) — see `pnpm e2e:setup` / `pnpm e2e:full`.
- The `perf` project declares `dependencies: ['app', 'hub', 'share']` in
  `playwright.config.ts`; pass `--no-deps` to run it in isolation instead of
  re-running every other project first.
- Always run with `--workers=1` on a CPU-constrained machine.
