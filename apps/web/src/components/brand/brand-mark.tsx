import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * The Kynite mark (M18, restyled M20 for `docs/design/brand.md`).
 *
 * `public/images/logo-horizontal.svg` and `logo-icon.svg` have shipped in this
 * repo since the design system landed. Two surfaces render it: the parent
 * app's header/rail, where it is the "you are in Kynite" anchor next to the
 * nav, and the kiosk shell, where it is the only thing on a wall display that
 * says whose product this is.
 *
 * `variant`:
 * - `horizontal` — mark plus wordmark, for a header with room.
 * - `icon` — the star mark alone, for the kiosk and for narrow viewports.
 *
 * `docs/design/brand.md` § "Lockup / Horizontal" only specifies a *card*
 * lockup: white background, `#e1e3e4` border, 16px radius, padding — a
 * standalone brand asset meant to sit **on** a page, not **inside** another
 * chrome surface. `logo-horizontal.svg` transcribes that card verbatim
 * (including a baked-in `<text>` wordmark), which is exactly right for a
 * caller that wants the literal card (e.g. dropped onto a plain background),
 * but wrong for a translucent/glass header that already supplies its own
 * framing — nesting the white card there doubles the chrome, and an SVG
 * `<text>` element does not pick up this app's `next/font`-loaded Baloo 2, so
 * it silently renders in the browser's system sans instead.
 *
 * `horizontal` here therefore composes the *unframed* lockup live: the icon
 * asset (self-contained, own rounded-square background) plus a real HTML
 * `<span>` set in `font-display` (Baloo 2, already loaded app-wide via
 * `src/lib/fonts.ts`), colored `currentColor` so it inherits whatever ink
 * color the header context wants (e.g. white on a dark/glass surface). Use
 * `icon` alone, or reach for the raw `logo-horizontal.svg` asset directly,
 * when the literal white bordered card is actually what's wanted.
 *
 * The `alt`/label is the product name rather than "Kynite logo": a screen
 * reader announcing "Kynite logo, image" says the word "logo" for no one's
 * benefit.
 */
export async function BrandMark({
  variant = 'horizontal',
  className,
}: {
  variant?: 'horizontal' | 'icon';
  className?: string;
}) {
  const t = await getTranslations('common');
  const appName = t('appName');

  if (variant === 'icon') {
    return (
      <Image
        src="/images/logo-icon.svg"
        alt={appName}
        // Intrinsic 120×120 (`docs/design/assets/logo-icon.svg`), stated at
        // the rendered 32px so `w-auto` keeps an honest ratio.
        width={32}
        height={32}
        className={cn('size-8 rounded-lg', className)}
        priority
        // An SVG has nothing for the optimizer to do, and routing one through
        // it would mean turning on `dangerouslyAllowSVG` globally.
        unoptimized
        data-testid="brand-mark"
      />
    );
  }

  return (
    <span
      role="img"
      className={cn('inline-flex items-center gap-2', className)}
      data-testid="brand-mark"
      aria-label={appName}
    >
      <Image
        src="/images/logo-icon.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-lg"
        priority
        unoptimized
      />
      <span
        aria-hidden
        className="font-display text-h3 leading-none font-bold tracking-tight text-current"
      >
        {appName}
      </span>
    </span>
  );
}
