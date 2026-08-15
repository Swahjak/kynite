---
name: Kynite
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#434656'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#747688'
  outline-variant: '#c4c5d9'
  surface-tint: '#124af0'
  primary: '#0040e0'
  on-primary: '#ffffff'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#b8c3ff'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#006056'
  on-tertiary: '#ffffff'
  tertiary-container: '#007b6e'
  on-tertiary-container: '#b1fff1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-hub:
    fontFamily: Hanken Grotesk
    fontSize: 72px
    fontWeight: '800'
    lineHeight: 80px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  tabular-num:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  touch-target: 48px
---

## Brand & Style

The design system is built on a "Functional Warmth" philosophy. It merges the systematic precision of high-end productivity tools (like Linear) with the nurturing, vibrant energy required for family life. The interface must feel like a reliable digital backbone that doesn't sacrifice the joy of shared milestones.

The aesthetic follows a **Modern-Tactile** approach:
- **Clarity:** High whitespace and rigorous alignment to reduce cognitive load for busy parents.
- **Playfulness:** Using subtle bounces, organic shapes, and a rich secondary palette to celebrate achievements.
- **Reliability:** A grounded primary color that suggests stability and professional-grade organization.
- **Dual-Context:** The UI must transition seamlessly from a dense "management" view on mobile to a high-visibility "glanceable" dashboard for wall-mounted tablets.

## Colors

The color system is designed for high-speed categorization. The **Primary Indigo** acts as the "command" color, used for primary actions and navigation. The **Warm Amber** is reserved strictly for positive reinforcement: streaks, stars, and rewards.

**Neutral Logic:**
- **Light Mode:** Uses a "Cream & Slate" foundation. Surfaces are `#FFFFFF` on a background of `#F8F9FA`.
- **Dark Mode:** Moves to a "Deep Charcoal" base rather than pure black to maintain softness. Surfaces use `#1E293B`.

**Category Palette:**
Each family member or event type is assigned one of the 8 category colors. Use the `bg` variant for large blocks (like calendar event backgrounds), the `border` for subtle separation, and the `base` color for text and icons to ensure WCAG AA legibility.

## Typography

This design system utilizes **Hanken Grotesk** for structural elements and **Inter** for readability.

- **The "Hub" View:** For wall-mounted tablets, use `display-hub`. This allows the current time or next event to be legible from across a room (2+ meters).
- **Tabular Figures:** For time pickers, countdowns, and chore points, always enable `tnum` (tabular numbers) to prevent layout jitter during updates.
- **Labels:** Use Hanken Grotesk in SemiBold or Bold for all buttons and labels to maintain a clean, geometric feel.

## Layout & Spacing

The system uses an **8px grid** (with a 4px sub-unit for tight components). 

- **Desktop/Tablet:** A 12-column fluid grid. On "Hub" views, use increased margins (48px+) to frame the content like a piece of home decor.
- **Mobile:** A standard 4-column grid with 24px side margins to prevent thumb-crowding.
- **Touch Safety:** Every interactive element (buttons, checkboxes, chips) must maintain a minimum hit area of 48x48px, regardless of the visual size of the icon or label.

## Elevation & Depth

We use **Tonal Layering** combined with **Soft Ambient Shadows** to define hierarchy.

- **Level 0 (Background):** Base surface color (Cream/Deep Slate).
- **Level 1 (Cards):** White/Dark Gray surfaces with a 1px border (`neutral-200`) and a subtle 4px blur shadow. 
- **Level 2 (Modals/Popovers):** Elevated with a 12px blur shadow, 0.1 opacity, and a slight Y-offset (4px) to simulate "lifting" off the family board.
- **Glassmorphism:** Use only for sticky headers and navigation bars (`backdrop-blur: 12px; opacity: 0.8`) to maintain context of the content scrolling beneath.

## Shapes

The shape language is approachable and soft. 
- **Cards & Containers:** Use `rounded-xl` (1.5rem) to evoke a friendly, modern feel.
- **Buttons & Inputs:** Use `rounded-lg` (1rem) for a standard "Modern" look.
- **Chips & Avatars:** Always use **Pill-shaped** (full radius) to distinguish individual family members and status tags from the structural grid of cards.

## Components

Following the **shadcn/ui (New York)** baseline, components are customized as follows:

- **Buttons:** Primary buttons use a solid Indigo fill. Secondary buttons use a thick 2px border and no fill. Use a `0.98` scale transform on `:active` to provide tactile feedback.
- **Chips:** Full pill-shaped. Categorized chips use the Category Palette `bg` and `base` text. Include a small "X" or icon that scales slightly on hover.
- **Input Fields:** Use a subtle background tint (`neutral-100`) and a 2px bottom border that expands on focus. Labels should be small, bold, and Hanken Grotesk.
- **Cards:** Cards are the primary unit of the "Hub." Every card should have a 1px soft border. For celebrations (e.g., "Chore Completed"), the card should support a "bouncy" entry animation using `spring` physics.
- **Checkboxes:** Larger than standard (24x24px visual) with a rounded-sm profile. On check, trigger a haptic-style "pop" animation and use the `green` category color.
- **Progress Bars:** Thick (8px) with fully rounded caps. For "Streaks," use the `secondary` gold color with a subtle shimmer effect.
