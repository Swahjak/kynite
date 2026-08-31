import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand/brand-mark';
import { Link } from '@/i18n/navigation';

type LegalSection = {
  heading: string;
  body: string;
  items?: string[];
};

/**
 * Shared shell for `/privacy` and `/terms` — both are static, unauthenticated
 * pages Google's OAuth verification reviewer needs to reach from the
 * marketing site, so they live in `(marketing)` rather than behind a session
 * check. Content lives in `messages/*.json` under `legal.privacy` /
 * `legal.terms` — sections are read with `t.raw()` since next-intl has no
 * built-in way to map over a translated list.
 */
export async function LegalPage({ namespace }: { namespace: 'privacy' | 'terms' }) {
  const t = await getTranslations(`legal.${namespace}`);
  const tLegal = await getTranslations('legal');
  const sections = t.raw('sections') as LegalSection[];
  const email = 'privacy@kynite.app';

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="bg-background/80 border-line-subtle shadow-glass sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <BrandMark />
          <Link href="/" className="text-body-sm text-ink-secondary hover:text-ink">
            {tLegal('back')}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="font-display text-display-md text-balance">{t('title')}</h1>
        <p className="text-ink-muted text-body-sm mt-3">
          {tLegal('updated', { date: '2026-08-31' })}
        </p>
        <p className="text-ink-secondary text-body-lg mt-6 text-pretty">{t('intro', { email })}</p>

        <div className="mt-10 flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-h2">{section.heading}</h2>
              <p className="text-ink-secondary text-body-md mt-2 text-pretty">
                {section.body.replace('{email}', email)}
              </p>
              {section.items ? (
                <ul className="text-ink-secondary text-body-md mt-3 list-disc space-y-1.5 pl-5">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-line-subtle border-t py-10">
        <div className="text-ink-muted text-body-sm mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-6 text-center">
          <BrandMark variant="icon" className="h-7" />
        </div>
      </footer>
    </div>
  );
}
