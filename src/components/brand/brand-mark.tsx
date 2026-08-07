import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * The Kynite mark (M18, brand guideline §"Logo & Icon").
 *
 * `public/images/logo-horizontal.svg` and `logo-icon.svg` have shipped in this
 * repo since the design system landed and were referenced from nowhere in
 * `src/` — the only place the brand appeared to a signed-in household was the
 * marketing page they are redirected away from. Two surfaces get it now: the
 * parent app's header, where it is the "you are in Kynite" anchor next to the
 * nav, and the kiosk shell, where it is the only thing on a wall display that
 * says whose product this is.
 *
 * A server component so it needs no client bundle at all: it renders one
 * `<Image>` and one translated `alt`, and neither ever changes after paint.
 *
 * `variant`:
 * - `horizontal` — mark plus wordmark, for a header with room.
 * - `icon` — the house alone, for the kiosk and for narrow viewports.
 *
 * The `alt` is the product name rather than "Kynite logo": a screen reader
 * announcing "Kynite logo, image" says the word "logo" for no one's benefit.
 * Where the mark sits next to a visible "Kynite" it would be decorative, but it
 * never does in this app — it *is* the name.
 */
export async function BrandMark({
  variant = 'horizontal',
  className,
}: {
  variant?: 'horizontal' | 'icon';
  className?: string;
}) {
  const t = await getTranslations('common');
  const horizontal = variant === 'horizontal';

  return (
    <Image
      src={horizontal ? '/images/logo-horizontal.svg' : '/images/logo-icon.svg'}
      alt={t('appName')}
      width={horizontal ? 120 : 32}
      height={32}
      // An SVG's intrinsic box is what `width`/`height` above describe; this
      // keeps it honest when a caller constrains only one axis.
      className={cn('h-8 w-auto', className)}
      // The mark is above the fold on every surface that renders it, and it is
      // ~3KB — lazy-loading it would cost a visible pop-in for nothing.
      priority
      // An SVG has nothing for the optimizer to do, and routing one through it
      // would mean turning on `dangerouslyAllowSVG` globally — which relaxes
      // the rule for *every* image this app ever serves, to save nothing on
      // this one.
      unoptimized
      data-testid="brand-mark"
    />
  );
}
