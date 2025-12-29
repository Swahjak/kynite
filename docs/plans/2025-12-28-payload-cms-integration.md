# Payload CMS Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Payload CMS to manage frontend content (homepage, privacy policy, terms and conditions, pricing) with full i18n support.

**Architecture:** Payload CMS runs in a `(payload)` route group alongside the existing `(main)` app. It uses a **separate PostgreSQL database** (`DATABASE_URL_PAYLOAD`) to keep CMS data isolated from app data, avoiding migration conflicts between Drizzle Kit and Payload. Content collections support multiple locales (nl/en) and are fetched server-side for rendering.

**Tech Stack:** Payload CMS 3.x, @payloadcms/db-postgres, @payloadcms/richtext-lexical, separate PostgreSQL database

---

## Phase 1: Core Payload CMS Setup

### Task 1: Install Payload CMS Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install core Payload packages**

Run:

```bash
pnpm add payload @payloadcms/next @payloadcms/richtext-lexical @payloadcms/db-postgres graphql
```

**Step 2: Verify installation**

Run: `pnpm list payload`
Expected: Shows payload and related packages installed

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install Payload CMS dependencies"
```

---

### Task 2: Create Payload Configuration File

**Files:**

- Create: `payload.config.ts`
- Create: `src/payload/collections/Users.ts`

**Step 1: Create Payload admin users collection**

Create `src/payload/collections/Users.ts`:

```typescript
import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
  },
  auth: true,
  fields: [
    {
      name: "name",
      type: "text",
    },
  ],
};
```

**Step 2: Create payload.config.ts**

Create `payload.config.ts` in project root:

```typescript
import sharp from "sharp";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import { Users } from "./src/payload/collections/Users";

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor(),
  collections: [Users],
  secret: process.env.PAYLOAD_SECRET || "",
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL_PAYLOAD || "",
    },
  }),
  sharp,
  typescript: {
    outputFile: "src/payload/payload-types.ts",
  },
  localization: {
    locales: [
      { label: "Nederlands", code: "nl" },
      { label: "English", code: "en" },
    ],
    defaultLocale: "nl",
    fallback: true,
  },
});
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: No errors related to payload.config.ts

**Step 4: Commit**

```bash
git add payload.config.ts src/payload/
git commit -m "feat: add Payload CMS configuration with users collection"
```

---

### Task 3: Update TypeScript Configuration

**Files:**

- Modify: `tsconfig.json`

**Step 1: Add @payload-config path mapping**

In `tsconfig.json`, add to `compilerOptions.paths`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@payload-config": ["./payload.config.ts"]
    }
  }
}
```

**Step 2: Verify configuration**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add @payload-config path alias"
```

---

### Task 4: Update Next.js Configuration

**Files:**

- Modify: `next.config.ts`

**Step 1: Import and apply withPayload wrapper**

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import nextra from "nextra";
import { withPayload } from "@payloadcms/next/withPayload";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withNextra = nextra({
  contentDirBasePath: "/help",
  unstable_shouldAddLocaleToLinks: true,
});

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self'",
      "connect-src 'self' https://accounts.google.com https://*.googleapis.com wss://*.pusher.com https://*.pusherapp.com",
      "frame-src 'self' https://accounts.google.com",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Nextra i18n configuration
  i18n: {
    locales: ["en", "nl"],
    defaultLocale: "en",
  },
} as NextConfig & { i18n: { locales: string[]; defaultLocale: string } };

// Note: withPayload must be the outermost wrapper
export default withPayload(withNextIntl(withNextra(nextConfig)));
```

**Step 2: Verify Next.js builds**

Run: `pnpm build`
Expected: Build completes (may warn about missing routes, that's ok)

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore: integrate Payload CMS with Next.js config"
```

---

### Task 5: Create Payload Admin Route Group

**Files:**

- Create: `src/app/(payload)/admin/[[...segments]]/page.tsx`
- Create: `src/app/(payload)/admin/[[...segments]]/not-found.tsx`
- Create: `src/app/(payload)/admin/importMap.js`
- Create: `src/app/(payload)/layout.tsx`
- Create: `src/app/(payload)/api/[...slug]/route.ts`
- Create: `src/app/(payload)/api/graphql/route.ts`
- Create: `src/app/(payload)/api/graphql-playground/route.ts`

**Step 1: Create admin page**

Create `src/app/(payload)/admin/[[...segments]]/page.tsx`:

```typescript
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from "next";

import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({
  params,
  searchParams,
}: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const Page = ({ params, searchParams }: Args) =>
  RootPage({ config, params, searchParams, importMap });

export default Page;
```

**Step 2: Create admin not-found page**

Create `src/app/(payload)/admin/[[...segments]]/not-found.tsx`:

```typescript
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from "next";

import config from "@payload-config";
import { NotFoundPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({
  params,
  searchParams,
}: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const NotFound = ({ params, searchParams }: Args) =>
  NotFoundPage({ config, params, searchParams, importMap });

export default NotFound;
```

**Step 3: Create importMap**

Create `src/app/(payload)/admin/importMap.js`:

```javascript
export const importMap = {};
```

**Step 4: Create payload layout**

Create `src/app/(payload)/layout.tsx`:

```typescript
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { ServerFunctionClient } from "payload";

import config from "@payload-config";
import { RootLayout } from "@payloadcms/next/layouts";
import React from "react";

import { importMap } from "./admin/importMap";
import "./custom.scss";

type Args = {
  children: React.ReactNode;
};

const serverFunctions: ServerFunctionClient = async function (args) {
  "use server";
  const { default: payload } = await import("payload");
  return payload.serverFunction({ ...args, config, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunctions}>
    {children}
  </RootLayout>
);

export default Layout;
```

**Step 5: Create custom.scss (empty for now)**

Create `src/app/(payload)/custom.scss`:

```scss
// Custom Payload admin styles
```

**Step 6: Create REST API route**

Create `src/app/(payload)/api/[...slug]/route.ts`:

```typescript
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
```

**Step 7: Create GraphQL route**

Create `src/app/(payload)/api/graphql/route.ts`:

```typescript
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from "@payload-config";
import { GRAPHQL_POST } from "@payloadcms/next/routes";

export const POST = GRAPHQL_POST(config);
```

**Step 8: Create GraphQL playground route**

Create `src/app/(payload)/api/graphql-playground/route.ts`:

```typescript
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from "@payload-config";
import { GRAPHQL_PLAYGROUND_GET } from "@payloadcms/next/routes";

export const GET = GRAPHQL_PLAYGROUND_GET(config);
```

**Step 9: Verify structure**

Run: `ls -la src/app/\(payload\)/`
Expected: Shows layout.tsx, custom.scss, admin/, api/ directories

**Step 10: Commit**

```bash
git add src/app/\(payload\)/
git commit -m "feat: add Payload CMS admin routes"
```

---

### Task 6: Create Payload Database and Environment Variables

**Files:**

- Modify: `.env.local`
- Modify: `.env.example` (if exists)
- Modify: `docker-compose.yml` (if using Docker for local dev)

**Step 1: Create a separate PostgreSQL database for Payload**

If using Docker, add to `docker-compose.yml`:

```yaml
services:
  # ... existing db service ...

  db-payload:
    image: postgres:16-alpine
    container_name: kynite-payload-db
    environment:
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: payload
      POSTGRES_DB: payload
    ports:
      - "5433:5432"
    volumes:
      - payload_data:/var/lib/postgresql/data

volumes:
  # ... existing volumes ...
  payload_data:
```

Or create manually in your existing PostgreSQL:

```bash
psql -U postgres -c "CREATE DATABASE payload;"
```

**Step 2: Generate a secure secret**

Run:

```bash
openssl rand -base64 32
```

Copy the output.

**Step 3: Add environment variables to .env.local**

Add these lines to `.env.local`:

```
PAYLOAD_SECRET=<paste-generated-secret-here>
DATABASE_URL_PAYLOAD=postgresql://payload:payload@localhost:5433/payload
```

**Step 4: Update .env.example if it exists**

Add:

```
PAYLOAD_SECRET=<openssl rand -base64 32>
DATABASE_URL_PAYLOAD=postgresql://payload:payload@localhost:5433/payload
```

**Step 5: Start the Payload database (if using Docker)**

Run: `docker compose up -d db-payload`
Expected: Payload database container running on port 5433

**Step 6: Commit docker-compose.yml and .env.example only**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add Payload CMS database configuration"
```

---

### Task 7: Test Payload Admin Panel

**Step 1: Ensure Payload database is running**

Run: `docker compose up -d db-payload` (if using Docker)

**Step 2: Start development server**

Run: `pnpm dev`

**Step 3: Access admin panel**

Open: `http://localhost:3000/admin`
Expected: Payload CMS setup screen to create first admin user

**Step 4: Create admin user**

Fill in email and password, submit form.
Expected: Redirected to Payload admin dashboard

**Step 5: Verify database tables in Payload database**

Connect to Payload database and check tables:

```bash
psql postgresql://payload:payload@localhost:5433/payload -c "\dt"
```

Expected: See `users`, `payload_migrations`, and other Payload tables

---

## Phase 2: Content Collections

### Task 8: Create Media Collection

**Files:**

- Create: `src/payload/collections/Media.ts`
- Modify: `payload.config.ts`

**Step 1: Create Media collection**

Create `src/payload/collections/Media.ts`:

```typescript
import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: () => true,
  },
  upload: {
    staticDir: "public/media",
    mimeTypes: ["image/*", "video/*", "application/pdf"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        height: 300,
        position: "centre",
      },
      {
        name: "card",
        width: 768,
        height: 1024,
        position: "centre",
      },
      {
        name: "hero",
        width: 1920,
        height: undefined,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      localized: true,
      required: true,
    },
  ],
};
```

**Step 2: Add Media to payload.config.ts**

Update imports and collections array:

```typescript
import { Media } from "./src/payload/collections/Media";

export default buildConfig({
  // ...existing config
  collections: [Users, Media],
  // ...
});
```

**Step 3: Create public/media directory**

Run: `mkdir -p public/media && echo "*\n!.gitkeep" > public/media/.gitignore`

**Step 4: Verify in admin panel**

Restart dev server, go to `/admin`, check Media collection appears in sidebar.

**Step 5: Commit**

```bash
git add src/payload/collections/Media.ts payload.config.ts public/media/.gitignore
git commit -m "feat: add Media collection for Payload CMS"
```

---

### Task 9: Create Pages Collection

**Files:**

- Create: `src/payload/collections/Pages.ts`
- Modify: `payload.config.ts`

**Step 1: Create Pages collection with slug blacklist**

Create `src/payload/collections/Pages.ts`:

```typescript
import type { CollectionConfig } from "payload";

// Reserved slugs that conflict with existing app routes
const RESERVED_SLUGS = [
  // Auth & onboarding
  "login",
  "onboarding",
  "join",
  "link-account",
  // App routes
  "dashboard",
  "calendar",
  "chores",
  "rewards",
  "reward-chart",
  "timers",
  "settings",
  "device",
  // System routes
  "admin",
  "api",
  "help",
];

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "status", "updatedAt"],
  },
  access: {
    read: () => true,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
        description: `Reserved slugs: ${RESERVED_SLUGS.join(", ")}`,
      },
      validate: (value) => {
        if (!value) return "Slug is required";
        if (RESERVED_SLUGS.includes(value.toLowerCase())) {
          return `"${value}" is a reserved slug. Please choose a different one.`;
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return "Slug must be lowercase alphanumeric with hyphens only";
        }
        return true;
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.title) {
              return data.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            }
            return value;
          },
        ],
      },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "content",
      type: "richText",
      localized: true,
    },
    {
      name: "meta",
      type: "group",
      fields: [
        {
          name: "description",
          type: "textarea",
          localized: true,
        },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
        },
      ],
    },
  ],
};
```

**Step 2: Add to payload.config.ts**

```typescript
import { Pages } from "./src/payload/collections/Pages";

export default buildConfig({
  collections: [Users, Media, Pages],
  // ...
});
```

**Step 3: Regenerate types**

Run: `pnpm dev` (Payload generates types on startup)
Expected: `src/payload/payload-types.ts` is created/updated

**Step 4: Commit**

```bash
git add src/payload/collections/Pages.ts payload.config.ts src/payload/payload-types.ts
git commit -m "feat: add Pages collection with i18n support"
```

---

### Task 10: Create Homepage Blocks

**Files:**

- Create: `src/payload/blocks/HeroBlock.ts`
- Create: `src/payload/blocks/FeaturesBlock.ts`
- Create: `src/payload/blocks/PricingBlock.ts`
- Create: `src/payload/blocks/CtaBlock.ts`
- Create: `src/payload/blocks/index.ts`
- Modify: `src/payload/collections/Pages.ts`

**Step 1: Create HeroBlock**

Create `src/payload/blocks/HeroBlock.ts`:

```typescript
import type { Block } from "payload";

export const HeroBlock: Block = {
  slug: "hero",
  labels: {
    singular: "Hero Section",
    plural: "Hero Sections",
  },
  fields: [
    {
      name: "badge",
      type: "text",
      localized: true,
    },
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      localized: true,
    },
    {
      name: "primaryCta",
      type: "group",
      fields: [
        { name: "label", type: "text", required: true, localized: true },
        { name: "href", type: "text", required: true },
      ],
    },
    {
      name: "secondaryCta",
      type: "group",
      fields: [
        { name: "label", type: "text", localized: true },
        { name: "href", type: "text" },
      ],
    },
    {
      name: "previewLabel",
      type: "text",
      localized: true,
    },
  ],
};
```

**Step 2: Create FeaturesBlock**

Create `src/payload/blocks/FeaturesBlock.ts`:

```typescript
import type { Block } from "payload";

export const FeaturesBlock: Block = {
  slug: "features",
  labels: {
    singular: "Features Section",
    plural: "Features Sections",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "subtitle",
      type: "textarea",
      localized: true,
    },
    {
      name: "features",
      type: "array",
      minRows: 1,
      fields: [
        {
          name: "icon",
          type: "text",
          required: true,
          admin: {
            description:
              "Lucide icon name (e.g., 'Calendar', 'Users', 'CheckCircle')",
          },
        },
        {
          name: "title",
          type: "text",
          required: true,
          localized: true,
        },
        {
          name: "description",
          type: "textarea",
          required: true,
          localized: true,
        },
      ],
    },
  ],
};
```

**Step 3: Create PricingBlock**

Create `src/payload/blocks/PricingBlock.ts`:

```typescript
import type { Block } from "payload";

export const PricingBlock: Block = {
  slug: "pricing",
  labels: {
    singular: "Pricing Section",
    plural: "Pricing Sections",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "subtitle",
      type: "textarea",
      localized: true,
    },
    {
      name: "tiers",
      type: "array",
      minRows: 1,
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          localized: true,
        },
        {
          name: "price",
          type: "number",
          required: true,
        },
        {
          name: "currency",
          type: "text",
          defaultValue: "EUR",
        },
        {
          name: "period",
          type: "text",
          defaultValue: "/month",
          localized: true,
        },
        {
          name: "description",
          type: "textarea",
          localized: true,
        },
        {
          name: "featured",
          type: "checkbox",
          defaultValue: false,
        },
        {
          name: "features",
          type: "array",
          fields: [
            {
              name: "text",
              type: "text",
              required: true,
              localized: true,
            },
          ],
        },
        {
          name: "cta",
          type: "group",
          fields: [
            { name: "label", type: "text", required: true, localized: true },
            { name: "href", type: "text", required: true },
          ],
        },
      ],
    },
  ],
};
```

**Step 4: Create CtaBlock**

Create `src/payload/blocks/CtaBlock.ts`:

```typescript
import type { Block } from "payload";

export const CtaBlock: Block = {
  slug: "cta",
  labels: {
    singular: "CTA Section",
    plural: "CTA Sections",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "description",
      type: "textarea",
      localized: true,
    },
    {
      name: "button",
      type: "group",
      fields: [
        { name: "label", type: "text", required: true, localized: true },
        { name: "href", type: "text", required: true },
        {
          name: "variant",
          type: "select",
          options: [
            { label: "Primary", value: "default" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
          ],
          defaultValue: "default",
        },
      ],
    },
  ],
};
```

**Step 5: Create blocks index**

Create `src/payload/blocks/index.ts`:

```typescript
export { HeroBlock } from "./HeroBlock";
export { FeaturesBlock } from "./FeaturesBlock";
export { PricingBlock } from "./PricingBlock";
export { CtaBlock } from "./CtaBlock";
```

**Step 6: Add blocks to Pages collection**

Update `src/payload/collections/Pages.ts`, add blocks field:

```typescript
import { HeroBlock, FeaturesBlock, PricingBlock, CtaBlock } from "../blocks";

// Add to fields array:
{
  name: "layout",
  type: "blocks",
  blocks: [HeroBlock, FeaturesBlock, PricingBlock, CtaBlock],
  localized: true,
}
```

**Step 7: Restart dev server and verify**

Run: `pnpm dev`
Go to `/admin/collections/pages`, create new page, verify blocks are available.

**Step 8: Commit**

```bash
git add src/payload/blocks/ src/payload/collections/Pages.ts
git commit -m "feat: add homepage content blocks (hero, features, pricing, cta)"
```

---

## Phase 3: Content API & Frontend Integration

### Task 11: Create Payload Data Fetching Utilities

**Files:**

- Create: `src/lib/payload.ts`

**Step 1: Create payload utility**

Create `src/lib/payload.ts`:

```typescript
import { getPayload } from "payload";
import config from "@payload-config";
import type { Page } from "@/payload/payload-types";

export async function getPayloadClient() {
  return getPayload({ config });
}

export async function getPageBySlug(
  slug: string,
  locale: "nl" | "en" = "nl"
): Promise<Page | null> {
  const payload = await getPayloadClient();

  const { docs } = await payload.find({
    collection: "pages",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
    },
    locale,
    limit: 1,
  });

  return docs[0] || null;
}

export async function getHomepage(
  locale: "nl" | "en" = "nl"
): Promise<Page | null> {
  return getPageBySlug("home", locale);
}
```

**Step 2: Verify TypeScript**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/payload.ts
git commit -m "feat: add Payload data fetching utilities"
```

---

### Task 12: Create CMS-Powered Block Components

**Files:**

- Create: `src/components/cms/HeroSection.tsx`
- Create: `src/components/cms/FeaturesSection.tsx`
- Create: `src/components/cms/PricingSection.tsx`
- Create: `src/components/cms/CtaSection.tsx`
- Create: `src/components/cms/BlockRenderer.tsx`
- Create: `src/components/cms/index.ts`

**Step 1: Create CMS HeroSection**

Create `src/components/cms/HeroSection.tsx`:

```typescript
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Hand } from "lucide-react";
import type { Page } from "@/payload/payload-types";

type HeroBlock = Extract<NonNullable<Page["layout"]>[number], { blockType: "hero" }>;

interface HeroSectionProps {
  block: HeroBlock;
}

export function HeroSection({ block }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="relative z-10 container mx-auto px-4 text-center md:px-6">
        {block.badge && (
          <div className="bg-card text-muted-foreground mb-6 inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium shadow-sm">
            <span className="bg-primary mr-2 flex h-2 w-2 animate-pulse rounded-full" />
            {block.badge}
          </div>
        )}

        <h1 className="font-display mx-auto mb-6 max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight md:text-6xl lg:text-7xl">
          {block.title}
        </h1>

        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-relaxed md:text-xl">
          {block.description}
        </p>

        <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {block.primaryCta && (
            <Button asChild size="lg" className="w-full rounded-xl sm:w-auto">
              <Link href={block.primaryCta.href}>{block.primaryCta.label}</Link>
            </Button>
          )}
          {block.secondaryCta?.label && block.secondaryCta?.href && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full rounded-xl sm:w-auto"
            >
              <Link href={block.secondaryCta.href}>{block.secondaryCta.label}</Link>
            </Button>
          )}
        </div>

        {/* Dashboard Preview placeholder */}
        <div className="bg-card relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-xl border shadow-2xl md:aspect-[2/1]">
          <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
            {block.previewLabel && (
              <p className="text-foreground flex items-center gap-2 rounded-full border border-white/50 bg-white/90 px-6 py-3 text-sm font-semibold shadow-xl backdrop-blur-md">
                <Icon icon={Hand} className="text-primary" />
                {block.previewLabel}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="from-primary/5 via-background to-background absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]" />
    </section>
  );
}
```

**Step 2: Create remaining CMS components**

(Similar pattern for FeaturesSection, PricingSection, CtaSection - adapting existing components to accept block props)

**Step 3: Create BlockRenderer**

Create `src/components/cms/BlockRenderer.tsx`:

```typescript
import type { Page } from "@/payload/payload-types";
import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { PricingSection } from "./PricingSection";
import { CtaSection } from "./CtaSection";

interface BlockRendererProps {
  blocks: Page["layout"];
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  if (!blocks) return null;

  return (
    <>
      {blocks.map((block, index) => {
        switch (block.blockType) {
          case "hero":
            return <HeroSection key={index} block={block} />;
          case "features":
            return <FeaturesSection key={index} block={block} />;
          case "pricing":
            return <PricingSection key={index} block={block} />;
          case "cta":
            return <CtaSection key={index} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}
```

**Step 4: Create index file**

Create `src/components/cms/index.ts`:

```typescript
export { BlockRenderer } from "./BlockRenderer";
export { HeroSection } from "./HeroSection";
export { FeaturesSection } from "./FeaturesSection";
export { PricingSection } from "./PricingSection";
export { CtaSection } from "./CtaSection";
```

**Step 5: Commit**

```bash
git add src/components/cms/
git commit -m "feat: add CMS-powered block components"
```

---

### Task 13: Update Homepage to Use CMS Content

**Files:**

- Modify: `src/app/(main)/[locale]/page.tsx`
- Modify: `src/app/(main)/[locale]/home-content.tsx`

**Step 1: Update page.tsx to fetch CMS data**

Update `src/app/(main)/[locale]/page.tsx`:

```typescript
import { setRequestLocale } from "next-intl/server";
import { type Locale } from "@/i18n/routing";
import { getHomepage } from "@/lib/payload";
import { BlockRenderer } from "@/components/cms";
import { HomepageHeader, HomepageFooter } from "@/components/homepage";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const page = await getHomepage(locale as "nl" | "en");

  return (
    <div className="flex min-h-screen flex-col">
      <HomepageHeader />
      <main className="flex-1">
        {page?.layout ? (
          <BlockRenderer blocks={page.layout} />
        ) : (
          <div className="container mx-auto py-20 text-center">
            <p className="text-muted-foreground">
              Homepage content not configured. Please set up the homepage in the CMS.
            </p>
          </div>
        )}
      </main>
      <HomepageFooter />
    </div>
  );
}
```

**Step 2: Remove old home-content.tsx (optional, can keep as fallback)**

Run: `git rm src/app/\(main\)/\[locale\]/home-content.tsx`

**Step 3: Verify homepage loads**

Run: `pnpm dev`
Open: `http://localhost:3000`
Expected: Shows "Homepage content not configured" message (CMS content not yet added)

**Step 4: Commit**

```bash
git add src/app/\(main\)/\[locale\]/page.tsx
git commit -m "feat: integrate CMS content into homepage"
```

---

### Task 14: Migrate Homepage Content to CMS

**Files:**

- Create: `scripts/seed-homepage.ts`

**Step 1: Create seed script that migrates content from translation files**

Create `scripts/seed-homepage.ts`:

```typescript
import { getPayload } from "payload";
import config from "../payload.config";
import nlMessages from "../messages/nl.json";
import enMessages from "../messages/en.json";

async function seed() {
  const payload = await getPayload({ config });

  // Check if homepage already exists
  const existing = await payload.find({
    collection: "pages",
    where: { slug: { equals: "home" } },
  });

  if (existing.docs.length > 0) {
    console.log("Homepage already exists, skipping seed");
    return;
  }

  const nl = nlMessages.HomePage;
  const en = enMessages.HomePage;

  // Create homepage with Dutch content (default locale)
  const page = await payload.create({
    collection: "pages",
    locale: "nl",
    data: {
      title: "Kynite",
      slug: "home",
      status: "published",
      layout: [
        {
          blockType: "hero",
          badge: nl.hero.badge,
          title: nl.hero.title,
          description: nl.hero.description,
          primaryCta: {
            label: nl.hero.cta,
            href: "/login",
          },
          secondaryCta: {
            label: nl.hero.ctaSecondary,
            href: "/dashboard",
          },
          previewLabel: nl.hero.previewLabel,
        },
        {
          blockType: "features",
          title: nl.features.title,
          subtitle: nl.features.subtitle,
          features: [
            {
              icon: "Calendar",
              title: nl.features.calendar.title,
              description: nl.features.calendar.description,
            },
            {
              icon: "Gamepad2",
              title: nl.features.routines.title,
              description: nl.features.routines.description,
            },
            {
              icon: "UtensilsCrossed",
              title: nl.features.meals.title,
              description: nl.features.meals.description,
            },
          ],
        },
        {
          blockType: "pricing",
          title: nl.pricing.title,
          subtitle: nl.pricing.subtitle,
          tiers: [
            {
              name: nl.pricing.free.name,
              price: Number(nl.pricing.free.price),
              currency: "EUR",
              period: nl.pricing.perMonth,
              description: nl.pricing.free.description,
              featured: false,
              features: nl.pricing.free.features.map((text) => ({ text })),
              cta: { label: nl.pricing.free.cta, href: "/login" },
            },
            {
              name: nl.pricing.basic.name,
              price: Number(nl.pricing.basic.price),
              currency: "EUR",
              period: nl.pricing.perMonth,
              description: nl.pricing.basic.description,
              featured: true,
              features: nl.pricing.basic.features.map((text) => ({ text })),
              cta: { label: nl.pricing.basic.cta, href: "/login" },
            },
            {
              name: nl.pricing.pro.name,
              price: Number(nl.pricing.pro.price),
              currency: "EUR",
              period: nl.pricing.perMonth,
              description: nl.pricing.pro.description,
              featured: false,
              features: nl.pricing.pro.features.map((text) => ({ text })),
              cta: { label: nl.pricing.pro.cta, href: "/login" },
            },
          ],
        },
        {
          blockType: "cta",
          title: nl.cta.title,
          description: nl.cta.description,
          button: {
            label: nl.cta.button,
            href: "/login",
            variant: "default",
          },
        },
      ],
    },
  });

  // Update with English translations
  await payload.update({
    collection: "pages",
    id: page.id,
    locale: "en",
    data: {
      title: "Kynite",
      layout: [
        {
          blockType: "hero",
          badge: en.hero.badge,
          title: en.hero.title,
          description: en.hero.description,
          primaryCta: {
            label: en.hero.cta,
            href: "/login",
          },
          secondaryCta: {
            label: en.hero.ctaSecondary,
            href: "/dashboard",
          },
          previewLabel: en.hero.previewLabel,
        },
        {
          blockType: "features",
          title: en.features.title,
          subtitle: en.features.subtitle,
          features: [
            {
              icon: "Calendar",
              title: en.features.calendar.title,
              description: en.features.calendar.description,
            },
            {
              icon: "Gamepad2",
              title: en.features.routines.title,
              description: en.features.routines.description,
            },
            {
              icon: "UtensilsCrossed",
              title: en.features.meals.title,
              description: en.features.meals.description,
            },
          ],
        },
        {
          blockType: "pricing",
          title: en.pricing.title,
          subtitle: en.pricing.subtitle,
          tiers: [
            {
              name: en.pricing.free.name,
              price: Number(en.pricing.free.price),
              currency: "EUR",
              period: en.pricing.perMonth,
              description: en.pricing.free.description,
              featured: false,
              features: en.pricing.free.features.map((text) => ({ text })),
              cta: { label: en.pricing.free.cta, href: "/login" },
            },
            {
              name: en.pricing.basic.name,
              price: Number(en.pricing.basic.price),
              currency: "EUR",
              period: en.pricing.perMonth,
              description: en.pricing.basic.description,
              featured: true,
              features: en.pricing.basic.features.map((text) => ({ text })),
              cta: { label: en.pricing.basic.cta, href: "/login" },
            },
            {
              name: en.pricing.pro.name,
              price: Number(en.pricing.pro.price),
              currency: "EUR",
              period: en.pricing.perMonth,
              description: en.pricing.pro.description,
              featured: false,
              features: en.pricing.pro.features.map((text) => ({ text })),
              cta: { label: en.pricing.pro.cta, href: "/login" },
            },
          ],
        },
        {
          blockType: "cta",
          title: en.cta.title,
          description: en.cta.description,
          button: {
            label: en.cta.button,
            href: "/login",
            variant: "default",
          },
        },
      ],
    },
  });

  console.log("Homepage migrated successfully with nl and en content!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
```

**Step 2: Add migration script to package.json**

Add to scripts:

```json
"cms:migrate-homepage": "tsx scripts/seed-homepage.ts"
```

**Step 3: Run migration script**

Run: `pnpm cms:migrate-homepage`
Expected: "Homepage migrated successfully with nl and en content!"

**Step 4: Verify homepage in both locales**

Open: `http://localhost:3000/nl` and `http://localhost:3000/en`
Expected: Homepage displays with correct locale-specific content from CMS

**Step 5: Verify in CMS admin**

Open: `http://localhost:3000/admin/collections/pages`
Expected: See "Kynite" page with "home" slug, switch locale dropdown to verify nl/en content

**Step 6: Commit**

```bash
git add scripts/seed-homepage.ts package.json
git commit -m "feat: migrate homepage content from i18n to CMS"
```

---

## Phase 4: Additional Pages

### Task 15: Create Privacy Policy Page

**Step 1: In CMS admin panel, create new page**

- Title: "Privacybeleid" / "Privacy Policy"
- Slug: "privacy"
- Status: Published
- Content: Add rich text content for privacy policy

**Step 2: Create catch-all page route**

Create `src/app/(main)/[locale]/[slug]/page.tsx`:

```typescript
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { type Locale } from "@/i18n/routing";
import { getPageBySlug } from "@/lib/payload";
import { HomepageHeader, HomepageFooter } from "@/components/homepage";
import { RichText } from "@/components/cms/RichText";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const page = await getPageBySlug(slug, locale as "nl" | "en");

  if (!page) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <HomepageHeader />
      <main className="container mx-auto flex-1 px-4 py-16">
        <h1 className="mb-8 text-4xl font-bold">{page.title}</h1>
        {page.content && <RichText content={page.content} />}
      </main>
      <HomepageFooter />
    </div>
  );
}
```

**Step 3: Create RichText component for Lexical content**

Create `src/components/cms/RichText.tsx`:

```typescript
import {
  type SerializedEditorState,
  type SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical";

interface RichTextProps {
  content: SerializedEditorState;
}

export function RichText({ content }: RichTextProps) {
  if (!content?.root?.children) return null;

  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      {content.root.children.map((node, index) => (
        <RenderNode key={index} node={node} />
      ))}
    </div>
  );
}

function RenderNode({ node }: { node: SerializedLexicalNode }) {
  // Implement node rendering based on Lexical node types
  // This is a simplified version - expand as needed
  if (node.type === "paragraph") {
    return (
      <p>
        {(node as any).children?.map((child: any, i: number) =>
          child.type === "text" ? child.text : null
        )}
      </p>
    );
  }

  if (node.type === "heading") {
    const Tag = `h${(node as any).tag}` as keyof JSX.IntrinsicElements;
    return (
      <Tag>
        {(node as any).children?.map((child: any, i: number) =>
          child.type === "text" ? child.text : null
        )}
      </Tag>
    );
  }

  return null;
}
```

**Step 4: Commit**

```bash
git add src/app/\(main\)/\[locale\]/\[slug\]/ src/components/cms/RichText.tsx
git commit -m "feat: add dynamic page routing for CMS pages"
```

---

## Summary

This plan integrates Payload CMS into the existing Next.js application with:

1. **Core Setup**: Payload CMS with PostgreSQL adapter, admin panel at `/admin`
2. **Separate Database**: Dedicated PostgreSQL database (`DATABASE_URL_PAYLOAD`) isolates CMS data from app data, avoiding Drizzle/Payload migration conflicts
3. **Collections**: Users (auth), Media (uploads), Pages (content)
4. **Blocks**: Hero, Features, Pricing, CTA sections for flexible page building
5. **i18n**: Full localization support matching existing nl/en setup
6. **Frontend**: CMS-powered components that replace static homepage content
7. **Extensibility**: Dynamic routing for privacy, terms, and future pages

**Next steps after implementation:**

- Add Terms & Conditions page via CMS
- Add more block types as needed (testimonials, FAQ, etc.)
- Set up Payload access control for content editors
- Configure media CDN for production
- Set up production Payload database (e.g., Neon, Supabase, or managed PostgreSQL)

---

## Appendix A: Vercel Deployment & Migrations

### Known Issue: Payload CLI on Node 20.x

The Payload CLI has a known compatibility issue with `undici@7.x` on Node.js 20.x that causes "Illegal constructor" errors. See [GitHub Issue #13290](https://github.com/payloadcms/payload/issues/13290).

**This means `pnpm payload migrate` will NOT work in the build script.**

### Solution: Automatic Migrations on Server Init

For Vercel deployments, use Payload's `prodMigrations` feature to run migrations automatically when the server initializes:

**Step 1: Generate migrations locally (development)**

When you make schema changes locally (where Node 22+ or a fixed environment works), generate migrations:

```bash
pnpm payload migrate:create
```

This creates migration files in `src/payload/migrations/`.

**Step 2: Configure prodMigrations in payload.config.ts**

Update `payload.config.ts`:

```typescript
import { migrations } from "./src/payload/migrations";

export default buildConfig({
  // ...existing config
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL_PAYLOAD || "",
    },
    prodMigrations: migrations, // Auto-run migrations on init
  }),
});
```

**Step 3: Export migrations index**

Create `src/payload/migrations/index.ts`:

```typescript
import * as migration_20241228_initial from "./20241228_initial";

export const migrations = [migration_20241228_initial];
```

### Homepage Seeding via onInit Hook

Instead of a separate `cms:migrate-homepage` script (which can't run on Vercel), use Payload's `onInit` hook:

**Update payload.config.ts:**

```typescript
import { seedHomepage } from "./src/payload/seed/homepage";

export default buildConfig({
  // ...existing config
  onInit: async (payload) => {
    // Check if homepage exists, seed if not
    const existing = await payload.find({
      collection: "pages",
      where: { slug: { equals: "home" } },
      limit: 1,
    });

    if (existing.docs.length === 0) {
      await seedHomepage(payload);
      payload.logger.info("Homepage seeded successfully");
    }
  },
});
```

**Create `src/payload/seed/homepage.ts`:**

Move the seeding logic from `scripts/seed-homepage.ts` to this file, accepting `payload` as a parameter instead of calling `getPayload()`.

### Vercel Environment Variables

Ensure these are set in Vercel project settings:

```
PAYLOAD_SECRET=<generate with: openssl rand -base64 32>
DATABASE_URL_PAYLOAD=<production PostgreSQL connection string>
```

### Build Script

The build script does NOT need to run Payload migrations:

```json
"build": "drizzle-kit migrate && turbo run build:next"
```

Payload migrations run automatically on first server request via `prodMigrations`.
