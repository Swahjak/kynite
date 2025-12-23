# Logo Colorization Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a colorized version of the logo SVG with figures in primary brand color and star/sparkles in golden.

**Architecture:** The source SVG contains paths rendered as **filled black shapes**. We must keep them as fills (NOT convert to strokes). The star is a "cutout" in the composite path - to make it gold, we render the gold star ON TOP of the green figures.

**Tech Stack:** SVG

**Colors:**

- Figures: `#13ec92` (primary brand color) - **filled**
- Star + Sparkles: `#D4A84B` (golden) - **filled**

**Key Learning:** Converting fills to strokes creates "doubled lines" because strokes have both inner and outer edges. Keep shapes as fills.

---

## Source File Analysis

**File:** `docs/design/logo/logo.svg`

| Lines   | Path Start | Element Type                                  | Colorize As                             |
| ------- | ---------- | --------------------------------------------- | --------------------------------------- |
| 9-24    | M1655 4050 | Rounded rectangle border                      | SKIP (app icon frame)                   |
| 25-29   | M2766 3503 | Sparkle ray top-right                         | GOLD fill                               |
| 30-32   | M2325 3496 | Sparkle ray top-center                        | GOLD fill                               |
| 33-36   | M2176 3476 | Sparkle ray top-left                          | GOLD fill                               |
| 37-90   | M2477 3437 | Composite (figures + star + internal details) | GREEN fill (keep as-is, star is cutout) |
| 91-93   | M2855 3370 | Sparkle element right side                    | GOLD fill                               |
| 94-100  | M2048 3138 | Left figure head                              | GREEN fill                              |
| 101-104 | M2800 3037 | Right figure head                             | GREEN fill                              |
| 105-107 | M2477 2813 | Center connector                              | GREEN fill                              |

**Strategy:**

1. Render green-filled figures FIRST (star appears as transparent cutout)
2. Render gold-filled star ON TOP (covers the cutout with gold)
3. Render gold-filled sparkles

---

### Task 1: Create the colorized SVG with filled shapes

**Files:**

- Create: `docs/design/logo/logo-colorized.svg`
- Reference: `docs/design/logo/logo.svg`

**Step 1: Create the SVG with proper structure**

Create `docs/design/logo/logo-colorized.svg`:

```xml
<?xml version="1.0" standalone="no"?>
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="500.000000pt" height="500.000000pt" viewBox="0 0 500.000000 500.000000"
 preserveAspectRatio="xMidYMid meet">
<g transform="translate(0.000000,500.000000) scale(0.100000,-0.100000)">

<!-- FIGURES GROUP: Primary brand color, FILLED (not stroked) -->
<g fill="#13ec92" stroke="none">

<!-- Composite path: figures body + internal details (star is cutout via evenodd) -->
<path fill-rule="evenodd" d="[COPY ENTIRE PATH FROM LINES 37-90 OF ORIGINAL]"/>

<!-- Left figure head -->
<path d="[COPY FROM LINES 94-100]"/>

<!-- Right figure head -->
<path d="[COPY FROM LINES 101-104]"/>

<!-- Center connector -->
<path d="[COPY FROM LINES 105-107]"/>

</g>

<!-- STAR GROUP: Golden, FILLED - rendered ON TOP to cover the cutout -->
<g fill="#D4A84B" stroke="none">

<!-- Sparkle ray top-right -->
<path d="[COPY FROM LINES 25-29]"/>

<!-- Sparkle ray top-center -->
<path d="[COPY FROM LINES 30-32]"/>

<!-- Sparkle ray top-left -->
<path d="[COPY FROM LINES 33-36]"/>

<!-- Sparkle element right side -->
<path d="[COPY FROM LINES 91-93]"/>

<!-- Main 5-pointed star (extract from composite path lines 66-70, convert to absolute) -->
<path d="M2516 3413 c3 -10 21 -60 41 -110 l35 -93 46 0 c87 0 182 -13 182 -24 -1 -6 -24 -28 -53 -49 -29
-21 -67 -50 -85 -66 l-32 -28 25 -104 c14 -57 25 -107 25 -111 0 -16 -21 -6
-102 47 -45 30 -88 55 -94 55 -6 0 -50 -25 -99 -55 -85 -54 -105 -63 -105 -47
0 4 10 43 21 87 35 132 36 129 -58 199 -45 34 -82 66 -82 73 -1 7 37 13 114
18 67 4 118 12 123 19 7 12 34 82 59 159 17 49 30 59 39 30z"/>

</g>

</g>
</svg>
```

**Step 2: Copy the actual path data from original**

From `docs/design/logo/logo.svg`, copy:

- Lines 37-90 (entire composite path including all sub-paths) → figures body
- Lines 94-100 → left head
- Lines 101-104 → right head
- Lines 105-107 → center connector
- Lines 25-29 → sparkle top-right
- Lines 30-32 → sparkle top-center
- Lines 33-36 → sparkle top-left
- Lines 91-93 → sparkle right side

**Step 3: Verify rendering**

Open in browser and verify:

1. Figures appear as solid green shapes (same visual weight as original)
2. Star appears as solid gold (no green showing through)
3. Sparkles appear as solid gold
4. No "doubled lines" effect

---

### Task 2: Commit the colorized logo

**Step 1: Stage and commit**

```bash
git add docs/design/logo/logo-colorized.svg
git commit -m "feat(brand): add colorized logo SVG

- Figures: primary brand color (#13ec92) filled
- Star + sparkles: golden (#D4A84B) filled
- Maintains original visual weight (fills, not strokes)"
```
