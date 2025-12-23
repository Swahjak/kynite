# Theme Refresh Design

**Date:** 2025-12-23
**Goal:** Align theme and components with design mockups - more vibrant, more rounded, more playful

## Summary

The current theme implementation is more muted than the design files show. This refresh updates:

1. Color saturation (especially primary and event colors)
2. Border radius (larger base, more pill shapes)
3. Component styling (shadows, transitions, variants)
4. Brand guidelines documentation

## Section 1: Color System Updates

### Primary Color

```css
/* Current */
--primary: oklch(0.83 0.18 160);

/* Proposed - closer to exact #13ec92 */
--primary: oklch(0.87 0.22 160);
--primary-hover: oklch(0.82 0.2 158);
```

### Event Colors (more saturated backgrounds)

```css
/* Current: very pale (0.97 lightness, 0.02 chroma) */
/* Proposed: visible tint (0.95 lightness, 0.03-0.04 chroma) */

--event-blue-bg: oklch(0.95 0.03 240);
--event-blue-border: oklch(0.65 0.18 240);
--event-blue-text: oklch(0.45 0.15 240);

--event-purple-bg: oklch(0.95 0.03 300);
--event-purple-border: oklch(0.65 0.18 300);
--event-purple-text: oklch(0.45 0.15 300);

--event-orange-bg: oklch(0.95 0.04 70);
--event-orange-border: oklch(0.7 0.18 55);
--event-orange-text: oklch(0.5 0.15 55);

--event-green-bg: oklch(0.95 0.03 145);
--event-green-border: oklch(0.6 0.18 145);
--event-green-text: oklch(0.4 0.12 145);

--event-red-bg: oklch(0.95 0.03 25);
--event-red-border: oklch(0.65 0.2 25);
--event-red-text: oklch(0.5 0.18 25);

--event-yellow-bg: oklch(0.95 0.04 95);
--event-yellow-border: oklch(0.8 0.18 95);
--event-yellow-text: oklch(0.5 0.12 95);

--event-pink-bg: oklch(0.95 0.03 350);
--event-pink-border: oklch(0.7 0.18 350);
--event-pink-text: oklch(0.5 0.15 350);

--event-teal-bg: oklch(0.95 0.03 185);
--event-teal-border: oklch(0.65 0.15 185);
--event-teal-text: oklch(0.45 0.12 185);
```

### Status Colors (brighter)

```css
--status-success: oklch(0.7 0.18 145); /* was 0.65 */
--status-warning: oklch(0.8 0.18 55); /* was 0.75 */
--status-error: oklch(0.65 0.22 25); /* was 0.60 */
```

## Section 2: Border Radius Updates

### Base Radius Change

```css
/* Current */
--radius: 0.625rem; /* 10px */

/* Proposed */
--radius: 0.75rem; /* 12px */
```

### Resulting Scale

| Token          | New Value | Usage                        |
| -------------- | --------- | ---------------------------- |
| `--radius-sm`  | 8px       | Small elements               |
| `--radius-md`  | 10px      | Default                      |
| `--radius-lg`  | 12px      | Buttons, inputs, event cards |
| `--radius-xl`  | 16px      | Cards, panels                |
| `--radius-2xl` | 20px      | Large cards, modals          |
| `--radius-3xl` | 24px      | Extra large elements         |
| `--radius-4xl` | 28px      | Hero elements                |
| `full`         | 9999px    | Pills, chips, avatars        |

## Section 3: Component Updates

### High Priority

#### Button (`src/components/ui/button.tsx`)

- Add `shadow-sm` to default variant
- Add `active:scale-95` for press feedback
- Ensure `hover:bg-primary-hover` works

#### Card (`src/components/ui/card.tsx`)

- Add `shadow-sm` as default
- Update radius to use `rounded-2xl`

#### Badge (`src/components/ui/badge.tsx`)

- Change to `rounded-full` (pill shape)
- Add status variants: `now`, `today`, `overdue`

#### Avatar (`src/components/ui/avatar.tsx`)

- Update ring to use primary color
- Add `ring-2 ring-offset-2` pattern

#### Progress (`src/components/ui/progress.tsx`)

- Ensure track and fill use `rounded-full`
- Use primary for fill color

#### Tabs (`src/components/ui/tabs.tsx`)

- Update trigger to pill shape when active
- Add smooth transitions

#### Input (`src/components/ui/input.tsx`)

- Update to `rounded-xl`
- Focus ring uses primary color

#### Select (`src/components/ui/select.tsx`)

- Trigger: `rounded-xl`
- Dropdown: `shadow-md`, `rounded-xl`

### Medium Priority

#### Dialog (`src/components/ui/dialog.tsx`)

- Content: `rounded-2xl`, `shadow-lg`
- Smoother backdrop animation

#### Sheet (`src/components/ui/sheet.tsx`)

- Bottom variant: `rounded-t-2xl`
- Add handle indicator with primary accent

#### Dropdown Menu (`src/components/ui/dropdown-menu.tsx`)

- Content: `rounded-xl`, `shadow-md`
- Items: hover state improvements

#### Alert Dialog (`src/components/ui/alert-dialog.tsx`)

- Match Dialog updates
- Vibrant action button colors

#### Popover (`src/components/ui/popover.tsx`)

- Content: `rounded-xl`, `shadow-md`

#### Tooltip (`src/components/ui/tooltip.tsx`)

- Content: `rounded-lg`, slightly larger padding

### Lower Priority

#### Switch (`src/components/ui/switch.tsx`)

- Checked state uses primary
- Track more rounded

#### Checkbox (`src/components/ui/checkbox.tsx`)

- Check uses primary color
- `rounded-md` for box

#### Textarea (`src/components/ui/textarea.tsx`)

- Match Input styling

#### Slider (`src/components/ui/slider.tsx`)

- Thumb uses primary
- Track more rounded

### Custom Components

#### Sonner (`src/components/ui/sonner.tsx`)

- Toast: `rounded-xl`
- Status-colored left border accent

#### Avatar Group (`src/components/ui/avatar-group.tsx`)

- Primary overlap ring

## Section 4: Brand Guidelines Updates

### Files to Update

- `docs/brand-guideline.md`

### Changes Required

1. **Color System Section**
   - Confirm exact hex values match implementation
   - Document oklch equivalents

2. **Border Radius Section**
   - Update scale to reflect new base
   - Add usage examples for each size

3. **Components Section**
   - Add: Filter chips pattern
   - Add: Status badges (NOW, TODAY, OVERDUE)
   - Add: Event card with left border accent
   - Add: Quick action buttons grid

4. **Shadows Section**
   - Document when to use each level
   - `shadow-sm`: Cards, buttons
   - `shadow-md`: Dropdowns, popovers
   - `shadow-lg`: Modals, dialogs

## Implementation Order

1. **globals.css** - Update CSS variables (colors, radius)
2. **High priority components** - Button, Card, Badge, Avatar, Progress, Input
3. **Medium priority components** - Dialog, Sheet, Dropdown, etc.
4. **Lower priority components** - Switch, Checkbox, etc.
5. **Brand guidelines** - Update documentation
6. **Visual review** - Check existing pages for regressions

## Files Changed

### Theme

- `src/app/globals.css`

### Components (17 files)

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/avatar-group.tsx`

### Documentation

- `docs/brand-guideline.md`
