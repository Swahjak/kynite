import { BrandMark } from '@/components/brand/brand-mark';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * Shell for the account screens — sign-in, sign-up, M14's invite flow and
 * M19's social onboarding.
 *
 * Deliberately *not* a guard. The "you already have a session, go to the app"
 * redirect lives on the sign-in and sign-up pages themselves, because it is
 * true of those two screens and false of the others: `invite/[token]` continues
 * past its own accept step with a freshly issued session, and a layout that
 * bounced every principal would eject the second parent from the middle of the
 * flow it just signed them into. Putting the rule where it applies is also the
 * honest shape — it was never a property of "being unauthenticated screens", it
 * was a property of those two forms.
 *
 * M19 phase 2 gives it the stitch treatment. Three things, and no more, because
 * everything on these screens is one card and the shell's whole job is to frame
 * it:
 *
 *  - the **brand rail idiom** as a mark above the card. `(app)` anchors itself
 *    with the horizontal logo in a glass header and `(hub)` with the icon on a
 *    wall; these screens had nothing at all, which is why they read as a
 *    scaffold — the first surface a household ever sees never said whose
 *    product it was.
 *  - a **tonal indigo wash** rather than flat `background`. Two soft radial
 *    stops at brand and gold, at the opacity the mockups use behind hero cards
 *    — enough to make the white card sit *on* something.
 *  - a **grid ceiling** (`max-w-md` lives on the cards) plus 24px container
 *    margins, per the design system's mobile gutter.
 *
 * The mark itself is `<BrandMark variant="horizontal" />`, not the raw
 * `logo-horizontal.svg` asset: that SVG is `docs/design/brand.md`'s
 * *light-card* lockup — it bakes its own white `#fff`/`#e1e3e4`-bordered card
 * into the file (see the asset's `<rect>`), which would float as a second,
 * competing card on top of this screen's tonal wash instead of sitting on the
 * plain white ground the doc's spec assumes; its `<text>` wordmark also has no
 * access to this page's `@font-face` rules through `next/image`, so it falls
 * back to the system sans. `BrandMark`'s `horizontal` variant composes the
 * icon mark (self-contained, scales cleanly) with real HTML text in Baloo 2
 * instead, for exactly this reason — see its own doc comment.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden p-6">
      {/* Decorative, and marked as such: a screen reader announcing the
          background gradient serves nobody. `-z-10` keeps it behind the card
          without taking it out of the layout's stacking context entirely. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-10%,var(--brand)_0%,transparent_55%),radial-gradient(60%_50%_at_110%_110%,var(--gold)_0%,transparent_50%)] opacity-[0.10]"
      />

      <BrandMark className="[&_span]:text-[28px]" />

      {children}
    </main>
  );
}
