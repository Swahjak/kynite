'use client';

import * as React from 'react';
import { cn, Icon } from '@kynite/ui';
import { CELEBRATION_PRESETS, prefersReducedMotion, type CelebrationIntensity } from './presets';

/**
 * The star pop — the *second* animation module (one module per animation).
 *
 * This is the deliberately quiet half of completion feedback. FR15 and research
 * §Decisions 5 put the praise text first and the star second, so the star does
 * not burst, spin or fill the screen: it scales up once, settles, and stays.
 * A single non-repeating transform is also, conveniently, unable to strobe.
 *
 * Renders nothing at all when `amount` is 0 — a graduated routine (FR17) pays
 * no stars, and the correct UI for that is absence, never a struck-through or
 * greyed-out star that reads as something taken away.
 */

export type StarPopProps = {
  amount: number;
  intensity?: CelebrationIntensity;
  /** Accessible label, e.g. "1 star earned". Supplied by the caller's locale. */
  label: string;
  className?: string;
};

export function StarPop({ amount, intensity = 'gentle', label, className }: StarPopProps) {
  // Initialized to `false` on every render, server included, so the first
  // client render matches the server's markup exactly — reduced-motion is a
  // `window.matchMedia` read, which does not exist during SSR. The real value
  // is applied in the effect below, after hydration.
  const [settled, setSettled] = React.useState(false);

  React.useEffect(() => {
    // Scheduled, never called synchronously in the effect body: a `setState`
    // right in the effect risks a cascading render (react-hooks/set-state-in-
    // effect). Zero-delay for reduced motion still lands before the next
    // paint, so there is no visible scale animation either way.
    const delay = prefersReducedMotion()
      ? 0
      : Math.min(CELEBRATION_PRESETS[intensity].durationMs, 400);
    const timer = window.setTimeout(() => setSettled(true), delay);
    return () => window.clearTimeout(timer);
  }, [intensity]);

  if (amount <= 0) return null;

  return (
    <span
      data-slot="star-pop"
      data-settled={settled ? 'true' : 'false'}
      aria-label={label}
      role="img"
      className={cn(
        // `text-caption` sits on the inner spans, not here: `cn()` merges
        // conflicting `text-*` utilities, and the colour has to survive.
        'inline-flex shrink-0 items-center gap-1 font-medium text-gold-ink',
        'transition-transform duration-200 ease-brand motion-reduce:transition-none',
        settled ? 'scale-100' : 'scale-75',
        className
      )}
    >
      <Icon name="star" size="sm" filled />
      <span className="tabular-time text-caption">+{amount}</span>
    </span>
  );
}
