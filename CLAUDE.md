# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Planner is a Next.js 16 application designed as a family organizational hub. It integrates with Google Calendar and Google Tasks to provide a centralized view of schedules and chores on a wall-mounted smart display or mobile device. The project uses React 19 with TypeScript.

## Commands

This is a pnpm workspace: the Next.js app lives in `apps/web` (all of `src/`,
`tests/`, `e2e/`, `drizzle/`, `scripts/` and the app-level config), `packages/`
is an empty scaffold for the future design-system package, and the root holds
only workspace tooling (husky, commitlint, lint-staged, oxfmt, Dockerfile,
`.github`, `docs`). Every command below still runs **from the repo root** —
the root scripts proxy to `pnpm --filter web <script>`.

```bash
# Development
pnpm dev              # Start dev server with Turbopack (http://localhost:3000)
pnpm build            # Production build (runs migrations first)
pnpm typecheck        # TypeScript type checking
pnpm lint             # Run oxlint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format with oxfmt
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
- **Path alias**: `@/*` maps to `./src/*` (within `apps/web`)
- **Workspace**: pnpm monorepo — `apps/web` (the Next app) + `packages/ui` (`@kynite/ui`, the design system + Storybook)

### Key Directories

- `src/app/[locale]/` - Localized App Router pages (nl/en)
- `src/components/` - App-level React components (the locale-coupled `ui/*` primitives, calendar/ for main feature)
- `src/lib/` - Shared utilities
- `src/hooks/` - Custom React hooks
- `src/i18n/` - Internationalization config (routing.ts, request.ts, navigation.ts)
- `src/server/` - Server-side code (auth.ts, db/, schema.ts)
- `messages/` - Translation JSON files (nl.json, en.json)
- `e2e/` - Playwright E2E tests
  - `tests/` - Test specs organized by feature (auth/, family/, dashboard/, visual/)
  - `fixtures/` - Playwright fixtures for auth and page setup
  - `utils/` - Test data factory, DB seeder, test scenarios

### Design system — `packages/ui` (`@kynite/ui`)

The primitives and the token layer live in the workspace package, not in the app:

- **Components**: `packages/ui/src/components/*` — import them as `import { Button, Icon } from '@kynite/ui'`. One entry point; there are no subpath imports. Two layers behind it: the shadcn/Base-UI **primitives**, and the **composites** over them (`IconMedallion`, `MediaRow`, `SectionHeading`, `PageHeader`, `EmptyState`, `CategoryChip`, `StarCount`, `ProgressBar`, `MemberFace`/`FaceStack`, `PillTabs`, `RoutineCard`/`StepRow`, `RewardCard`/`SavingsGoalCard`, `KidStatCard`, `StarPop`). `apps/web/src/components/kynite/` is gone — the composites moved there in wave B. Before hand-rolling any of those shapes, check the package.
- **Domain-shaped props are structural, never imported.** `RoutineCard` takes a `RoutineCardRoutine`, `RewardCard` a `RewardTile`, `SavingsGoalCard` a `SavingsGoal` — the read subset of the app's `BoardRoutine` / `StoreTile` / `Goal`, restated in the package so the app's own types pass straight in. Colour that identifies a *person* or a *category* arrives as a class string (`MEMBER_COLOR_CLASSES[color].surface`, `CATEGORY_TILE[category]`), resolved by an app-side wrapper — `MemberAvatar`, `MemberFaces`, `modules/today/ui/kid-stat-card.tsx`.
- **What deliberately stayed in the app**: `modules/calendar/ui/time-grid.tsx` and `modules/timers/ui/timer-tile.tsx`. Both derive their whole visual state from a slice's domain (timezone + recurrence + a drag hook; the countdown clock + the timers `tokens.ts` three sibling surfaces share), so moving them would drag the slice into the design system. They are covered in Storybook by specimen stories instead.
- **Tokens**: `packages/ui/src/styles/{tokens,utilities}.css`, the *only* copy. `apps/web/src/app/globals.css` is a five-line consumer of them, and so is Storybook's preview. Change a colour, a type step or a radius there, nowhere else.
- **`cn()`**: `import { cn } from '@kynite/ui'` (it moved out of `@/lib/utils`).
- **The package boundary is a lint rule.** `@kynite/ui` may not import `next-intl`, `next/*`, `server-only`, or anything from the app. Labels arrive as props; a component that needs a link takes Base UI's `render` prop and lets the app pass `next/link`. `packages/ui/.oxlintrc.json` has the rule and the reasoning.
- **`apps/web/src/components/ui/` is now wrappers, not components.** `Dialog`, `Sheet`, `Toast`, `Fab`, `ConfirmButton`, `Calendar` and the date/time fields moved into the package; what is left under that path are thin client wrappers of the same name that inject what the package may not know — `t('close')`, `t('cancel')`, `next/link`, `useFormattingLocale()`. Keep importing `@/components/ui/dialog` from product code; import `@kynite/ui` directly only where no translation is involved. Adding a string to a package primitive means adding a **prop with an English default**, then filling it in the wrapper — never a `useTranslations` call inside `packages/ui`.
- Tailwind scans the package through `@source '../../../../packages/ui/src'` in `globals.css`. A new class only used inside the package still compiles because of that line.

### Storybook, and its MCP server

```bash
pnpm storybook          # dev server on http://localhost:6006
pnpm storybook:build    # static build (gate)
```

Storybook lives in `packages/ui` and renders the real components against the real tokens and fonts, so a specimen there is what the app renders.

**When the dev server is running, use the Storybook MCP tools** (`.mcp.json` → `storybook`, `http://localhost:6006/mcp`) rather than reading component source to answer UI questions:

- `list-all-documentation` / `get-documentation` — what the design system already provides, and a component's real props. Check this *before* hand-rolling any UI; it is faster and more accurate than grepping `packages/ui`.
- `get-storybook-story-instructions` — call it before writing or editing any `*.stories.tsx`.
- `get-changed-stories` / `get-stories-by-component` → `preview-stories` — after changing a component, a style or a token, get the preview URLs and put them in your reply so the change can be looked at.

The tools are only reachable while `pnpm storybook` is running; without it, fall back to reading the stories in `packages/ui/stories/`.

### Styling Conventions

Uses shadcn/ui component library with CSS variables for theming (see `packages/ui/src/styles/tokens.css`). Use the `cn()` helper from `@kynite/ui` for conditional class merging.

**Design source of truth**: `docs/design/README.md` — the Kynite design system (Baloo 2 / Poppins, indigo `#5d5fef` / orange `#ef8d5d` / cream `#fbf9f4`). It supersedes all older design references. Consult it before making any color, typography, spacing, or component-styling decision.

**Upstream design mockups — Claude Design.** The `.dc.html` mockups in `docs/design/claude-design/` are exports of a Claude Design project the designs are actually edited in:

- Project: **Kynite Design System**, `projectId` `3c19b279-cfe7-4b23-b09d-b468627219ce` (https://claude.ai/design/p/3c19b279-cfe7-4b23-b09d-b468627219ce).
- Fetch with the `DesignSync` tool (load it via `ToolSearch` first): `get_project` → `list_files` → `get_file` per path. `list_projects` returns **empty** for this one — it is `PROJECT_TYPE_PROJECT`, not a design-system project, and that method only lists design-system projects. Always address it by the id above rather than concluding there is no project.
- `DesignSync` is a built-in Claude Code tool (not an MCP server) meant for the `/design-sync` skill, which pushes a local component library *up* to a design-system project. Pulling mockups *down* with `get_file` is a side capability: it returns the file into the main context (no write-to-disk), is capped at 256 KiB, and is **not available to subagents** — so the old "fetch in a subagent" approach no longer works, and a wholesale pull of every mockup (~700 KB across 8 files) is not affordable. `list_files` carries no hashes or timestamps, so changed files can't be detected remotely either.
- Sync discipline (2026-09-14): only pull a mockup the owner names as changed, in the main session, writing it straight to `docs/design/claude-design/` and diffing there; for anything larger, export from Claude Design by hand into that directory. Either way the commit of that directory is the record of what moved. Pulling `DESIGN.md` (~7 KB) on every sync is fine.

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

### MCP server

`/api/mcp` (`apps/web/src/app/api/mcp/route.ts`) exposes the family's calendar and tasks to
MCP clients (Claude Desktop, or any OAuth 2.1 MCP host) — built in-app rather than as a
separate server, see `docs/adr/20260903-mcp-server.md` for why.

- **OAuth flow**: `mcp()` + `cimd()` (`src/server/auth.ts`) turn the existing better-auth
  instance into the OAuth 2.1 authorization server. A client discovers it through the
  standard endpoints — RFC 9728 protected resource metadata at
  `/.well-known/oauth-protected-resource/api/mcp` and RFC 8414 authorization server
  metadata at `/.well-known/oauth-authorization-server/api/auth` — both forwarded by
  `src/app/.well-known/[...all]/route.ts` (Next needs *a* file route there before
  better-auth's own raw-pathname matching runs). Client identity is a CIMD URL for Claude;
  RFC 7591 Dynamic Client Registration is also on (unauthenticated) for hosts like ChatGPT
  that only speak DCR — see the "CIMD, plus Dynamic Client Registration" bullet in the ADR
  for what that opens up and what already mitigates it.
- **Where tools live**: one registrar per domain, `src/app/api/mcp/tools/<domain>.ts`, each
  exporting `register<Domain>Tools(server, principal, grantedScopes)`; `route.ts`'s
  `registerTools()` just calls all six against a fresh `McpServer` per request (the verified
  principal/scopes are closures, not read off `ctx.http.authInfo`). Shared helpers (`ok`,
  `toolError`, the `McpToolServer` type) live in `tools/shared.ts`. One tool list per domain,
  verified against the registrars: calendar 7 (`list_calendars`, `list_events`,
  `create_event`, `skip_event_occurrence`, `update_event_occurrence`, `update_event`,
  `delete_event`), tasks 5 (`list_tasks`,
  `get_task`, `create_task`, `toggle_task`, `delete_task`), routines 9 (`list_routines`,
  `get_routine`, `create_routine`, `update_routine`, `delete_routine`, `set_routine_active`,
  `set_routine_reward`, `complete_step`, `undo_completion`), timers 7 (`list_timers`,
  `get_timer`, `start_timer`, `stop_timer`, `pause_timer`, `resume_timer`, `extend_timer`),
  rewards 12 (`list_rewards`, `get_reward`, `list_redemptions`, `get_star_totals`,
  `list_star_history`, `create_reward`, `update_reward`, `delete_reward`, `award_stars`,
  `request_redemption`, `decide_redemption`, `fulfill_redemption`), family 7 (`list_members`,
  `get_family`, `get_member`, `create_member`, `update_member`, `delete_member`,
  `update_family`). `update_event`/`delete_event` move/edit/delete a whole event or series
  (`modules/calendar/write.ts`'s `updateEvent`/`deleteEvent`, extracted from
  `updateEventAction`'s/`deleteEventAction`'s whole-series branches) — distinct from
  `update_event_occurrence`/`skip_event_occurrence`, which touch one occurrence of a
  recurring series and pass a Google-synced series through unchanged. The whole-event tools
  refuse a Google-linked event outright (`googleEventId` set) instead: that check lives in
  `tools/calendar.ts`'s `googleSyncCheck`, not the shared seam, since the web app itself still
  edits/deletes a Google-linked event and pushes the change back — the refusal is MCP-only.
- **Scopes**: one read/write pair per domain — `kynite:calendar.read`/`.write`,
  `kynite:tasks.read`/`.write`, `kynite:routines.read`/`.write`, `kynite:timers.read`/`.write`,
  `kynite:rewards.read`/`.write`, `kynite:family.read`/`.write` — 12 scopes in total, declared
  in three places that must be kept in sync by hand: `MCP_SCOPES` in `src/server/auth.ts` (what
  the OAuth provider offers), the `MCP_<DOMAIN>_READ`/`_WRITE` constants in
  `src/server/mcp-auth.ts` (what a tool checks), and `SCOPE_MESSAGE_KEYS` in
  `src/modules/oauth-consent/page-data.ts` plus `oauth.scopes.*` in
  `messages/{nl,en}.json` (what the consent screen labels — an unlisted scope falls back to
  `oauth.unknownScope`). `list_members` is the one deliberate any-of: it accepts
  `kynite:family.read`, `kynite:calendar.read` **or** `kynite:tasks.read`, since naming the
  family's members is the lookup table every other domain's ids resolve against.
- **The seam rule**: every mutating tool calls its domain's `modules/<domain>/write.ts`
  seam — never a Server Action from `actions.ts`. Each seam function takes an explicit
  `Principal`, calls `can()` itself (redundantly with the tool's own pre-check — a stolen
  scope still can't bypass what the member's role permits), validates its own input, and does
  its own side effects (publish/realtime, notifications) — `next/cache` revalidation stays out
  of the seam, since MCP has no page to revalidate; `actions.ts` wraps the same seam with
  `assertCan → delegate → revalidate` for the web app. Adding a tool: pick the seam function
  (or add one to `write.ts` if the mutation has none yet), write
  `server.registerTool(name, { inputSchema: zod }, handler)` in the domain's registrar, and
  inside the handler check the token's scope first (`hasAllScopes`/`hasAnyScope` from
  `src/server/mcp-auth.ts`), then — for anything that mutates — call `can()` against the
  resolved `Principal` before calling the seam. Return `toolError(message)` (not a thrown
  error) for any refusal — a normal MCP tool error, not the 401/403 HTTP layer
  `requireMcpAuth` already owns for missing/invalid tokens.
- **Principal resolution**: `principalForMcpUser()` (`src/server/mcp-auth.ts`) maps a
  token's `sub` to a family member, refusing (403) a user with no member row or with live
  member rows in more than one family — a bearer token has no family selector to disambiguate
  with.
- **Rate limiting**: `checkMcpRateLimit()` (`src/server/mcp-auth.ts`) is an in-memory
  per-token-`sub` sliding window (60 req/min, 429 + `Retry-After`) — separate from
  `@better-auth/oauth-provider`'s own rate limits on the OAuth flow endpoints
  (`/oauth2/token` etc.), which don't cover `/api/mcp` itself. In-memory is a deliberate
  single-instance (Railway) assumption; revisit if the app ever scales horizontally.
- **Guidance**: the server steers the host toward the family's reward model at two levels.
  `tools/instructions.ts` holds `KYNITE_MCP_INSTRUCTIONS`, passed as the SDK's
  `ServerOptions.instructions` in `route.ts` and sent on every `initialize` — the star rules
  (per completed *step*, never a deduction, praise before star, ask the parent, no sibling
  comparison) from `docs/research/psychology-and-product-principles.md` and PRD FR11–FR19.
  Each tool `description` then carries the one rule that matters at that call site, and the
  MCP layer narrows the schemas: `starsPerCompletion` defaults to 1 and caps at 5,
  `award_stars.amount` at 10, `costStars` to 1–250, and `get_star_totals` returns
  `earnedLast7Days`/`avgPerDay` to price against. **The seams stay permissive** (0–20 stars,
  1–500 cost) — the app's own editors keep the wider range; the caps exist because an LLM
  host inflating the economy is the failure the tool layer is there to prevent. Change a
  rule in `instructions.ts`, not in a tool description.
- **Smoke test**: `node apps/web/scripts/mcp-smoke.mjs` against a running `pnpm dev` —
  checks the unauthenticated 401 + `WWW-Authenticate` challenge and that the discovery
  documents are reachable. Does not touch the database; kill the dev server when done.

### Environment Variables

Required in `.env.local`:

```
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000  # Also used for Google Calendar webhooks
```

## Code Quality

- oxlint with Next.js integration, oxfmt for formatting
- Husky pre-commit hooks run lint-staged
- Commitlint enforces conventional commits (feat:, fix:, etc.)
- TypeScript strict mode enabled

## Commit Guidelines

Do NOT include Co-Authored-By or similar Claude references in commit messages. Use conventional commit format (e.g., `feat: add calendar view`, `fix: resolve sync issue`).

# Notes

- Nextjs 16+ uses proxy.ts instead of middleware.ts
- **TypeScript is plain 7** (`"typescript": "^7.0.2"` in `apps/web` and
  `packages/ui`) — the Go-ported native compiler owns the `tsc` binary, so
  `pnpm typecheck` and `next build`'s own type-checking both run on it
  directly. No alias, no `experimental.useTypeScriptCli` opt-out in
  `apps/web/next.config.ts` — that flag existed only because the old compat
  shim didn't declare a plain `tsc`, and TS 7 does.
  - TS 7's npm package doesn't export the JS compiler API yet (it returns in
    7.1), so the handful of tests that walk a TypeScript AST
    (`tests/unit/server-action-authorization.test.ts`,
    `tests/unit/share-tree-no-server-actions.test.ts`,
    `tests/unit/i18n/hardcoded-strings.test.ts`,
    `tests/unit/realtime/event-coverage.test.ts`,
    `tests/unit/append-only-star-ledger.test.ts`) import the compiler API
    explicitly from `@typescript/typescript6` (an `apps/web` devDependency,
    Microsoft's official compat shim) instead of from `typescript`:
    `import ts from '@typescript/typescript6'`. Revisit once TS 7.1 restores
    the API — then those imports can go back to plain `typescript` and the
    shim devDependency can be dropped.
  - Keep `typecheck`/`lint` serialised (`--workspace-concurrency=1`). TS 7 is
    internally parallel and already runs at 300–430% CPU, so widening the
    workspace concurrency contends rather than helps.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
