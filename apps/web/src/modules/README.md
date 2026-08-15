# Modules

Vertical feature slices — the unit of ownership (see `docs/architecture.md` §2).

Each slice exposes exactly:

```
modules/<slice>/
  schema.ts   # drizzle tables owned by this slice
  queries.ts  # reads ("server-only")
  actions.ts  # Server Actions — the only mutation entry point
  events.ts   # realtime event types this slice publishes
  domain/     # pure, framework-free functions (this is where Vitest earns its keep)
  ui/         # slice-owned components
  index.ts    # public surface
```

## Rules

1. **Cross-module imports go through `index.ts` only.** Deep imports
   (`@/modules/routines/queries`) are banned by the `no-restricted-imports`
   rule in `eslint.config.mjs`; inside a slice use relative imports.
2. `domain/` stays pure and framework-free.
3. Every mutation is a Server Action: validate (zod) → authorize → write in a
   transaction → `NOTIFY` → revalidate.
4. Route files hold no logic; they compose module UI + queries.
5. **Authorization has exactly one home:** `modules/family/authorize.ts` exports
   `can(principal, action, resource)` (the §7 permission matrix). Every Server
   Action calls it — via `assertCan()` — before it touches data. The rule is
   enforced repo-wide by `tests/unit/server-action-authorization.test.ts`;
   actions that legitimately have no principal (sign-up, sign-in, sign-out)
   carry a `@public-action` tag _and_ appear in that test's allowlist.

Planned slices: `family` `calendar` `google` `routines` `rewards` `timers`
`realtime` `notifications` `devices` `sharing`.
