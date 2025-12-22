# Drizzle ORM + Better-Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install and configure Drizzle ORM with PostgreSQL and Better-Auth for the Family Planner Next.js 16 project.

**Architecture:** Local PostgreSQL via Docker Compose. Drizzle ORM with `postgres` driver for database access. Better-Auth handles email/password authentication with database-backed sessions. Auth API route lives outside i18n routing at `/api/auth/*`.

**Tech Stack:** Drizzle ORM 0.45.1, Better-Auth 1.4.7, PostgreSQL 16, Docker Compose, Next.js 16 App Router

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install production dependencies**

Run:

```bash
pnpm add drizzle-orm@0.45.1 better-auth@1.4.7 postgres
```

Expected: Packages added to dependencies in package.json

**Step 2: Install development dependencies**

Run:

```bash
pnpm add -D drizzle-kit@0.31.8
```

Expected: drizzle-kit added to devDependencies

**Step 3: Verify installation**

Run:

```bash
pnpm list drizzle-orm better-auth postgres drizzle-kit
```

Expected: All four packages listed with correct versions

---

## Task 2: Create Docker Compose for PostgreSQL

**Files:**

- Create: `docker-compose.yml`

**Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: family-planner-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: family_planner
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**Step 2: Start the database**

Run:

```bash
docker compose up -d
```

Expected: Container starts successfully

**Step 3: Verify database is running**

Run:

```bash
docker compose ps
```

Expected: `family-planner-db` shows status "Up" and healthy

---

## Task 3: Create Environment Configuration

**Files:**

- Create: `.env.example`
- Create: `.env.local`

**Step 1: Create .env.example (committed to git)**

```env
# Database Configuration
# Local Docker: postgresql://postgres:postgres@localhost:5432/family_planner
# Neon Production: postgresql://user:pass@host/db?sslmode=require
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_planner"

# Better-Auth Configuration
# Generate secret with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-secret-key-here-minimum-32-characters"
BETTER_AUTH_URL="http://localhost:3000"
```

**Step 2: Create .env.local (not committed)**

Run:

```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_planner"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="http://localhost:3000"
EOF
```

Then generate actual secret:

```bash
SECRET=$(openssl rand -base64 32)
sed -i "s|\$(openssl rand -base64 32)|$SECRET|" .env.local
```

**Step 3: Verify .env.local exists and has secret**

Run:

```bash
grep BETTER_AUTH_SECRET .env.local
```

Expected: Shows a 44-character base64 string

---

## Task 4: Create Drizzle Configuration

**Files:**

- Create: `drizzle.config.ts`

**Step 1: Create drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
  casing: "snake_case",
});
```

**Step 2: Verify config syntax**

Run:

```bash
pnpm tsc --noEmit drizzle.config.ts 2>&1 || echo "Config created (will validate after schema exists)"
```

Expected: No syntax errors (schema import error is expected until Task 6)

---

## Task 5: Create Database Client

**Files:**

- Create: `src/server/db/index.ts`

**Step 1: Create server directory structure**

Run:

```bash
mkdir -p src/server/db
```

**Step 2: Create src/server/db/index.ts**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Check your .env.local file."
  );
}

// Create postgres connection
const client = postgres(process.env.DATABASE_URL);

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
```

**Step 3: Verify file exists**

Run:

```bash
cat src/server/db/index.ts
```

Expected: File contents displayed

---

## Task 6: Create Database Schema

**Files:**

- Create: `src/server/schema.ts`

**Step 1: Create src/server/schema.ts**

```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

// ============================================================================
// Better-Auth Required Tables
// ============================================================================

/**
 * Users table - Core user information
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Sessions table - Active user sessions
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Accounts table - OAuth provider accounts (prepared for Google OAuth)
 */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    mode: "date",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Verifications table - Email verification and password reset tokens
 */
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm tsc --noEmit
```

Expected: No errors

---

## Task 7: Create Better-Auth Configuration

**Files:**

- Create: `src/server/auth.ts`

**Step 1: Create src/server/auth.ts**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Generate with: openssl rand -base64 32"
  );
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error(
    "BETTER_AUTH_URL is not set. Use http://localhost:3000 for dev."
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute cache
    },
  },

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  advanced: {
    generateId: () => crypto.randomUUID(),
  },

  trustedOrigins: [process.env.BETTER_AUTH_URL],
});

export type Auth = typeof auth;
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm tsc --noEmit
```

Expected: No errors

---

## Task 8: Create Auth API Route

**Files:**

- Create: `src/app/api/auth/[...all]/route.ts`

**Step 1: Create directory structure**

Run:

```bash
mkdir -p "src/app/api/auth/[...all]"
```

**Step 2: Create src/app/api/auth/[...all]/route.ts**

```typescript
import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

**Step 3: Verify TypeScript compiles**

Run:

```bash
pnpm tsc --noEmit
```

Expected: No errors

---

## Task 9: Add Database Scripts to package.json

**Files:**

- Modify: `package.json`

**Step 1: Read current package.json scripts section**

Run:

```bash
grep -A 20 '"scripts"' package.json | head -25
```

**Step 2: Add db scripts after existing scripts**

Add these scripts to package.json `"scripts"` section:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

**Step 3: Verify scripts added**

Run:

```bash
grep "db:" package.json
```

Expected: All four db scripts listed

---

## Task 10: Generate and Push Database Schema

**Step 1: Ensure database is running**

Run:

```bash
docker compose ps
```

Expected: postgres container is "Up"

**Step 2: Push schema to database**

Run:

```bash
pnpm db:push
```

Expected: Tables created successfully

**Step 3: Verify tables exist via Drizzle Studio**

Run:

```bash
pnpm db:studio &
```

Expected: Opens browser at https://local.drizzle.studio showing users, sessions, accounts, verifications tables

---

## Task 11: Final Verification

**Step 1: Start dev server**

Run:

```bash
pnpm dev
```

Expected: Server starts on http://localhost:3000 without errors

**Step 2: Test auth endpoint (in another terminal)**

Run:

```bash
curl http://localhost:3000/api/auth/get-session
```

Expected: `{"session":null,"user":null}`

**Step 3: Commit all changes**

Run:

```bash
git add -A
git status
```

Review staged files, then:

```bash
git commit -m "feat: add Drizzle ORM and Better-Auth configuration

- Add Docker Compose for local PostgreSQL
- Configure Drizzle ORM with postgres driver
- Add Better-Auth with email/password authentication
- Create database schema for users, sessions, accounts, verifications
- Add auth API route at /api/auth/*
- Add db:generate, db:migrate, db:push, db:studio scripts"
```

Expected: Commit created successfully

---

## Summary of Files Created

| File                                 | Purpose                           |
| ------------------------------------ | --------------------------------- |
| `docker-compose.yml`                 | Local PostgreSQL database         |
| `.env.example`                       | Environment template (committed)  |
| `.env.local`                         | Local environment (not committed) |
| `drizzle.config.ts`                  | Drizzle Kit configuration         |
| `src/server/db/index.ts`             | Database client                   |
| `src/server/schema.ts`               | Database schema                   |
| `src/server/auth.ts`                 | Better-Auth configuration         |
| `src/app/api/auth/[...all]/route.ts` | Auth API handler                  |

## Out of Scope (Future Tasks)

- Google OAuth configuration
- Client-side auth hooks (`useSession`)
- Protected routes middleware
- User profile UI
- Email verification with email provider
