import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand/brand-mark';
import { buttonVariants, cn, Icon, type IconName } from '@kynite/ui';
import { Link, redirect } from '@/i18n/navigation';
import { getPrincipal } from '@/modules/family';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The four features the landing page leads with.
 *
 * Every icon is already in the 41-glyph subset (`ui/icon-codepoints.ts`), which
 * is a constraint rather than a coincidence: a new name here means re-running
 * `pnpm icons:subset` and shipping a new font file, and a marketing page is not
 * worth that. The set was chosen from what the product actually ships — no
 * feature is named here that a household cannot use on day one.
 */
const FEATURES: { icon: IconName; key: 'calendar' | 'routines' | 'rewards' | 'hub' }[] = [
  { icon: 'calendar_month', key: 'calendar' },
  { icon: 'checklist', key: 'routines' },
  { icon: 'star', key: 'rewards' },
  { icon: 'tablet_mac', key: 'hub' },
];

/**
 * `/{locale}` — the marketing landing page, and the redirect target of
 * BLOCKING 2's self-unpair (`HubSettings`'s "This is not a wall display").
 *
 * A signed-in parent lands here too, briefly, whenever something redirects to
 * the bare locale root rather than to a specific screen — self-unpair is the
 * first caller. Without the check below they would see the landing page
 * instead of their own family, which defeats the whole point of "member
 * session, if present, takes over": a device cookie clearing is not a sign-out,
 * and an account session that is still valid should not dead-end on a page for
 * people who do not have one yet.
 *
 * M19 phase 2 replaces the M01 scaffold — a centred `<h1>` and one line of
 * `opacity-70` text — with the stitch treatment
 * (docs/rebuild-design-gaps.md §8, root cause #4). What it takes from
 * `docs/design/homepage/homepage-code-1.html` is the *composition*: sticky nav,
 * hero with paired CTAs, a feature grid, a closing band. What it does not take
 * is that file's palette (superseded green) or its **pricing table** — the
 * mockup prices three tiers this product has not decided on, and inventing
 * numbers on the one page a household reads before trusting us is worse than
 * having no pricing section at all.
 */
export default async function MarketingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (principal?.kind === 'member') redirect({ href: '/today', locale });

  const t = await getTranslations('marketing');
  const tCommon = await getTranslations('common');

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* The glass header the mockups put on every surface — the same idiom as
          the parent app's `AppHeader`, so the product does not change shape the
          moment somebody signs in. */}
      <header className="bg-background/80 border-line-subtle shadow-glass sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <BrandMark />
          <nav className="flex items-center gap-2" aria-label={t('nav.label')}>
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: 'ghost', size: 'hub' }), 'px-4')}
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'default', size: 'hub' }), 'px-5')}
            >
              {t('nav.signUp')}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---- Hero ---------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_-20%,var(--brand)_0%,transparent_60%)] opacity-[0.12]"
          />
          <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center md:py-28">
            <p className="text-overline text-brand-ink mb-5 uppercase">{t('hero.eyebrow')}</p>
            <h1 className="font-display text-display-md md:text-display-lg text-balance">
              {t('hero.title')}
            </h1>
            <p className="text-ink-secondary text-body-lg mx-auto mt-6 max-w-xl text-pretty">
              {t('hero.body')}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'hub' }),
                  'w-full sm:w-auto'
                )}
              >
                {t('hero.primaryCta')}
                <Icon name="arrow_forward" size="sm" inline="end" />
              </Link>
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'hub' }),
                  'w-full sm:w-auto'
                )}
              >
                {t('hero.secondaryCta')}
              </Link>
            </div>
            <p className="text-ink-muted text-body-sm mt-5">{t('hero.reassurance')}</p>
          </div>
        </section>

        {/* ---- Features ------------------------------------------------- */}
        <section className="border-line-subtle border-t py-20 md:py-24">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-h1 text-balance">{t('features.title')}</h2>
              <p className="text-ink-secondary text-body-lg mt-4 text-pretty">
                {t('features.body')}
              </p>
            </div>

            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon, key }) => (
                <li
                  key={key}
                  className="border-border bg-card shadow-sm flex flex-col gap-3 rounded-2xl border p-6"
                >
                  <span className="bg-brand/10 text-brand-ink flex size-12 items-center justify-center rounded-xl">
                    <Icon name={icon} size="md" />
                  </span>
                  <h3 className="font-display text-h3">{t(`features.items.${key}.title`)}</h3>
                  <p className="text-ink-secondary text-body-sm">
                    {t(`features.items.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Closing band --------------------------------------------
            The filled-primary hero card every stitch screen has exactly one
            of (docs/rebuild-design-gaps.md §9), used here as the last thing on
            the page rather than the first — the hero above already carries the
            CTA, and two filled blocks would flatten both. */}
        <section className="px-6 pb-20 md:pb-24">
          <div className="bg-primary text-primary-foreground shadow-lg relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl px-6 py-16 text-center md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,var(--gold)_0%,transparent_70%)] opacity-20"
            />
            <h2 className="font-display text-h1 relative text-balance">{t('cta.title')}</h2>
            <p className="text-body-lg relative mx-auto mt-4 max-w-xl text-pretty opacity-90">
              {t('cta.body')}
            </p>
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'hub' }),
                'text-brand-ink relative mt-8 border-transparent bg-white px-6 hover:bg-white/90'
              )}
            >
              {t('cta.button')}
              <Icon name="arrow_forward" size="sm" inline="end" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-line-subtle border-t py-10">
        <div className="text-ink-muted text-body-sm mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-6 text-center">
          <BrandMark variant="icon" className="h-7" />
          <p>{tCommon('tagline')}</p>
        </div>
      </footer>
    </div>
  );
}
