# Nextra + next-intl i18n Integration Issue

## Problem Summary

Integrating Nextra 4 documentation with an existing Next.js 16 app that uses next-intl for internationalization required careful configuration to avoid routing conflicts.

## Original Setup

- **Framework**: Next.js 16 with App Router
- **i18n**: next-intl with `[locale]` routing at app root (`src/app/[locale]/...`)
- **Locales**: `nl` (default), `en`
- **Goal**: Add Nextra-powered help documentation at `/help`

## Initial Approach (Failed)

### Attempt 1: Help under `[locale]` route

- Route: `src/app/[locale]/help/[[...slug]]/page.tsx`
- Content: `content/help/{locale}/*.mdx`
- Config: `contentDirBasePath: "/help"`

**Error**:

```
Error occurred prerendering page "/nl/help/help/en/chores"
TypeError: Cannot destructure property 'locale' of '(intermediate value)' as it is undefined.
```

The path showed double-nesting (`/nl/help/help/en/chores`) - Nextra's `generateStaticParamsFor` was including the full content directory structure in the slug.

### Attempt 2: Restructure content directory

- Moved content from `content/help/{locale}/*` to `content/{locale}/*`
- Same route structure

**Error**: Still got double paths like `/nl/help/nl` - Nextra was treating locale folders as content pages.

### Attempt 3: Custom `generateStaticParams`

- Replaced Nextra's `generateStaticParamsFor` with manual static params
- Explicit list of pages per locale

**Error**: Same `Cannot destructure property 'locale'` error persisted in `importPage`.

## Root Cause Analysis

The fundamental issue was that Nextra's internal code expects certain route param naming and structure:

1. **Route param naming**: Nextra expects `[locale]` or similar, but next-intl was already using `[locale]` at the app root
2. **Routing conflict**: Both next-intl middleware and Nextra were trying to handle locale routing
3. **`importPage` context**: Nextra's `importPage` function requires specific internal context that wasn't being set up correctly when nested under next-intl's routing

## Solution: Separate Help Routes from next-intl

### Key Changes

1. **Move help routes outside next-intl's scope**:
   - Old: `src/app/[locale]/help/[[...slug]]/page.tsx`
   - New: `src/app/help/[locale]/[[...slug]]/page.tsx`

2. **Skip help paths in proxy.ts** (next-intl middleware):

   ```typescript
   // Skip intl middleware for help docs (Nextra handles its own i18n)
   if (pathname.startsWith("/help")) {
     return NextResponse.next();
   }
   ```

3. **Add i18n config to Next.js config** (passed through `withNextra`):

   ```typescript
   const nextConfig: NextConfig = {
     // ...
     i18n: {
       locales: ["en", "nl"],
       defaultLocale: "en",
     },
   } as NextConfig & { i18n: { locales: string[]; defaultLocale: string } };
   ```

4. **Enable locale links in Nextra**:

   ```typescript
   const withNextra = nextra({
     contentDirBasePath: "/help",
     unstable_shouldAddLocaleToLinks: true,
   });
   ```

5. **Use `[locale]` as route param** (not `[lang]`):
   - Nextra internally expects the param to be named `locale`
   - Renamed from `[lang]` to `[locale]` in route structure

6. **Configure Layout with i18n**:
   ```typescript
   <Layout
     pageMap={pageMap}
     i18n={[
       { locale: "en", name: "English" },
       { locale: "nl", name: "Nederlands" },
     ]}
     // ...
   >
   ```

### Content Structure

```
content/
├── en/
│   ├── _meta.ts
│   ├── index.mdx
│   ├── getting-started.mdx
│   ├── calendar.mdx
│   ├── chores.mdx
│   ├── rewards.mdx
│   └── wall-hub.mdx
└── nl/
    ├── _meta.ts
    ├── index.mdx
    ├── getting-started.mdx
    ├── calendar.mdx
    ├── chores.mdx
    ├── rewards.mdx
    └── wall-hub.mdx
```

### URL Structure

- Help index: `/help/en` or `/help/nl`
- Help pages: `/help/en/getting-started`, `/help/nl/kalender`, etc.

### Additional Changes Required

- Updated MDX content links from `/en/help/...` to `/help/en/...`
- Updated `HelpLink` component to use `/help/${locale}` path
- Updated navigation menu help link to include locale

## Build Result

After implementing the solution, the build succeeds:

```
└ ● /help/[locale]/[[...slug]]
  ├ /help/en
  ├ /help/en/getting-started
  ├ /help/en/calendar
  └ [+9 more paths]
```

## Documentation References

- [Nextra i18n Guide](https://nextra.site/docs/guide/i18n)
- [Nextra contentDirBasePath](https://nextra.site/docs/file-conventions/content-directory)
- [GitHub Issue #4343 - Nextra 4 i18n bug](https://github.com/shuding/nextra/issues/4343)
- [GitHub Issue #3934 - i18n + static website](https://github.com/shuding/nextra/issues/3934)

## Styling Issue: CSS Conflicts

### Problem

After the routing fix, Nextra pages rendered without styling. The content displayed but without the Nextra theme's layout, sidebar, or typography.

### Root Cause

The root layout (`src/app/layout.tsx`) imported `globals.css` which contained Tailwind CSS base layer resets:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-body);
  }
}
```

These global styles conflicted with Nextra's theme CSS, overriding its styling.

### Solution: Route Groups

Used Next.js Route Groups to isolate the main app and Nextra docs with separate layouts:

```
src/app/
├── layout.tsx           # Minimal root layout (html/body only)
├── globals.css          # Tailwind CSS
├── (main)/              # Main app route group
│   ├── layout.tsx       # Imports globals.css, fonts
│   └── [locale]/        # All locale-based routes
└── (docs)/              # Docs route group
    └── help/[locale]/   # Nextra routes
        └── layout.tsx   # Imports nextra-theme-docs/style.css
```

**Key changes:**

1. **Root layout** (`src/app/layout.tsx`): Minimal, only provides `<html>` and `<body>` wrapper
2. **Main layout** (`src/app/(main)/layout.tsx`): Imports fonts and `globals.css`
3. **Docs layout** (`src/app/(docs)/help/[locale]/layout.tsx`): Imports Nextra CSS, no Tailwind interference

This ensures:

- Main app gets Tailwind CSS and custom fonts
- Nextra docs get Nextra's styling without CSS conflicts
- Both share the same root HTML structure

## Key Learnings

1. Nextra and next-intl have incompatible i18n approaches when routes overlap
2. The solution is to keep them on separate URL paths
3. Nextra expects specific route param naming (`locale`) for i18n
4. The `i18n` config must be in the Next.js config passed to `withNextra`, not in the `nextra()` options
5. `unstable_shouldAddLocaleToLinks` is needed for static site generation with i18n
6. Use Route Groups to isolate different CSS systems (Tailwind vs Nextra theme)
