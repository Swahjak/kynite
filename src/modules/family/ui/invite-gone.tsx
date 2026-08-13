import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import type { InviteState } from '../domain/invite';

/**
 * The friendly end of a link that no longer works (M14 acceptance criteria).
 *
 * One screen for four outcomes — claimed, revoked, expired, never existed — and
 * that is a security decision as much as a copy one. Distinguishing "this token
 * was used" from "this token never existed" would turn the invite endpoint into
 * an oracle that confirms whether a guessed token was ever real. The *copy*
 * differs by state where the state is already known to the person reading it
 * (they used the link themselves), and the not-found case borrows the
 * already-claimed wording rather than admitting the difference.
 *
 * Friendly, not apologetic: a second parent whose partner already set them up
 * on another phone should read "you're already in" and be given the way in,
 * not an error.
 */
export async function InviteGone({
  state,
}: {
  /** `pending` is not an ending — that invite still has a screen of its own. */
  state: Exclude<InviteState, 'pending'> | 'notFound';
}) {
  const t = await getTranslations('family.invite.gone');
  const key = state === 'notFound' ? 'claimed' : state;

  return (
    <Card className="w-full max-w-md" data-testid="invite-gone">
      <CardHeader>
        <CardTitle>
          <h1 className="font-display text-h1">{t(`${key}.title`)}</h1>
        </CardTitle>
        <CardDescription>{t(`${key}.description`)}</CardDescription>
      </CardHeader>
      <CardContent>
        {/*
          Renders as a `<Link>`, not a native `<button>` — `nativeButton={false}`
          tells Base UI's `Button` so it does not warn about the native-button
          keyboard/disabled assumptions it otherwise makes (F7).
        */}
        <Button
          render={<Link href="/sign-in" />}
          nativeButton={false}
          size="hub"
          className="w-full"
        >
          {t('signIn')}
        </Button>
      </CardContent>
    </Card>
  );
}
