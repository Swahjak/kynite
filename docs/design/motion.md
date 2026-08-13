# Motion & celebration

Source: `design-system.html`, section `<!-- MOTION -->` plus the `@keyframes`/animation-class definitions in `<helmet><style>`.

> "Child-friendly interaction patterns: big single-tap targets (48px minimum, larger on tablet), instant optimistic feedback, and color paired with icons/shape so wins read clearly to any child."

**Core principle, quoted verbatim from the Rewards section**: "Confetti fires the instant a step or reward is tapped — under 100ms, before the server responds. Once fired, it's never walked back." — i.e. celebration animations are optimistic-UI, not tied to a server round-trip, and are not reversible/undoable once triggered.

## Keyframes (exact, from source)

```css
@keyframes kynite-pop {
  0% { transform: scale(1); }
  12% { transform: scale(1.35); }
  28% { transform: scale(0.92); }
  42% { transform: scale(1); }
  100% { transform: scale(1); }
}
@keyframes kynite-check-pop {
  0% { transform: scale(0.6); opacity: 0; }
  15% { transform: scale(1.2); opacity: 1; }
  30% { transform: scale(1); }
  100% { transform: scale(1); }
}
@keyframes kynite-confetti {
  0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 0; }
  8% { opacity: 1; transform: translate(0,0) rotate(0deg) scale(1); }
  60% { opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) rotate(var(--tr)) scale(0.5); opacity: 0; }
}
@keyframes kynite-shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
@keyframes kynite-pop-big {
  0% { transform: scale(1); }
  10% { transform: scale(1.6); }
  24% { transform: scale(0.85); }
  38% { transform: scale(1.15); }
  50% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

## Animation classes (exact, from source)

| Class | Rule | Notes |
| --- | --- | --- |
| `.kynite-anim-pop` | `animation: kynite-pop 2.4s ease-in-out infinite;` | Small/regular pop (e.g. star icon idle-celebrate) |
| `.kynite-anim-check` | `animation: kynite-check-pop 2.4s ease-in-out infinite;` | Checkbox check-mark pop-in |
| `.kynite-confetti-piece` | `animation: kynite-confetti 1.8s ease-out infinite;` | Regular-size confetti burst piece |
| `.kynite-shimmer-sweep` | `animation: kynite-shimmer 2.2s linear infinite;` | Streak progress-bar shimmer sweep |
| `.kynite-anim-pop-big` | `animation: kynite-pop-big 2.6s ease-in-out infinite;` | Big-celebration icon pop (reward claimed, milestone) |
| `.kynite-confetti-piece-big` | `animation: kynite-confetti 1.6s ease-out infinite;` | Big-celebration confetti piece (same keyframe as regular, shorter/faster duration) |

Confetti pieces are individually positioned `span`s with per-instance custom properties `--tx`, `--ty`, `--tr` (translate X/Y and rotation endpoints) consumed by the shared `kynite-confetti` keyframe, plus a staggered inline `animation-delay` (regular bursts: `0.15s` increments; big bursts: `0.08s` increments, more pieces).

## Specimens (from the Motion section)

### Motion/Confetti burst (regular)

`background:#ffffff;border-radius:20px;padding:24px;` container, `height:140px;`, 5 confetti pieces (mixed `#ef8d5d`, `#71f8e4`, `#b8c3ff`, `#006056`) sized 6–8px, radii alternating `9999px` (dot) and `2px` (square-ish shard), around a center `star` icon at `font-size:36px;color:#ef8d5d;` with `.kynite-anim-pop` and `font-variation-settings:'FILL' 1;`.

### Motion/Confetti pop — big celebration

Same pattern on a **dark** `background:#191c1d;` container, `height:140px;`, 8 confetti pieces (adds `#fecf6e` to the palette), sizes 7–10px, around a center `emoji_events` (trophy) icon at `font-size:44px;color:#fecf6e;` with `.kynite-anim-pop-big`. Annotated: "Reserved for the big moments — reward approvals, streak milestones. Bigger burst, bigger icon pop."

### Motion/Checkbox pop

`background:#ffffff;` container, `height:140px;` — a `48px` rounded-square badge (`border-radius:12px;background:#006056;`) with a `check` icon (`26px`, white) carrying `.kynite-anim-check`. Annotated: "Haptic-style pop on check".

### Motion/Streak shimmer

`background:#ffffff;` container, `height:140px;` — a `local_fire_department` icon (`20px`, `#ef8d5d`, filled) + "5-day streak" label, above a `10px`-tall progress track (`background:#e1e3e4;`) with an `#ef8d5d` fill at 80% width; the shimmer overlay is a nested `div` inside the fill: `position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent);` with `.kynite-shimmer-sweep`.

### Motion/Big tap target

`background:#ffffff;` container, `height:140px;` — a `64px` circular primary button (`background:#5d5fef;box-shadow:0 4px 14px rgba(93,95,239,0.35);`) with a `32px` check icon. Annotated: "64px on tablet vs. 48px minimum" — i.e. the **48px** figure is the floor for all tap targets (buttons, icon buttons), and tablet contexts should size up to **64px** for primary actions.

## Tap-target sizing rule

Explicit from the section intro and the "Big tap target" specimen: **minimum 48px** for any interactive target, sized up to **64px** on tablet for primary/high-frequency actions (matches the `Button/FAB` size of `56px` as an intermediate step, and the standard `Button/Primary` height of `48px` as the floor).
