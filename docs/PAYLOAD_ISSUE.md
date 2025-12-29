# Payload CMS CLI Module Resolution Issue

## Problem Summary

The Payload CLI fails with `ERR_MODULE_NOT_FOUND` when trying to resolve TypeScript imports without explicit `.js` extensions.

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/www/experiments/family-planner-v3-project/src/payload/collections/Users'
imported from /var/www/experiments/family-planner-v3-project/src/payload.config.ts
```

## Environment

- **Node.js**: 22.x (after upgrading from 20.11.1 to fix undici issue)
- **Payload CMS**: 3.69.0
- **tsx**: 4.21.0
- **Next.js**: 16.1.0
- **Package Manager**: pnpm

## Previous Issue (Resolved)

On Node.js 20.x, the Payload CLI failed with an `undici` "Illegal constructor" error:

```
TypeError: Illegal constructor
    at new CacheStorage (undici/lib/web/cache/cachestorage.js:17:14)
```

This was resolved by upgrading to Node.js 22.x. See [GitHub Issue #13290](https://github.com/payloadcms/payload/issues/13290).

## Current Issue

After fixing the undici issue, the CLI now fails on module resolution. The Payload CLI uses `tsx` to load TypeScript, but tsx is not resolving extensionless imports despite:

1. `tsconfig.json` having `"moduleResolution": "bundler"`
2. The same configuration working in official Payload templates

## What We've Tried

### 1. Added `.js` Extensions to Imports

Changed imports from:

```typescript
import { Users } from "./payload/collections/Users";
```

to:

```typescript
import { Users } from "./payload/collections/Users.js";
```

**Result**: This works but shouldn't be necessary - official Payload templates use extensionless imports.

### 2. Compared with Official Blank Template

Checked [payload/templates/blank](https://github.com/payloadcms/payload/tree/main/templates/blank):

- Same `tsconfig.json` settings (`module: "esnext"`, `moduleResolution: "bundler"`)
- Same extensionless imports in `payload.config.ts`
- Config located at `src/payload.config.ts` (not project root)

### 3. Moved payload.config.ts to src/

Moved config from project root to `src/payload.config.ts` to match blank template structure.

Updated:

- Import paths: `./payload/collections/...`
- tsconfig `@payload-config` path: `./src/payload.config.ts`
- TypeScript output path in config

**Result**: Still fails with same module resolution error.

### 4. Added Webpack extensionAlias

Added to `next.config.ts` (from blank template):

```typescript
webpack: (webpackConfig) => {
  webpackConfig.resolve.extensionAlias = {
    ".cjs": [".cts", ".cjs"],
    ".js": [".ts", ".tsx", ".js", ".jsx"],
    ".mjs": [".mts", ".mjs"],
  };
  return webpackConfig;
},
```

**Result**: This is for Next.js/webpack bundling, doesn't affect CLI which uses tsx directly.

## Key Observations

1. **Next.js dev server works fine** - `pnpm dev` loads Payload correctly
2. **Only CLI is affected** - `pnpm payload migrate`, `pnpm payload --help`, etc.
3. **tsx is the loader** - Payload CLI uses `tsx/esm/api` to load TypeScript (see `node_modules/payload/bin.js`)
4. **Blank template should work the same** - but doesn't in our project

## Differences from Blank Template

| Aspect             | Blank Template          | Our Project                     |
| ------------------ | ----------------------- | ------------------------------- |
| Config location    | `src/payload.config.ts` | `src/payload.config.ts` (moved) |
| Database adapter   | MongoDB                 | PostgreSQL                      |
| Additional plugins | None                    | next-intl, nextra               |
| File structure     | Simple                  | Complex with route groups       |

## Potential Root Causes

1. **tsx version/configuration** - Maybe tsx needs specific configuration for our setup
2. **Monorepo/workspace behavior** - pnpm hoisting might affect module resolution
3. **Conflict with other plugins** - next-intl or nextra might interfere
4. **Node.js 22 specific** - Different ESM behavior than expected

## Workarounds

### Option A: Use `.js` Extensions

Add `.js` extensions to all imports in Payload-related files. Works but non-standard.

### Option B: Skip CLI, Use prodMigrations

Configure `prodMigrations` in `payload.config.ts` to run migrations on server init instead of via CLI.

**Note**: Payload docs warn this slows serverless cold starts on Vercel.

### Option C: Run Migrations Manually

Connect to Payload database and run SQL migrations directly, bypassing the CLI.

## Solution Found

**Root Cause**: Missing `"type": "module"` in package.json.

**Fix Applied**:

1. Added `"type": "module"` to package.json
2. Added `importMap.baseDir` to payload.config.ts (best practice)

**Verified Working**:

- ✅ Payload CLI on Node.js 20.11.1
- ✅ Payload CLI on Node.js 22.16.0
- ✅ Next.js dev server (Turbopack)

**Why It Works**:
Without `"type": "module"`, Payload CLI's tsx loader uses a hybrid CJS/ESM approach that:

1. Triggers the problematic CacheStorage constructor in undici (Node 20)
2. Uses a different module resolution path that doesn't handle extensionless `.ts` imports (Node 22)

With `"type": "module"`, the project runs in pure ESM mode, avoiding both issues.

Reference: [Payload GitHub issue #13290](https://github.com/payloadcms/payload/issues/13290)

## Related Links

- [Payload Migration Docs](https://payloadcms.com/docs/database/migrations)
- [Payload CLI undici issue #13290](https://github.com/payloadcms/payload/issues/13290)
- [ERR_MODULE_NOT_FOUND issue #14994](https://github.com/payloadcms/payload/issues/14994)
- [Payload Blank Template](https://github.com/payloadcms/payload/tree/main/templates/blank)
