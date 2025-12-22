---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - "_bmad-output/prd.md"
workflowType: "architecture"
lastStep: 0
project_name: "Family planner"
user_name: "Peep"
date: "2025-12-21"
---

# Architecture Decision Record

**Project:** Family planner
**Status:** In Progress
**Date:** 2025-12-21

## Executive Summary

This document captures the architectural decisions, patterns, and structure for the Family planner project. It serves as the technical blueprint for implementation, ensuring alignment with the Product Requirements Document (PRD).

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The system requires a dual-state architecture. It must act as a real-time bridge between external Google services (multi-account OAuth) and an internal household management engine. Key capabilities include proactive "Timer Prescriptions," a module-based animation system for rewards, and distinct interaction modes for Parents (Web Controller) and Participants (PWA Hub).

**Non-Functional Requirements:**
Architectural decisions are driven by strict latency targets (<2s sync, <100ms touch) and a requirement for 99.9% reliability. The "Offline Resilience" mandate necessitates a client-side first data strategy with service workers to ensure the "Source of Truth" remains visible during connectivity loss.

**Scale & Complexity:**
The project is a medium-complexity full-stack web application.

- Primary domain: Full-stack Web (Next.js / PWA)
- Complexity level: Medium
- Estimated architectural components: 5-7 (API Gateway, Real-time Sync Service, Google Sync Worker, Core Database, PWA Frontend, Admin Controller)

### Technical Constraints & Dependencies

- **Google API Ecosystem:** 2-way sync dependency requires robust token management and rate-limit handling.
- **Android Tablet Environment:** Specifically targeting Chrome on Android for the PWA Hub.
- **Websocket Latency:** Mandatory real-time layer for Parent-to-Hub interaction.

### Cross-Cutting Concerns Identified

- **Real-time Synchronization:** Ensuring state consistency across Hub and Mobile.
- **Multi-Account Authorization:** Managing multiple Google OAuth tokens securely.
- **Offline Data Persistence:** Strategic caching for 24/7 reliability.
- **ADHD-Centric Usability:** Performance and sensory safety standards.

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack Web (Next.js / PWA)** - Extending an existing high-quality brownfield foundation.

### Existing Foundation Analysis

The project is already initialized with a modern stack:

- **Framework:** Next.js 16.1.0 (App Router) + React 19
- **UI System:** Tailwind CSS 4 + Radix UI + Framer Motion
- **Quality/Testing:** Vitest + Playwright + Husky

### Selected Approach: Custom Integration Strategy (MVP Focused)

**Rationale:**
We will integrate specific, modern architectural pillars into the current Next.js 16 structure, optimizing for **Vercel Serverless deployment**. For the MVP, we are intentionally avoiding persistent Socket connections (Websockets) to ensure architectural simplicity and deployment compatibility.

**Architectural Decisions for Next Phase:**

**1. Data Layer (To Be Added):**

- **Decision:** **Drizzle ORM (v0.45.1)** with **PostgreSQL**.
- **Tools:** `drizzle-orm`, `drizzle-kit` (v0.31.8).
- **Reasoning:** Lightweight, high-performance, and superior TypeScript inference.

**2. Authentication (To Be Added):**

- **Decision:** **Better-Auth (v1.4.7)**.
- **Reasoning:** Modern, type-safe authentication library that integrates cleanly with Drizzle and Next.js App Router for handling Google OAuth.

**3. Real-Time Strategy (MVP Pivot):**

- **Decision:** **Optimistic UI + Short Polling (using TanStack Query or SWR)**.
- **Reasoning:** **MVP Pivot.** Persistent Socket connections are excluded from the MVP scope to maintain Vercel Serverless compatibility. We will achieve the "real-time feel" through instant local UI updates (Optimistic) and frequent polling (2-5s) on the Wall Hub.

**4. PWA Configuration (To Be Added):**

- **Decision:** **Native Next.js Metadata API** (`manifest.ts`) + **Serwist** (Service Worker framework).
- **Reasoning:** To achieve "Offline Resilience" and "Kiosk Mode" safety using standard web capabilities compatible with serverless environments.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Auth:** Better-Auth (Google OAuth)
- **API Pattern:** RESTful Route Handlers (API-First)

**Important Decisions (Shape Architecture):**

- **State Management:** TanStack Query (Server State) + Zustand (Client State)
- **Real-Time:** Short Polling + Optimistic UI (TanStack Query)

### Data Architecture

- **Database:** **PostgreSQL (Neon Serverless)**.
- **ORM:** **Drizzle ORM (v0.45.1)** with `drizzle-kit` (v0.31.8).
- **Rationale:** Neon provides the serverless scaling needed for Vercel; Drizzle offers superior type safety and cold-start performance compared to Prisma.

### Authentication & Security

- **Library:** **Better-Auth (v1.4.7)**.
- **Provider:** Google OAuth (Multi-account linking support required).
- **Session Strategy:** Database-backed sessions (secure, revokable) to support the "Parent Controller" security model.

### API & Communication Patterns

- **Architecture:** **API-First (Headless)** using Next.js Route Handlers (`/api/v1/...`).
- **State Sync:** **TanStack Query (v5)** with short polling (2-5s) and optimistic updates.
- **Rationale:** Decoupling the API ensures the backend can serve future clients (Native Mobile, Chatbots) without refactoring logic trapped in Server Actions.

### Frontend Architecture

- **Global State:** **Zustand** for client-only state (e.g., Animation Status, Hub View Mode).
- **Data Fetching:** **TanStack Query** for server state management, caching, and background revalidation.
- **UI System:** **Tailwind CSS 4** + **Radix UI** + **Framer Motion** (for the Extensible Reward Library).

### Infrastructure & Deployment

- **Host:** **Vercel** (Serverless).
- **Database Host:** **Neon**.
- **CI/CD:** GitHub Actions (running Vitest + Playwright).

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
5 key areas (Naming, Structure, Format, Communication, Process) where AI agents must align to prevent codebase fragmentation.

### Naming Patterns

**Database Naming Conventions:**

- **Tables:** `snake_case` (e.g., `user_accounts`, `chore_assignments`).
- **Columns:** `snake_case` (e.g., `created_at`, `is_active`).
- **Foreign Keys:** `noun_id` (e.g., `user_id`).

**API Naming Conventions:**

- **Endpoints:** Plural nouns, `kebab-case` (e.g., `/api/v1/chore-types`).
- **Query Params:** `camelCase` (e.g., `?startDate=...`).
- **JSON Fields:** `camelCase` (e.g., `{ "isActive": true }`).

**Code Naming Conventions:**

- **Files:** `kebab-case` (e.g., `date-utils.ts`, `chore-card.tsx`).
- **Components:** `PascalCase` (e.g., `ChoreCard`).
- **Variables/Functions:** `camelCase` (e.g., `fetchChores`).
- **Types/Interfaces:** `PascalCase` (e.g., `ChoreDefinition`).

### Structure Patterns

**Project Organization:**

- **Layer-Based:** Follow standard Next.js App Router conventions.
  - `/app`: Routes and Pages.
  - `/components`: Reusable UI components.
  - `/lib`: Shared utilities and helpers.
  - `/server`: Server-only logic (DB, Auth).
  - `/types`: Shared TypeScript definitions.

**File Structure Patterns:**

- **Co-location:** Unit tests live next to the file they test (`chore-utils.test.ts`).
- **Barrels:** Use `index.ts` only for public API exports from modules.

### Format Patterns

**API Response Formats:**

- **Success:** `{ "success": true, "data": { ... } }`
- **Error:** `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }`
- **Dates:** Always ISO 8601 Strings (`"2023-12-25T09:00:00Z"`).

**Data Exchange Formats:**

- **Booleans:** JSON `true`/`false` (never strings "true" or ints 0/1).
- **Nulls:** Use `null` for missing values, not `undefined` in JSON.

### Communication Patterns

**State Management Patterns:**

- **Server State:** Managed exclusively via **TanStack Query** hooks.
- **Client State:** Managed via **Zustand** stores (e.g., `useUIStore`).
- **No Prop Drilling:** Use stores or context for state deeper than 2 levels.

### Enforcement Guidelines

**All AI Agents MUST:**

1.  Verify the database schema in `drizzle/schema.ts` before writing SQL.
2.  Use the `ApiResponse<T>` type wrapper for all Route Handlers.
3.  Place all business logic in `/server` or `/lib`, keeping Route Handlers as thin controllers.

### Pattern Examples

**Good Example (API Handler):**

```typescript
// app/api/v1/chores/route.ts
import { db } from "@/server/db";
import { chores } from "@/server/schema";

export async function GET() {
  const result = await db.select().from(chores);
  return Response.json({ success: true, data: result });
}
```

**Anti-Pattern (Avoid):**

- Returning raw arrays directly from API endpoints.
- Writing complex business logic directly inside the `export async function POST()` body.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
family-planner-v3/
├── .github/ workflows/          # CI/CD (Vitest, Playwright)
├── drizzle/                    # Drizzle migrations and seed data
├── public/                     # Static assets & Service Worker
│   ├── sw.js                   # Serwist Service Worker
│   └── animations/             # Raw animation assets
├── src/
│   ├── app/                    # Next.js App Router (Routes & Layouts)
│   │   ├── (auth)/             # Better-Auth routes
│   │   ├── (hub)/              # Wall Hub views (Day/Week/Month/List)
│   │   ├── (parent)/           # Mobile Parent Controller
│   │   ├── api/ v1/            # API-First Route Handlers
│   │   │   ├── calendar/       # Google Sync endpoints
│   │   │   ├── routines/       # Timer/Prescription endpoints
│   │   │   └── rewards/        # Star/Animation endpoints
│   │   ├── globals.css
│   │   ├── layout.tsx          # Root PWA layout
│   │   └── manifest.ts         # PWA Manifest
│   ├── components/
│   │   ├── calendar/           # Shared calendar UI logic
│   │   ├── rewards/
│   │   │   └── animations/     # Extensible Animation Library
│   │   ├── routines/           # Timer UI components
│   │   └── ui/                 # Radix/Tailwind primitives
│   ├── hooks/                  # Custom TanStack Query & PWA hooks
│   ├── lib/                    # Shared client/server utils
│   ├── server/
│   │   ├── auth.ts             # Better-Auth configuration
│   │   ├── db/                 # Drizzle client & PostgreSQL (Neon) setup
│   │   ├── schema.ts           # Drizzle Schema (snake_case)
│   │   └── services/           # Business logic (Google API, Rewards)
│   ├── store/                  # Zustand stores (UI, Hub State)
│   ├── types/                  # Shared TypeScript definitions
│   └── middleware.ts           # Auth & PWA protection
├── e2e/                        # Playwright tests
├── next.config.ts              # Next.js/PWA config
├── package.json
└── tsconfig.json
```

### Architectural Boundaries

**API Boundaries:**
All external communication must happen through `/api/v1/` route handlers. The frontend (Hub/Parent) never queries the DB directly.

**Component Boundaries:**
UI components in `/components/ui/` must be pure and stateless. Feature logic is encapsulated in `/components/features/`.

**Service Boundaries:**
The `/server/services/` layer handles all side effects (e.g., calling Google API). Controllers in `/app/api/` simply orchestrate these services.

**Data Boundaries:**
Database schema is managed exclusively in `src/server/schema.ts` using `drizzle-orm`.

### Requirements to Structure Mapping

**Feature: Extensible Rewards (FR10/11)**

- Logic: `src/server/services/reward-service.ts`
- Visuals: `src/components/rewards/animations/` (Dynamic imports for extensibility)

**Feature: Proactive Timers (FR6)**

- Logic: `src/server/api/routines/timer/`
- State: `src/store/useHubStore.ts` (Zustand)

**Feature: Multi-Account Sync (FR1/2/17)**

- Logic: `src/server/services/google-sync.ts`
- Auth: `src/server/auth.ts` (Better-Auth account linking)

### Integration Points

**Internal Communication:**
Next.js Server Side Props → API Handlers → Services → Drizzle → Neon.

**External Integrations:**
Google OAuth (Better-Auth) and Google Calendar API (via Service Layer).

**Data Flow:**
TanStack Query polls `/api/v1/...`, triggering Service Layer revalidation from Google API/Neon.

## Architecture Validation Results

### Coherence Validation ✅

- **Decision Compatibility:** The stack (Next.js 16, Better-Auth, Drizzle, Neon) is fully compatible and optimized for Vercel Serverless deployment.
- **Pattern Consistency:** Naming and structural patterns align with industry standards for modern TypeScript applications.
- **Structure Alignment:** The directory layout provides clear boundaries between Auth, API, and the dual-interaction modes (Hub/Parent).

### Requirements Coverage Validation ✅

- **Functional Requirements:** All 21 capabilities identified in the PRD are architecturally supported, with clear mappings to the service layer and component library.
- **Non-Functional Requirements:** Sync latency targets are addressed via TanStack Query's optimistic updates; Offline mandates are supported by the Serwist PWA configuration.

### Implementation Readiness Validation ✅

- **Decision Completeness:** All critical pillars (Data, Auth, API, State) are documented with specific version targets.
- **Pattern Completeness:** Naming, Structure, and Format patterns are defined to prevent AI agent conflicts.

### Architecture Completeness Checklist

- [x] Project context thoroughly analyzed
- [x] Technical stack (Better-Auth, Drizzle, Neon) specified
- [x] Integration patterns (TanStack Query polling) defined
- [x] Naming and structure conventions established
- [x] Complete directory structure defined
- [x] Component boundaries established

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** HIGH

**Key Strengths:**

- **Serverless Optimized:** Maximum performance on Vercel without custom socket overhead.
- **Type Safety:** End-to-end TypeScript inference via Drizzle and Better-Auth.
- **Resilient:** PWA architecture ensures 24/7 "Wall Hub" availability.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow the `snake_case` DB / `camelCase` API naming convention strictly.
- Place business logic in `src/server/services/`, not directly in API Route Handlers.
- Use `src/server/schema.ts` as the single source of truth for the database.

**First Implementation Priority:**
Initialize the data layer using Drizzle and PostgreSQL (Neon).

```

```
