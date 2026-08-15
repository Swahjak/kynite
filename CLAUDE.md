# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Planner is a Next.js 16 application designed as a family organizational hub. It integrates with Google Calendar and Google Tasks to provide a centralized view of schedules and chores on a wall-mounted smart display or mobile device. The project uses React 19 with TypeScript.

## Commands

This is a pnpm workspace: the Next.js app lives in `apps/web` (all of `src/`,
`tests/`, `e2e/`, `drizzle/`, `scripts/` and the app-level config), `packages/`
is an empty scaffold for the future design-system package, and the root holds
only workspace tooling (husky, commitlint, lint-staged, prettier, Dockerfile,
`.github`, `docs`). Every command below still runs **from the repo root** —
the root scripts proxy to `pnpm --filter web <script>`.

```bash
# Development
pnpm dev              # Start dev server with Turbopack (http://localhost:3000)
pnpm build            # Production build (runs migrations first)
pnpm typecheck        # TypeScript type checking
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting

# Unit Tests (Vitest)
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run with coverage

# E2E Tests (Playwright)
pnpm e2e              # Run all E2E tests
pnpm e2e:ui           # Open Playwright UI
pnpm e2e:visual       # Run visual regression tests only
pnpm e2e:visual:update  # Update visual snapshots
pnpm e2e:setup        # Start test DB + run migrations
pnpm e2e:teardown     # Stop test DB
pnpm e2e:run          # Run tests (requires e2e:setup first)
pnpm e2e:full         # Full cycle: setup → run → teardown
```

### E2E gotchas

- `.env.local` leaks the machine's real `GOOGLE_CLIENT_ID` into Playwright's `webServer` (Playwright merges `process.env`; Next loads `.env.local` for absent vars) → tests hit real Google OAuth (`redirect_uri_mismatch`). Before running e2e: `mv apps/web/.env.local apps/web/.env.local.e2e-bak`; ALWAYS restore after. Do NOT set `GOOGLE_CLIENT_ID=''` — the env schema (`src/server/env.ts`) requires `min(1)` or absent; an empty string crashes the server.
- Always run Playwright with `--workers=1` on this machine (shared CPU).
- Tag tiers exist since `ee3b5df`: `--grep @smoke` (quick gate), `@visual`, `@heavy` — see `e2e/README.md`. The perf project needs `--no-deps` (its config `dependencies` replay app/hub/share).
- After runs, verify ports 3100/3101 are free — Playwright sometimes leaves webServers alive.

```bash
# Database (Drizzle + PostgreSQL)
pnpm db:generate      # Generate migrations from schema changes
pnpm db:migrate       # Run pending migrations
pnpm db:push          # Push schema directly (dev only)
pnpm db:studio        # Open Drizzle Studio GUI
```

## Architecture

- **Framework**: Next.js 16 with App Router (src/app/)
- **Styling**: Tailwind CSS 4 with shadcn/ui (new-york style)
- **Database**: Drizzle ORM with PostgreSQL
- **Auth**: better-auth with email/password
- **i18n**: next-intl with nl (default) and en locales
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Path alias**: `@/*` maps to `./src/*`

### Key Directories

- `src/app/[locale]/` - Localized App Router pages (nl/en)
- `src/components/` - React components (ui/ for shadcn, calendar/ for main feature)
- `src/lib/` - Shared utilities (utils.ts has the `cn()` helper)
- `src/hooks/` - Custom React hooks
- `src/i18n/` - Internationalization config (routing.ts, request.ts, navigation.ts)
- `src/server/` - Server-side code (auth.ts, db/, schema.ts)
- `messages/` - Translation JSON files (nl.json, en.json)
- `e2e/` - Playwright E2E tests
  - `tests/` - Test specs organized by feature (auth/, family/, dashboard/, visual/)
  - `fixtures/` - Playwright fixtures for auth and page setup
  - `utils/` - Test data factory, DB seeder, test scenarios

### Styling Conventions

Uses shadcn/ui component library with CSS variables for theming (see globals.css). Use the `cn()` helper from `@/lib/utils` for conditional class merging.

**Design source of truth**: `docs/design/README.md` — the Kynite design system (Baloo 2 / Poppins, indigo `#5d5fef` / orange `#ef8d5d` / cream `#fbf9f4`). It supersedes all older design references. Consult it before making any color, typography, spacing, or component-styling decision.

### Calendar Component

The calendar is the core feature, located in `src/components/calendar/`:

- **CalendarProvider** (`contexts/calendar-context.tsx`) - Central state management for view, events, filtering, and user preferences. Settings persist to localStorage.
- **Views**: day, week, month, year, agenda (in `views/` subdirectory)
- **DnD**: Drag-and-drop event rescheduling (`dnd/` + `contexts/dnd-context.tsx`)
- **Types**: `IEvent`, `IUser` interfaces in `interfaces.ts`, view/color types in `types.ts`
- Use `useCalendar()` hook to access calendar state and actions

### Confetti Celebrations

Celebratory confetti effects in `src/components/confetti/`:

- **ConfettiProvider** - Wrap app to enable confetti globally
- **useConfetti()** hook - Trigger confetti programmatically with configurable presets

### Google Calendar Push Notifications

Real-time sync using Google Calendar push notifications:

- **Webhook**: `POST /api/webhooks/google-calendar` - Receives Google notifications
- **Channel Management**: Channels created automatically when calendar linked
- **Renewal**: Hourly cron job renews channels expiring within 1 hour
- **Fallback**: Polling still runs every 15 minutes for missed notifications

**URL Configuration**: Uses `BETTER_AUTH_URL` for webhook address (no additional env var needed).

**Development**: Use ngrok to expose local webhook endpoint:

```bash
ngrok http 3000
# Set BETTER_AUTH_URL=https://abc123.ngrok.io
```

### Environment Variables

Required in `.env.local`:

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000  # Also used for Google Calendar webhooks
```

## Code Quality

- ESLint with Next.js and Prettier integration
- Husky pre-commit hooks run lint-staged
- Commitlint enforces conventional commits (feat:, fix:, etc.)
- TypeScript strict mode enabled

## Commit Guidelines

Do NOT include Co-Authored-By or similar Claude references in commit messages. Use conventional commit format (e.g., `feat: add calendar view`, `fix: resolve sync issue`).

# Notes

- Nextjs 16+ uses proxy.ts instead of middleware.ts

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
