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

Planned slices: `family` `calendar` `google` `routines` `rewards` `timers`
`realtime` `notifications` `devices` `sharing`.
