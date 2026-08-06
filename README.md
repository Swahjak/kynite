# Kynite

Family planning that actually gets done. Greenfield rebuild — see
[`docs/rebuild-milestones.md`](docs/rebuild-milestones.md) for progress and
[`docs/architecture.md`](docs/architecture.md) for the design.

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · TypeScript 5.9
strict · Tailwind 4 · shadcn CLI 4 on Base UI · Drizzle ORM + Postgres 17 ·
better-auth · next-intl (nl default, en) · Vitest 4 · Playwright 1.62 ·
ESLint 10 flat config + Prettier. Node 24, pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in DATABASE_URL / BETTER_AUTH_SECRET / BETTER_AUTH_URL
pnpm dev                     # http://localhost:3000
```

## Commands

| Command                                                     | What it does                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                  | Dev server (Turbopack)                                                                              |
| `pnpm build` / `pnpm start`                                 | Production build / serve                                                                            |
| `pnpm run ci`                                               | Full gate: typecheck + lint + test:run + build (`ci` is a reserved pnpm command, so it needs `run`) |
| `pnpm typecheck`                                            | `tsc --noEmit`                                                                                      |
| `pnpm lint` / `pnpm lint:fix`                               | ESLint                                                                                              |
| `pnpm format` / `pnpm format:check`                         | Prettier                                                                                            |
| `pnpm test` / `test:run` / `test:coverage`                  | Vitest                                                                                              |
| `pnpm e2e` / `e2e:ui`                                       | Playwright (boots the dev server itself)                                                            |
| `pnpm e2e:setup` / `e2e:teardown` / `e2e:full`              | Test Postgres (port 5435) lifecycle                                                                 |
| `pnpm db:generate` / `db:migrate` / `db:push` / `db:studio` | drizzle-kit                                                                                         |

## Structure

```
src/
  app/[locale]/     # route groups: (marketing) (auth) (app) (hub) (share)
  modules/          # vertical feature slices — see src/modules/README.md
  components/ui/    # shadcn / Base UI primitives
  server/           # env.ts (zod), db/
  i18n/ lib/
messages/           # nl.json (default), en.json
e2e/ tests/         # Playwright specs · Vitest unit tests + lint fixtures
```

Cross-module deep imports (`@/modules/<slice>/<file>`) are lint-banned; import
`@/modules/<slice>` instead.
