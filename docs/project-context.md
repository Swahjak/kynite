---
project_name: "Family planner"
user_name: "Peep"
date: "2025-12-21"
sections_completed:
  [
    "technology_stack",
    "language_rules",
    "framework_rules",
    "testing_rules",
    "style_rules",
    "anti_patterns",
  ]
status: "complete"
rule_count: 24
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Framework:** Next.js 16.1.0 (App Router), React 19.0.0
- **Language:** TypeScript 5.8.3 (Strict Mode)
- **Database:** PostgreSQL (Neon Serverless)
- **ORM:** Drizzle ORM v0.45.1 (`drizzle-orm`, `drizzle-kit`)
- **Authentication:** Better-Auth v1.4.7
- **State Management:** TanStack Query v5.90.12 (Server), Zustand v5.0.8 (Client)
- **UI Styling:** Tailwind CSS 4.1.18, Radix UI Primitives, Framer Motion 12.23.26
- **PWA:** Serwist 9.3.0 (Service Workers), Next.js Metadata API
- **Testing:** Vitest 4.0.16, Playwright 1.57.0
- **Validation:** Zod 4.2.1

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **Strict Mode:** Always maintain `strict: true` in `tsconfig.json`. No implicit `any`.
- **Import Paths:** Use path aliases (e.g., `@/components`, `@/lib`) instead of relative paths.
- **Type Definitions:**
  - Co-locate types with the component if local-only.
  - Use shared `src/types/` for domain entities and API DTOs.
  - Prefer `interface` for public APIs/Props and `type` for unions/intersections.
- **Async Patterns:** Always use `async/await` over raw Promises (`.then()`).
- **Null Handling:** Use optional chaining (`?.`) and nullish coalescing (`??`) for safety.

### Framework-Specific Rules (Next.js 16 / React 19)

- **Component Strategy:** Use Server Components by default. Add `"use client"` only for interactivity, hooks, or browser APIs.
- **Data Fetching:**
  - Use Server Components for initial page data.
  - Use **TanStack Query** in Client Components for dynamic data, polling, and mutations.
- **API-First Enforcement:** **All mutations and data interactions MUST happen via Route Handlers (`src/app/api/...`)**. Server Actions are strictly forbidden to ensure a decoupled, headless architecture.
- **Authentication:** Access sessions via **Better-Auth** server-side utilities in Route Handlers and Server Components.
- **State Management:**
  - **Server State:** TanStack Query (Single Source of Truth).
  - **Client UI State:** Zustand (Ephemeral UI state like "sidebar open").
- **PWA Logic:** Isolate browser-specific logic (Service Workers, Manifest calls) behind `useEffect` or within specific PWA hooks.

### Testing Rules

- **Unit Tests (Vitest):**
  - Co-locate unit tests with the source file using `*.test.ts(x)` naming.
  - Focus on business logic in `/server/services` and pure functions in `/lib`.
- **Integration Tests:** Test the integration between API routes and services using Vitest in Node environment.
- **E2E Tests (Playwright):**
  - Place all E2E scripts in the root `e2e/` directory.
  - Priority: Critical user journeys (e.g., "Morning Rush", "Google Auth").
  - Use the `visual.spec.ts` for regression testing on the Wall Hub's "glanceable" UI.
- **Mocking:** Use standard Vitest mocks for external APIs (like Google Calendar) to ensure fast, deterministic CI runs.

### Code Quality & Style Rules

- **Styling:** Use Tailwind CSS v4 utility classes. Avoid standard CSS modules unless specifically required for complex PWA layouts.
- **Database Schema:**
  - Define all schema in `src/server/schema.ts` (or modularized files imported there).
  - Use `snake_case` for all table and column names to match PostgreSQL standards.
- **Naming Conventions:**
  - React Components: `PascalCase` (`ChoreCard.tsx`).
  - Hooks: `useCamelCase` (`useChoreData.ts`).
  - Utilities/API: `kebab-case` filenames, `camelCase` functions.
- **Linting:** Adhere to the strict ESLint + Prettier configuration defined in `eslint.config.mjs` and `.prettierrc`.

### Critical Don't-Miss Rules

- **Dependency Management:** **ALWAYS prefer the latest stable versions when adding new packages.** Verify the current version on npm/GitHub before installation; do not rely on outdated model training data.
- **Anti-Patterns:**
  - **NO Direct DB Access:** Never query the database directly from UI components. Always use the API/Service layer.
  - **NO Hydration Mismatches:** Ensure PWA-specific state (like `window.innerWidth`) is handled inside `useEffect` or with a "mounted" state check.
  - **NO Plain Objects for Dates:** Always pass ISO 8601 strings through the API to prevent serialization errors.
- **Security:**
  - **OAuth Scopes:** Request the minimum required Google Calendar scopes.
  - **Secret Management:** NEVER commit `.env` files. Ensure all API keys are managed through Vercel/Neon environment settings.
- **Performance:**
  - **Glanceable UI:** Ensure high contrast for Wall Hub components. Verify minimum font sizes (16px base) and touch target sizes (48x48px).
- **Conflict Resolution:** Follow "Last Write Wins" strategy for concurrent edits.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge and are approved.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when technology stack or core patterns change.
- Review periodically for outdated rules.

Last Updated: 2025-12-21
