# ADR: Lucide Icon System

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Icon System Standardization

## Decision

Standardize on **Lucide React** as the sole icon library, removing Material Symbols.

## Context

The project used two icon systems:

- **Material Symbols** (Google Fonts CDN) - 5 files, homepage and reward chart
- **Lucide React** (npm package) - 77 files, UI components

Options considered:

1. **Keep both** - Maintain hybrid approach
2. **Standardize on Lucide** - Remove Material Symbols, align with shadcn/ui
3. **Standardize on Material** - Migrate Lucide usages to Material

## Rationale

We chose Lucide React because:

1. **shadcn/ui alignment** - components.json already specifies `"iconLibrary": "lucide"`
2. **Existing majority** - 77 files already use Lucide vs 5 for Material
3. **No CDN dependency** - Tree-shakeable npm package, no external font loading
4. **Simpler bundle** - Only imports used icons, no font file overhead
5. **TypeScript support** - Full type safety with LucideIcon type

## Consequences

### Positive

- Single icon system across entire codebase
- No external CDN dependency
- Smaller initial page load (no font download)
- Better TypeScript integration
- Consistent with shadcn/ui ecosystem

### Negative

- Some Material icons lack direct Lucide equivalents (e.g., dentistry → Smile)
- Migration effort for existing Material Symbols usages

## Implementation

- New Icon wrapper component at `src/components/ui/icon.tsx`
- Legacy mapping for existing database records
- Icon mapping table in implementation plan

## Related

- Implementation plan: `docs/plans/2025-12-25-lucide-icon-system.md`
- Icon component: `src/components/ui/icon.tsx`
- shadcn config: `components.json`
