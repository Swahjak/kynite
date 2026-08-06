---
name: Vibrant Kynite
colors:
  surface: '#f9f9ff'
  surface-dim: '#d6dae6'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff3ff'
  surface-container: '#e9eefa'
  surface-container-high: '#e4e8f4'
  surface-container-highest: '#dee2ee'
  on-surface: '#171c24'
  on-surface-variant: '#464556'
  inverse-surface: '#2c3139'
  inverse-on-surface: '#ecf1fd'
  outline: '#777588'
  outline-variant: '#c7c4d9'
  surface-tint: '#4d3cf2'
  primary: '#402ae7'
  on-primary: '#ffffff'
  primary-container: '#5a4cff'
  on-primary-container: '#edeaff'
  inverse-primary: '#c4c0ff'
  secondary: '#aa2c63'
  on-secondary: '#ffffff'
  secondary-container: '#fe6fa5'
  on-secondary-container: '#71003b'
  tertiary: '#005e49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00795f'
  on-tertiary-container: '#9bffdd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c4c0ff'
  on-primary-fixed: '#110069'
  on-primary-fixed-variant: '#3210dc'
  secondary-fixed: '#ffd9e2'
  secondary-fixed-dim: '#ffb0c8'
  on-secondary-fixed: '#3e001e'
  on-secondary-fixed-variant: '#8a0f4b'
  tertiary-fixed: '#75f9d1'
  tertiary-fixed-dim: '#55dcb6'
  on-tertiary-fixed: '#002118'
  on-tertiary-fixed-variant: '#00513f'
  background: '#f9f9ff'
  on-background: '#171c24'
  surface-variant: '#dee2ee'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  label-bold:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-sm: 1.5rem
  container-padding-lg: 3rem
  gutter: 24px
  stack-gap: 16px
---

## Brand & Style
The design system evolves into a playful, encouraging, and high-energy environment tailored for younger audiences and educational contexts. It balances a disciplined, organized core with a "soft-brutalist" friendliness. 

The aesthetic focuses on **Organic Geometricism**: combining highly rounded containers, tactile surfaces, and a vibrant color palette to evoke joy and safety. The UI should feel like a physical, bouncy workspace where every interaction is met with warmth and visual clarity.

## Colors
The palette is anchored by a **Vibrant Indigo** (#5A4CFF), pushed for higher saturation to ensure a sense of energy. This is supported by a secondary **Bubblegum Pink** for high-action callouts and a **Mint Green** for positive reinforcement.

Surface colors depart from stark whites, utilizing a suite of **Playful Pastels** for container backgrounds. These soft hues differentiate sections without the harshness of high-contrast dividers. Text remains a deep charcoal to maintain AAA accessibility against the pastel backdrops.

## Typography
**Hanken Grotesk** is used across all roles to leverage its clean, circular terminals and approachable character. 

Headings are intentionally heavy (`fontWeight: 800` or `700`) to provide a confident, "chunky" visual hierarchy that is easy for children to scan. Body text utilizes a medium weight (`500`) by default to ensure strokes are thick enough to remain legible against colorful backgrounds. Letter spacing is slightly tightened on large headings to keep the "bouncy" feel of the letters.

## Layout & Spacing
The layout follows a **Fluid organic model** with generous internal padding to prevent the UI from feeling cramped or overwhelming. 

- **Desktop:** 12-column grid with wide 32px gutters.
- **Mobile:** Single column with 24px side margins.
- **Rhythm:** Use an 8px base unit. Components should favor vertical stacking with large gaps (`stack-gap`) to allow for easy tap targets and clear visual separation of ideas.

## Elevation & Depth
This design system avoids traditional, blurry drop shadows in favor of **Tonal Layering** and **Soft-Offset Depth**. 

Depth is communicated through 2px or 4px solid-color offsets (in a slightly darker version of the surface color) rather than fuzzy black shadows. This creates a tactile, "sticker-like" effect. For interactive elements, use "Squishy Elevation": the element appears to sit high with an offset, then moves 2px down on press to simulate physical feedback.

## Shapes
The shape language is strictly **Ultra-Rounded**. All interactive elements—buttons, inputs, and tags—utilize a full pill shape (`rounded-full`). 

Large containers and cards use a minimum of `1.5rem` (24px) corner radius to ensure no sharp edges exist within the experience. This "bubbliness" is the primary visual differentiator, reinforcing the brand's friendly and safe personality.

## Components
- **Buttons:** High-contrast Indigo or Pink backgrounds with white bold text. Use a 4px bottom-offset border to give them a "clickable" 3D toy feel.
- **Cards:** Use pastel backgrounds (Lavender, Mint, etc.) with a 2px solid border in a slightly darker shade of the same hue.
- **Inputs:** Over-sized heights (56px minimum) with thick 2px borders. On focus, the border color should pulse with the primary Indigo.
- **Chips/Badges:** Use "Pill-style" shapes with bold, centered labels.
- **Selection Controls:** Checkboxes and Radio buttons are scaled up to 1.2x their standard size, with thick strokes and high-contrast "check" states to ensure clarity for developing motor skills.
- **Progress Bars:** Thick, rounded tracks with a vibrant contrasting fill, potentially using a subtle pattern (dots or stripes) within the fill for extra playfulness.