# User Documentation Design

## Overview

Add a publicly visible user help center to Family Planner, integrated into the app at `/help`. The documentation targets parents setting up the app and covers account setup, Google Calendar linking, family management, and all major features.

## Decisions

| Decision           | Choice                                      |
| ------------------ | ------------------------------------------- |
| Primary audience   | Parents setting up the app                  |
| Framework          | Nextra 4 (Next.js docs framework)           |
| Hosting            | Subdirectory of main app (`/[locale]/help`) |
| Languages          | Dutch (nl) and English (en)                 |
| Help icon behavior | Direct links with hover hint                |

## Architecture

### Route Structure

```
/nl/help              → Dutch help home
/nl/help/getting-started
/nl/help/calendar
/nl/help/chores
/nl/help/rewards
/nl/help/wall-hub

/en/help              → English help home
/en/help/getting-started
/en/help/calendar
/en/help/chores
/en/help/rewards
/en/help/wall-hub
```

### Content Storage

Help content lives in MDX files under a new `content/help/` directory, separate from internal `docs/`:

```
content/
  help/
    nl/
      index.mdx
      getting-started.mdx
      calendar.mdx
      chores.mdx
      rewards.mdx
      wall-hub.mdx
    en/
      index.mdx
      getting-started.mdx
      calendar.mdx
      chores.mdx
      rewards.mdx
      wall-hub.mdx
```

### Technical Integration

- **Routing**: Catch-all route at `src/app/[locale]/help/[[...slug]]/page.tsx` renders Nextra content
- **i18n**: Uses existing `next-intl` locale from URL to load correct content directory
- **Theming**: Nextra themed to match Tailwind 4 + shadcn/ui design system (colors, typography, components)
- **Search**: Nextra's built-in FlexSearch for client-side full-text search

## Content Structure

### Home Page (`/help`)

- Welcome message
- Card grid linking to each section
- Search bar
- Quick links to common tasks ("Link Google Calendar", "Add a family member")

### Sections

| Section             | Pages | Key Topics                                                           |
| ------------------- | ----- | -------------------------------------------------------------------- |
| **Getting Started** | 4     | Account creation, Google OAuth linking, family setup, adding members |
| **Calendar**        | 3     | Viewing events, calendar views (day/week/month/agenda), birthdays    |
| **Chores & Stars**  | 3     | Creating chores, completing chores, star earnings                    |
| **Reward Store**    | 2     | Setting up rewards, redemption flow                                  |
| **Wall Hub**        | 2     | Enabling wall mode, display settings                                 |

**Total: ~14 pages across 5 sections**

### Page Template

Each help page follows a consistent structure:

1. Title + brief description
2. Prerequisites (if applicable)
3. Step-by-step instructions with screenshots
4. Tips / common questions
5. Related pages (next steps)

## In-App Help Integration

### HelpLink Component

Reusable component for contextual help links:

```tsx
<HelpLink page="calendar" />
// Renders: ? icon linking to /[locale]/help/calendar
// On hover: "Calendar help →"
```

**Props:**

- `page` - Help page slug (e.g., "getting-started", "calendar")
- `section` - Optional anchor for deep linking (e.g., "linking-google")
- `variant` - "icon" (just ?) or "text" ("Need help?")

### Placement

| Location             | Link Target                    | Notes                               |
| -------------------- | ------------------------------ | ----------------------------------- |
| Header nav           | `/help`                        | `?` icon next to settings gear      |
| Calendar page header | `/help/calendar`               | Icon next to view switcher          |
| Chores page header   | `/help/chores`                 | Icon in section header              |
| Star chart header    | `/help/chores#stars`           | Deep link to stars section          |
| Rewards page header  | `/help/rewards`                | Icon in section header              |
| Settings → Google    | `/help/getting-started#google` | "Learn more" link                   |
| Empty states         | Relevant page                  | e.g., "No chores yet" → setup guide |

### Mobile

On mobile, the header help icon moves to the hamburger menu or a dedicated "Help" menu item.

## Implementation Phases

### Phase 1: Infrastructure

- Install and configure Nextra 4
- Set up `content/help/` directory structure
- Create catch-all route at `/[locale]/help/[[...slug]]`
- Configure theming to match app design system
- Verify i18n routing works with `next-intl`

### Phase 2: Content

- Write all 14 help pages (English first, then Dutch)
- Add screenshots for key flows
- Set up sidebar navigation structure (`_meta.json` files)
- Test search functionality

### Phase 3: App Integration

- Create `HelpLink` component
- Add help icons to header, page headers, and settings
- Add contextual links in empty states
- Mobile nav adjustments
- QA all help links work correctly

## Dependencies

- `nextra` - Docs framework
- `nextra-theme-docs` - Default theme (will be customized)

## Files to Create/Modify

**New:**

- `content/help/` - All MDX content files
- `src/app/[locale]/help/[[...slug]]/page.tsx` - Catch-all route
- `src/components/ui/help-link.tsx` - HelpLink component

**Modify:**

- `next.config.ts` - Nextra configuration
- Header component - Add help icon
- Various page headers - Add contextual help icons
- Empty state components - Add help links
