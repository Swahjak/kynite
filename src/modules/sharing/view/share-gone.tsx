import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';

/**
 * What a caregiver sees when a link no longer works — expired, revoked, or
 * never real (M13: "a friendly gone state, not a stack trace").
 *
 * **One state for all three reasons.** The resolver knows which it was; this
 * does not, and is not told. An anonymous holder of a wrong token who learns
 * that it "expired" has learned that the token was once valid, which turns a
 * blind guess into a confirmed hit. Parents get the true state in
 * `(app)/settings/sharing`, where they are authenticated and it is their own
 * link they are reading about.
 *
 * There is no retry button and no sign-in prompt. Nothing the person holding
 * this link can do will fix it — the fix is a new link from the family — and
 * offering an action that cannot work is worse than saying so plainly.
 */
export async function ShareGone() {
  const t = await getTranslations('sharing.view');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon name="schedule" size="lg" />
      </span>
      <h1 className="font-display text-2xl font-bold">{t('goneTitle')}</h1>
      <p className="text-balance text-muted-foreground">{t('goneBody')}</p>
    </main>
  );
}
