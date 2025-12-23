# Kynite Branding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebrand the application from "Family Planner" to "Kynite" with new logo assets (two figures reaching for a star), favicon, PWA manifest, and updated brand guidelines.

**Architecture:** Colorize the traced SVG logo (two figures + star). Create logo variants for different use cases. Update all translation files, metadata, components, and tests to use new brand name "Kynite" with tagline "Routines without the friction".

**Tech Stack:** Next.js 16, SVG manipulation, next-intl translations, PWA manifest, sharp for PNG generation

---

## Logo Analysis

The new logo shows **two cartoon figures reaching up together toward a golden star** with sparkle rays. It represents collaboration, family togetherness, and achievement.

**Source files:**

- `docs/design/logo/logo-colorized.svg` - **Master colorized logo (COMPLETED)**
- `docs/design/logo/logo.png` - Reference image
- `docs/design/logo/logo.svg` - Original traced outline

**Colors (matching brand-guidelines):**

- Figures: Primary brand color (`#13ec92`)
- Star + Sparkles: Golden (`#D4A84B`)

**SVG Structure (logo-colorized.svg):**

- Figures group: Solid green fills (first sub-paths only)
- Star + sparkles group: Gold fills rendered on top
- Optimized viewBox: `130 100 250 300`

---

## Phase 1: Logo Asset Creation

### Task 1: Colorize Master SVG ✅ COMPLETE

**Status:** Already completed in previous session.

**File:** `docs/design/logo/logo-colorized.svg`

**Implementation notes:**

- Figures use `#13ec92` (primary brand color) with solid fills
- Star + sparkles use `#D4A84B` (golden) with solid fills
- Uses first sub-path extraction for solid silhouettes (no internal holes)
- Top-left sparkle has stroke-width="56" to fill internal gaps
- Main star has stroke-width="80" to cover green edges underneath
- Optimized viewBox: `130 100 250 300`

---

### Task 2: Create Logo Icon SVG (With Dark Background)

**Files:**

- Source: `docs/design/logo/logo-colorized.svg`
- Create: `public/images/logo-icon.svg`

**Step 1: Create logo icon with dark rounded rectangle background**

This version wraps the colorized logo content with a dark background matching the original design:

```svg
<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<!-- Dark rounded rectangle background (matches original logo.png) -->
<rect width="400" height="400" rx="60" ry="60" fill="#10221a"/>

<!-- Logo content from logo-colorized.svg, scaled to fit -->
<svg x="40" y="55" width="320" height="290" viewBox="130 100 250 300">
<g transform="translate(0,500) scale(0.1,-0.1)">

<!-- FIGURES: Solid green silhouettes -->
<g fill="#13ec92" stroke="none">
<path d="M2477 3437 c-15 -12 -29 -29 -31 -37 -7 -34 -52 -136 -63 -143 -8 -5
-128 -20 -165 -21 -10 0 -18 -4 -18 -9 0 -4 -4 -6 -9 -3 -10 6 -23 -18 -26
-46 -3 -20 15 -39 78 -88 25 -19 50 -43 56 -53 18 -27 -4 -93 -37 -114 -15
-10 -32 -22 -37 -28 -12 -12 -56 -106 -56 -120 0 -5 -6 -17 -13 -25 -6 -8 -18
-28 -26 -45 -23 -47 -50 -60 -50 -25 0 27 -40 108 -70 143 -71 83 -193 105
-298 55 -49 -23 -130 -102 -134 -132 -2 -22 -5 -31 -13 -49 -11 -26 1 -126 20
-164 8 -17 31 -48 50 -69 19 -21 35 -39 35 -39 0 -1 -24 -27 -52 -57 -72 -75
-80 -86 -72 -100 5 -7 3 -8 -6 -3 -10 6 -12 4 -7 -8 3 -9 2 -16 -4 -14 -5 1
-27 -36 -48 -83 -81 -178 -89 -233 -42 -281 16 -16 39 -29 52 -29 35 0 86 37
104 78 47 104 42 97 48 70 6 -27 4 -76 -9 -243 -13 -177 -11 -211 16 -240 13
-13 38 -29 56 -35 29 -10 39 -8 75 12 45 25 65 56 74 114 4 22 8 48 10 59 2
11 4 27 4 36 1 9 7 16 15 16 9 0 16 -17 20 -46 17 -124 64 -191 134 -191 43 0
88 35 98 77 8 28 0 241 -19 551 -7 105 -9 192 -5 192 4 0 15 15 24 33 9 17 20
34 23 37 13 10 80 117 104 165 65 128 111 255 94 255 -8 0 -7 4 3 10 8 5 11
10 5 10 -5 1 4 7 20 14 17 7 37 20 45 27 48 46 87 43 164 -11 24 -16 45 -28
47 -25 2 2 5 -15 6 -37 1 -44 41 -158 54 -158 5 0 9 -7 9 -16 0 -18 41 -97 53
-102 4 -2 7 -10 7 -18 0 -8 5 -14 11 -14 5 0 7 -4 4 -10 -3 -5 -2 -10 3 -10 5
0 18 -17 27 -37 15 -32 35 -62 73 -107 7 -9 3 -136 -18 -502 -7 -122 -10 -232
-6 -245 12 -47 41 -71 89 -76 38 -4 52 -1 80 22 35 26 42 40 52 111 8 55 25
104 35 104 5 0 7 -7 4 -15 -4 -8 -1 -15 6 -15 6 0 9 -4 6 -8 -6 -10 16 -98 35
-142 16 -36 83 -72 116 -64 13 4 20 11 16 17 -3 5 -1 7 5 3 6 -3 23 5 39 20
l28 26 -3 122 c-2 66 -7 161 -11 210 -5 49 -5 100 -2 114 7 24 9 21 34 -32 51
-106 107 -132 169 -78 27 25 31 35 30 74 -3 60 -63 212 -130 323 -39 64 -48
76 -96 115 -41 33 -42 45 -6 70 48 34 78 104 78 180 -1 36 -6 79 -12 97 -14
40 -71 108 -112 133 -50 32 -169 45 -210 24 -14 -8 -32 -14 -39 -14 -28 0
-105 -93 -127 -154 -13 -33 -22 -65 -20 -71 1 -5 -7 1 -19 15 -23 27 -71 116
-75 139 -2 8 -13 28 -25 44 -12 16 -15 26 -8 22 8 -4 0 6 -17 23 -16 16 -40
32 -51 36 -13 4 -21 15 -21 29 0 12 -2 32 -5 43 -4 17 11 36 74 93 43 40 78
77 76 84 -2 12 -27 41 -36 43 -3 0 -13 4 -21 7 -8 4 -47 8 -86 10 -83 3 -96
13 -120 84 -17 53 -61 133 -72 133 -4 0 -20 -10 -35 -23z"/>
<path d="M2048 3138 c-34 -12 -46 -54 -21 -74 10 -7 20 -14 23 -14 3 0 11 -4
19 -9 11 -7 10 -14 -5 -39 -14 -25 -16 -36 -6 -56 18 -40 52 -42 110 -6 57 35
72 62 47 86 -13 13 -29 15 -73 11 -31 -3 -50 -3 -40 0 9 2 21 17 28 33 10 25
9 31 -9 49 -12 12 -21 18 -21 15 0 -4 -6 -2 -12 3 -8 7 -23 7 -40 1z"/>
<path d="M2800 3037 c-14 -7 -26 -21 -28 -31 -5 -23 38 -64 58 -58 8 3 12 1 8
-3 -10 -10 37 -35 66 -35 22 0 48 31 53 64 5 28 -23 53 -65 61 -20 3 -44 8
-52 10 -8 3 -26 -1 -40 -8z"/>
<path d="M2477 2813 c-8 -10 -18 -39 -22 -64 -9 -60 6 -89 45 -89 40 0 53 28
45 93 -10 76 -34 97 -68 60z"/>
</g>

<!-- STAR + SPARKLES: Gold filled -->
<g fill="#D4A84B" stroke="none">
<path d="M2766 3503 c-3 -10 -16 -30 -30 -44 -27 -29 -51 -70 -48 -81 1 -5 -3
-8 -9 -8 -5 0 -7 -4 -4 -10 3 -5 2 -10 -3 -10 -14 0 -3 -37 14 -51 18 -15 64
7 115 53 78 72 86 123 25 152 -43 20 -53 20 -60 -1z"/>
<path d="M2325 3496 c-20 -15 -33 -62 -13 -50 6 4 8 3 5 -3 -7 -11 36 -63 52
-63 15 0 41 42 41 65 -1 24 -33 65 -52 65 -8 0 -23 -6 -33 -14z"/>
<path fill="#D4A84B" stroke="#D4A84B" stroke-width="56" stroke-linejoin="round" d="M2176 3476 c-42 -38 -34 -68 30 -123 62 -53 94 -70 94 -49 0 12 -37
47 -113 108 -21 16 -21 17 -3 37 11 12 24 21 30 21 17 -1 101 -142 99 -165 -2
-17 -1 -17 11 4 10 18 11 32 3 57 -6 18 -14 31 -19 28 -4 -3 -8 4 -8 15 0 23
-63 91 -85 91 -8 0 -25 -11 -39 -24z"/>
<path d="M2855 3370 c-47 -18 -64 -73 -30 -96 29 -19 58 -11 84 22 19 24 19
28 5 49 -19 29 -33 35 -59 25z"/>
<path fill="#D4A84B" stroke="#D4A84B" stroke-width="80" stroke-linejoin="round" d="M2516 3413 c3 -10 21 -60 41 -110 l35 -93 46 0 c87 0 182 -13 182 -24 -1 -6 -24 -28 -53 -49 -29
-21 -67 -50 -85 -66 l-32 -28 25 -104 c14 -57 25 -107 25 -111 0 -16 -21 -6
-102 47 -45 30 -88 55 -94 55 -6 0 -50 -25 -99 -55 -85 -54 -105 -63 -105 -47
0 4 10 43 21 87 35 132 36 129 -58 199 -45 34 -82 66 -82 73 -1 7 37 13 114
18 67 4 118 12 123 19 7 12 34 82 59 159 17 49 30 59 39 30z"/>
</g>

</g>
</svg>
</svg>
```

**Step 2: Commit**

```bash
git add public/images/logo-icon.svg
git commit -m "feat: add logo icon SVG with dark rounded background"
```

---

### Task 3: Create Favicon SVG (Star Only)

**Files:**

- Source: `docs/design/logo/logo-colorized.svg` (star paths)
- Create: `public/favicon.svg`

**Step 1: Extract just the star + sparkles for favicon**

The star scales well at small sizes. Use the golden paths from the colorized logo:

```svg
<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
<!-- Dark background for visibility -->
<rect width="64" height="64" rx="12" ry="12" fill="#10221a"/>
<!-- Star + sparkles from logo-colorized.svg -->
<svg x="4" y="4" width="56" height="56" viewBox="130 100 250 300">
<g transform="translate(0,500) scale(0.1,-0.1)">
<g fill="#D4A84B" stroke="none">
<path d="M2766 3503 c-3 -10 -16 -30 -30 -44 -27 -29 -51 -70 -48 -81 1 -5 -3
-8 -9 -8 -5 0 -7 -4 -4 -10 3 -5 2 -10 -3 -10 -14 0 -3 -37 14 -51 18 -15 64
7 115 53 78 72 86 123 25 152 -43 20 -53 20 -60 -1z"/>
<path d="M2325 3496 c-20 -15 -33 -62 -13 -50 6 4 8 3 5 -3 -7 -11 36 -63 52
-63 15 0 41 42 41 65 -1 24 -33 65 -52 65 -8 0 -23 -6 -33 -14z"/>
<path fill="#D4A84B" stroke="#D4A84B" stroke-width="56" stroke-linejoin="round" d="M2176 3476 c-42 -38 -34 -68 30 -123 62 -53 94 -70 94 -49 0 12 -37
47 -113 108 -21 16 -21 17 -3 37 11 12 24 21 30 21 17 -1 101 -142 99 -165 -2
-17 -1 -17 11 4 10 18 11 32 3 57 -6 18 -14 31 -19 28 -4 -3 -8 4 -8 15 0 23
-63 91 -85 91 -8 0 -25 -11 -39 -24z"/>
<path d="M2855 3370 c-47 -18 -64 -73 -30 -96 29 -19 58 -11 84 22 19 24 19
28 5 49 -19 29 -33 35 -59 25z"/>
<path fill="#D4A84B" stroke="#D4A84B" stroke-width="80" stroke-linejoin="round" d="M2516 3413 c3 -10 21 -60 41 -110 l35 -93 46 0 c87 0 182 -13 182 -24 -1 -6 -24 -28 -53 -49 -29
-21 -67 -50 -85 -66 l-32 -28 25 -104 c14 -57 25 -107 25 -111 0 -16 -21 -6
-102 47 -45 30 -88 55 -94 55 -6 0 -50 -25 -99 -55 -85 -54 -105 -63 -105 -47
0 4 10 43 21 87 35 132 36 129 -58 199 -45 34 -82 66 -82 73 -1 7 37 13 114
18 67 4 118 12 123 19 7 12 34 82 59 159 17 49 30 59 39 30z"/>
</g>
</g>
</svg>
</svg>
```

**Step 2: Commit**

```bash
git add public/favicon.svg
git commit -m "feat: add golden star favicon SVG"
```

---

### Task 4: Create Horizontal Logo SVG

**Files:**

- Source: `docs/design/logo/logo-colorized.svg`
- Create: `public/images/logo-horizontal.svg`

**Step 1: Create horizontal layout with icon and text**

Uses the full colorized logo content with "KYNITE" text in primary brand color:

```svg
<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="80" viewBox="0 0 280 80">
  <!-- Dark background -->
  <rect width="80" height="80" rx="12" ry="12" fill="#10221a"/>

  <!-- Logo icon from logo-colorized.svg -->
  <svg x="8" y="10" width="64" height="58" viewBox="130 100 250 300">
    <g transform="translate(0,500) scale(0.1,-0.1)" stroke="none">
      <!-- Figures (primary brand color) -->
      <g fill="#13ec92">
        <path d="M2477 3437 c-15 -12 -29 -29 -31 -37 -7 -34 -52 -136 -63 -143 -8 -5 -128 -20 -165 -21 -10 0 -18 -4 -18 -9 0 -4 -4 -6 -9 -3 -10 6 -23 -18 -26 -46 -3 -20 15 -39 78 -88 25 -19 50 -43 56 -53 18 -27 -4 -93 -37 -114 -15 -10 -32 -22 -37 -28 -12 -12 -56 -106 -56 -120 0 -5 -6 -17 -13 -25 -6 -8 -18 -28 -26 -45 -23 -47 -50 -60 -50 -25 0 27 -40 108 -70 143 -71 83 -193 105 -298 55 -49 -23 -130 -102 -134 -132 -2 -22 -5 -31 -13 -49 -11 -26 1 -126 20 -164 8 -17 31 -48 50 -69 19 -21 35 -39 35 -39 0 -1 -24 -27 -52 -57 -72 -75 -80 -86 -72 -100 5 -7 3 -8 -6 -3 -10 6 -12 4 -7 -8 3 -9 2 -16 -4 -14 -5 1 -27 -36 -48 -83 -81 -178 -89 -233 -42 -281 16 -16 39 -29 52 -29 35 0 86 37 104 78 47 104 42 97 48 70 6 -27 4 -76 -9 -243 -13 -177 -11 -211 16 -240 13 -13 38 -29 56 -35 29 -10 39 -8 75 12 45 25 65 56 74 114 4 22 8 48 10 59 2 11 4 27 4 36 1 9 7 16 15 16 9 0 16 -17 20 -46 17 -124 64 -191 134 -191 43 0 88 35 98 77 8 28 0 241 -19 551 -7 105 -9 192 -5 192 4 0 15 15 24 33 9 17 20 34 23 37 13 10 80 117 104 165 65 128 111 255 94 255 -8 0 -7 4 3 10 8 5 11 10 5 10 -5 1 4 7 20 14 17 7 37 20 45 27 48 46 87 43 164 -11 24 -16 45 -28 47 -25 2 2 5 -15 6 -37 1 -44 41 -158 54 -158 5 0 9 -7 9 -16 0 -18 41 -97 53 -102 4 -2 7 -10 7 -18 0 -8 5 -14 11 -14 5 0 7 -4 4 -10 -3 -5 -2 -10 3 -10 5 0 18 -17 27 -37 15 -32 35 -62 73 -107 7 -9 3 -136 -18 -502 -7 -122 -10 -232 -6 -245 12 -47 41 -71 89 -76 38 -4 52 -1 80 22 35 26 42 40 52 111 8 55 25 104 35 104 5 0 7 -7 4 -15 -4 -8 -1 -15 6 -15 6 0 9 -4 6 -8 -6 -10 16 -98 35 -142 16 -36 83 -72 116 -64 13 4 20 11 16 17 -3 5 -1 7 5 3 6 -3 23 5 39 20 l28 26 -3 122 c-2 66 -7 161 -11 210 -5 49 -5 100 -2 114 7 24 9 21 34 -32 51 -106 107 -132 169 -78 27 25 31 35 30 74 -3 60 -63 212 -130 323 -39 64 -48 76 -96 115 -41 33 -42 45 -6 70 48 34 78 104 78 180 -1 36 -6 79 -12 97 -14 40 -71 108 -112 133 -50 32 -169 45 -210 24 -14 -8 -32 -14 -39 -14 -28 0 -105 -93 -127 -154 -13 -33 -22 -65 -20 -71 1 -5 -7 1 -19 15 -23 27 -71 116 -75 139 -2 8 -13 28 -25 44 -12 16 -15 26 -8 22 8 -4 0 6 -17 23 -16 16 -40 32 -51 36 -13 4 -21 15 -21 29 0 12 -2 32 -5 43 -4 17 11 36 74 93 43 40 78 77 76 84 -2 12 -27 41 -36 43 -3 0 -13 4 -21 7 -8 4 -47 8 -86 10 -83 3 -96 13 -120 84 -17 53 -61 133 -72 133 -4 0 -20 -10 -35 -23z"/>
        <path d="M2048 3138 c-34 -12 -46 -54 -21 -74 10 -7 20 -14 23 -14 3 0 11 -4 19 -9 11 -7 10 -14 -5 -39 -14 -25 -16 -36 -6 -56 18 -40 52 -42 110 -6 57 35 72 62 47 86 -13 13 -29 15 -73 11 -31 -3 -50 -3 -40 0 9 2 21 17 28 33 10 25 9 31 -9 49 -12 12 -21 18 -21 15 0 -4 -6 -2 -12 3 -8 7 -23 7 -40 1z"/>
        <path d="M2800 3037 c-14 -7 -26 -21 -28 -31 -5 -23 38 -64 58 -58 8 3 12 1 8 -3 -10 -10 37 -35 66 -35 22 0 48 31 53 64 5 28 -23 53 -65 61 -20 3 -44 8 -52 10 -8 3 -26 -1 -40 -8z"/>
        <path d="M2477 2813 c-8 -10 -18 -39 -22 -64 -9 -60 6 -89 45 -89 40 0 53 28 45 93 -10 76 -34 97 -68 60z"/>
      </g>
      <!-- Star (golden) -->
      <g fill="#D4A84B">
        <path d="M2766 3503 c-3 -10 -16 -30 -30 -44 -27 -29 -51 -70 -48 -81 1 -5 -3 -8 -9 -8 -5 0 -7 -4 -4 -10 3 -5 2 -10 -3 -10 -14 0 -3 -37 14 -51 18 -15 64 7 115 53 78 72 86 123 25 152 -43 20 -53 20 -60 -1z"/>
        <path d="M2325 3496 c-20 -15 -33 -62 -13 -50 6 4 8 3 5 -3 -7 -11 36 -63 52 -63 15 0 41 42 41 65 -1 24 -33 65 -52 65 -8 0 -23 -6 -33 -14z"/>
        <path fill="#D4A84B" stroke="#D4A84B" stroke-width="56" stroke-linejoin="round" d="M2176 3476 c-42 -38 -34 -68 30 -123 62 -53 94 -70 94 -49 0 12 -37 47 -113 108 -21 16 -21 17 -3 37 11 12 24 21 30 21 17 -1 101 -142 99 -165 -2 -17 -1 -17 11 4 10 18 11 32 3 57 -6 18 -14 31 -19 28 -4 -3 -8 4 -8 15 0 23 -63 91 -85 91 -8 0 -25 -11 -39 -24z"/>
        <path d="M2855 3370 c-47 -18 -64 -73 -30 -96 29 -19 58 -11 84 22 19 24 19 28 5 49 -19 29 -33 35 -59 25z"/>
        <path fill="#D4A84B" stroke="#D4A84B" stroke-width="80" stroke-linejoin="round" d="M2516 3413 c3 -10 21 -60 41 -110 l35 -93 46 0 c87 0 182 -13 182 -24 -1 -6 -24 -28 -53 -49 -29 -21 -67 -50 -85 -66 l-32 -28 25 -104 c14 -57 25 -107 25 -111 0 -16 -21 -6 -102 47 -45 30 -88 55 -94 55 -6 0 -50 -25 -99 -55 -85 -54 -105 -63 -105 -47 0 4 10 43 21 87 35 132 36 129 -58 199 -45 34 -82 66 -82 73 -1 7 37 13 114 18 67 4 118 12 123 19 7 12 34 82 59 159 17 49 30 59 39 30z"/>
      </g>
    </g>
  </svg>

  <!-- KYNITE text in primary brand color -->
  <text x="92" y="52" font-family="Lexend, Arial, sans-serif" font-size="36" font-weight="700" fill="#13ec92">KYNITE</text>
</svg>
```

**Step 2: Commit**

```bash
git add public/images/logo-horizontal.svg
git commit -m "feat: add horizontal logo with KYNITE text"
```

---

### Task 5: Generate PNG Assets

**Files:**

- Create: `public/icon-192x192.png`
- Create: `public/icon-512x512.png`
- Create: `public/apple-icon.png`
- Create: `public/favicon.ico`
- Create: `public/og-image.png`

**Step 1: Create icon generation script**

Create `scripts/generate-icons.mjs`:

```javascript
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const publicDir = "./public";

async function generateIcons() {
  // Read SVGs
  const logoSvg = readFileSync(join(publicDir, "images/logo-icon.svg"));
  const faviconSvg = readFileSync(join(publicDir, "favicon.svg"));

  // PWA icons from logo
  await sharp(logoSvg)
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, "icon-192x192.png"));

  await sharp(logoSvg)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, "icon-512x512.png"));

  await sharp(logoSvg)
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, "apple-icon.png"));

  // Favicon from star
  const favicon32 = await sharp(faviconSvg).resize(32, 32).png().toBuffer();

  await sharp(favicon32).toFile(join(publicDir, "favicon-32x32.png"));

  // OG Image
  const ogBackground = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#10221a"/>
      <text x="600" y="480" font-family="Lexend, sans-serif" font-size="72" font-weight="700" fill="#7EDDB5" text-anchor="middle">KYNITE</text>
      <text x="600" y="540" font-family="Noto Sans, sans-serif" font-size="28" fill="#8baea0" text-anchor="middle">Routines without the friction</text>
    </svg>
  `);

  const logoBuffer = await sharp(logoSvg).resize(280, 280).png().toBuffer();

  await sharp(ogBackground)
    .composite([{ input: logoBuffer, top: 100, left: 460 }])
    .png()
    .toFile(join(publicDir, "og-image.png"));

  console.log("Icons generated successfully!");
}

generateIcons().catch(console.error);
```

**Step 2: Run the script**

```bash
node scripts/generate-icons.mjs
```

**Step 3: Generate favicon.ico**

```bash
pnpm dlx png-to-ico public/favicon-32x32.png > public/favicon.ico
```

**Step 4: Commit**

```bash
git add public/*.png public/favicon.ico scripts/generate-icons.mjs
git commit -m "feat: generate PNG icons and OG image"
```

---

## Phase 2: Project Rename

### Task 6: Update package.json

**Files:**

- Modify: `package.json:2`

**Step 1: Update package name**

Change:

```json
"name": "family-planner-v3",
```

To:

```json
"name": "kynite",
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: rename package to kynite"
```

---

### Task 7: Update English Translations

**Files:**

- Modify: `messages/en.json`

**Step 1: Update brand references**

Change these keys:

- `"appName": "Family Planner"` → `"appName": "Kynite"`
- `Metadata.title` → `"Kynite"`
- `HomePage.title` → `"Kynite"`
- `Header.brand` → `"Kynite"`
- `Header.tagline` → `"Routines without the friction"`

**Step 2: Commit**

```bash
git add messages/en.json
git commit -m "feat: update English translations to Kynite branding"
```

---

### Task 8: Update Dutch Translations

**Files:**

- Modify: `messages/nl.json`

**Step 1: Update brand references**

- `"appName"` → `"Kynite"`
- `Metadata.title` → `"Kynite"`
- `HomePage.title` → `"Kynite"`
- `Header.brand` → `"Kynite"`
- `Header.tagline` → `"Routines zonder wrijving"`

**Step 2: Commit**

```bash
git add messages/nl.json
git commit -m "feat: update Dutch translations to Kynite branding"
```

---

### Task 9: Update Root Layout Metadata

**Files:**

- Modify: `src/app/layout.tsx`

**Step 1: Update metadata**

Replace metadata export with:

```tsx
export const metadata: Metadata = {
  title: "Kynite",
  description: "Routines without the friction",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Kynite",
    description: "Routines without the friction",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
};
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update layout metadata with Kynite branding"
```

---

### Task 10: Create PWA Manifest

**Files:**

- Create: `public/manifest.json`

**Step 1: Create manifest**

```json
{
  "name": "Kynite",
  "short_name": "Kynite",
  "description": "Routines without the friction",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#10221a",
  "theme_color": "#13ec92",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "feat: add PWA manifest"
```

---

## Phase 3: Component Updates

### Task 11: Update BrandArea Component

**Files:**

- Modify: `src/components/layout/brand-area.tsx`

**Step 1: Update to use logo image**

```tsx
import Image from "next/image";
import { useTranslations } from "next-intl";

export function BrandArea() {
  const t = useTranslations("Header");

  return (
    <div className="flex items-center gap-3">
      <div data-testid="brand-icon" className="size-12">
        <Image
          src="/images/logo-icon.svg"
          alt="Kynite"
          width={48}
          height={48}
          className="size-12"
          priority
        />
      </div>
      <div className="flex flex-col">
        <span className="font-display text-xl font-bold">{t("brand")}</span>
        <span className="text-primary text-xs font-medium tracking-wider">
          {t("tagline")}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/brand-area.tsx
git commit -m "feat: update BrandArea to use Kynite logo"
```

---

### Task 12: Update Test Files

**Files:**

- Modify: `src/components/layout/__tests__/brand-area.test.tsx`
- Modify: `src/components/layout/__tests__/app-header.test.tsx`
- Modify: `src/components/layout/__tests__/navigation-menu.test.tsx`

**Step 1: Update mock messages in all test files**

Change all instances of:

- `brand: "Family Planner"` → `brand: "Kynite"`
- `tagline: "FAMILY OS"` → `tagline: "Routines without the friction"`

**Step 2: Run tests**

```bash
pnpm test:run
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/layout/__tests__/*.test.tsx
git commit -m "test: update test mocks for Kynite branding"
```

---

## Phase 4: Documentation Updates

### Task 13: Update Brand Guidelines

**Files:**

- Modify: `.claude/skills/brand-guidelines/SKILL.md`
- Modify: `.claude/skills/brand-guidelines/references/brand-guideline.md`

**Step 1: Update SKILL.md**

Update brand name and logo description:

- Brand Name: Kynite
- Tagline: Routines without the friction
- Logo: Two figures reaching for a star
- Figures: `#13ec92` (primary brand color)
- Star: `#D4A84B` (golden)

**Step 2: Update references/brand-guideline.md**

Update all "Family Planner" → "Kynite" and update logo specifications.

**Step 3: Commit**

```bash
git add .claude/skills/brand-guidelines/
git commit -m "docs: update brand guidelines for Kynite"
```

---

## Phase 5: Verification

### Task 14: Run Full Test Suite

**Step 1: Run tests**

```bash
pnpm test:run
```

Expected: All tests pass

**Step 2: Run linting**

```bash
pnpm lint
```

Expected: No errors

**Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds

---

### Task 15: Visual Verification

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Verify in browser**

- [ ] Favicon appears in browser tab (golden star)
- [ ] Header shows "Kynite" brand name
- [ ] Header shows "Routines without the friction" tagline
- [ ] Logo icon (two figures + star) displays correctly
- [ ] Page title is "Kynite"

**Step 3: Check PWA manifest**

Visit `http://localhost:3000/manifest.json`

---

## Summary

**New Logo:**

- Two green figures (`#13ec92`) reaching up toward a golden star (`#D4A84B`)
- Represents collaboration and achievement
- Clean, modern design
- Dark background (`#10221a`) for on-page use

**Files Created:**

- `docs/design/logo/logo-colorized.svg`
- `public/favicon.svg`
- `public/favicon.ico`
- `public/favicon-32x32.png`
- `public/icon-192x192.png`
- `public/icon-512x512.png`
- `public/apple-icon.png`
- `public/og-image.png`
- `public/images/logo-icon.svg`
- `public/images/logo-horizontal.svg`
- `public/manifest.json`
- `scripts/generate-icons.mjs`

**Files Modified:**

- `package.json`
- `messages/en.json`
- `messages/nl.json`
- `src/app/layout.tsx`
- `src/components/layout/brand-area.tsx`
- `src/components/layout/__tests__/brand-area.test.tsx`
- `src/components/layout/__tests__/app-header.test.tsx`
- `src/components/layout/__tests__/navigation-menu.test.tsx`
- `.claude/skills/brand-guidelines/SKILL.md`
- `.claude/skills/brand-guidelines/references/brand-guideline.md`
