'use client';

import Image from 'next/image';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { MEMBER_COLORS, type MemberColor } from '../schema';
import { idleState } from '../action-state';
import { acceptInviteAction, chooseProfileAction } from '../actions';
import { CUSTOM_AVATAR_ACCEPT } from '../domain/avatar';
import { readAvatarFile, type AvatarUploadError } from './avatar-upload';
import { MEMBER_AVATARS, MEMBER_COLOR_CLASSES, avatarUrlFor } from './tokens';

/**
 * The second-parent flow, in three screens (PRD FR26, milestone M14).
 *
 * The binding constraint on every component in this file is what it must *not*
 * contain: an `<input type="text">`, an `<Input>`, a `<textarea>`, a
 * `contenteditable`. The second parent's entire contribution to their own
 * onboarding is three taps, because the research finding this flow answers is
 * that the purchasing parent becomes the permanent admin whenever the second
 * one is handed a form. Everything a form would ask for is already known: the
 * name and role come from the member row the owner created, the email comes
 * from the invite, and the avatar and colour are closed sets.
 *
 * There is a Playwright test that walks all three screens asserting no free-text
 * field is reachable. Adding one here is meant to break it.
 */

/** Interaction 1 of 3. One button, no fields. */
export function InviteAcceptStep({
  token,
  familyName,
  displayName,
  color,
}: {
  token: string;
  familyName: string;
  displayName: string;
  color: MemberColor;
}) {
  const t = useTranslations('family.invite');
  const [state, formAction, pending] = useActionState(acceptInviteAction, idleState);

  return (
    <Card className="w-full max-w-md" data-testid="invite-accept">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('accept.title', { family: familyName })}</h1>
        </CardTitle>
        <CardDescription>{t('accept.description', { name: displayName })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn('size-10 rounded-full', MEMBER_COLOR_CLASSES[color].dot)}
          />
          <span className="font-display text-lg font-medium">{displayName}</span>
        </div>

        <form action={formAction}>
          <input type="hidden" name="token" value={token} />

          {state.status === 'error' ? (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}

          <Button type="submit" size="hub" className="w-full" disabled={pending}>
            {t('accept.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Interaction 2 of 3: one tap picks an avatar *and* a colour together.
 *
 * Deliberately not the two separate pickers the owner gets in `MemberDialog`.
 * Two pickers plus a save button is three interactions for a step the milestone
 * budgets one for, so the eight built-in avatars are paired one-to-one with the
 * eight design-system colours and each tile submits the pair. The pairing is
 * positional and therefore stable — tile three is always the cat in orange —
 * which matters because the tile is the only thing the invitee is choosing
 * from, and it should not move between visits.
 *
 * The colour is refinable later in the roster; getting *into* the household is
 * what has to be frictionless, not getting it perfect.
 *
 * M20 adds a tenth option: bring your own picture. It keeps the one-tap shape —
 * choosing a file *is* the interaction, so the form submits itself the moment a
 * valid one is read, and the colour that rides along is the one the owner
 * already gave this member rather than a tenth thing to decide. FR26's
 * criterion is that the invitee types nothing, and a file picker asks for no
 * keystrokes; `e2e/tests/app/family/invite.spec.ts` asserts that literally.
 */
export function InviteProfileStep({
  token,
  displayName,
  color,
}: {
  token: string;
  displayName: string;
  /** The member's existing colour — what a custom upload is paired with. */
  color: MemberColor;
}) {
  const t = useTranslations('family.invite');
  const tForm = useTranslations('family.form');
  const [state, formAction, pending] = useActionState(chooseProfileAction, idleState);

  const fileInput = useRef<HTMLInputElement>(null);
  const uploadForm = useRef<HTMLFormElement>(null);
  /**
   * The chosen picture, boxed rather than held as a bare string.
   *
   * The box is what makes *picking the same file twice* work. The server can
   * reject an upload this client was happy with (the markup check runs on both
   * sides), and the obvious next move for the invitee is to pick that same file
   * again to see whether it takes. With a bare data URI in state, that second
   * pick sets state to a string equal to the one already there, React bails out
   * of the re-render, the effect below never fires, and the screen sits silent —
   * the one outcome that reads as "this button is broken". A fresh object per
   * pick is never `Object.is`-equal to the last one, so every pick submits.
   */
  const [custom, setCustom] = useState<{ dataUri: string } | null>(null);
  const [uploadError, setUploadError] = useState<AvatarUploadError | null>(null);

  // Submitting from the effect rather than from the change handler is what
  // guarantees the hidden field already carries the data URI React was told
  // about — `requestSubmit()` reads the DOM, and the DOM is only current after
  // the render this state change caused.
  useEffect(() => {
    if (custom) uploadForm.current?.requestSubmit();
  }, [custom]);

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setUploadError(null);

    const result = await readAvatarFile(file);

    // Cleared on both paths, and before the state update: a file input holding
    // the file it just handed over emits no `change` when that same file is
    // chosen again, so leaving the value in place would swallow the retry one
    // level below the state bail-out described above.
    if (fileInput.current) fileInput.current.value = '';

    if (!result.ok) {
      setUploadError(result.error);
      return;
    }

    setCustom({ dataUri: result.dataUri });
  }

  return (
    <Card className="w-full max-w-md" data-testid="invite-profile">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('profile.title', { name: displayName })}</h1>
        </CardTitle>
        <CardDescription>{t('profile.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </p>
        ) : null}

        {uploadError ? (
          <p role="alert" className="text-sm text-destructive" data-testid="invite-profile-error">
            {tForm(`avatarErrors.${uploadError}`)}
          </p>
        ) : null}

        {/*
          Eight one-button forms rather than one form with eight submit buttons.
          Each tile carries its own pair of hidden fields, so the avatar and the
          colour cannot disagree and no click handler has to reach into the DOM
          to keep them together. The cost is eight <form> elements; the benefit
          is that "one tap = one complete, self-consistent submission" is a
          structural property rather than something a handler has to maintain.
        */}
        <div className="grid grid-cols-4 gap-3">
          {MEMBER_AVATARS.map((avatar, index) => {
            const color = MEMBER_COLORS[index % MEMBER_COLORS.length];
            return (
              <form key={avatar} action={formAction}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="avatarUrl" value={avatarUrlFor(avatar)} />
                <input type="hidden" name="color" value={color} />
                <Button
                  type="submit"
                  variant="outline"
                  size="icon-hub"
                  disabled={pending}
                  aria-label={`${tForm(`avatars.${avatar}`)} · ${tForm(`colors.${color}`)}`}
                  data-testid={`invite-profile-${avatar}`}
                  className={cn('size-full p-2', MEMBER_COLOR_CLASSES[color].surface)}
                >
                  <Image src={avatarUrlFor(avatar)} alt="" width={40} height={40} aria-hidden />
                </Button>
              </form>
            );
          })}
        </div>

        {/* The tenth option, in its own row: a picture of their own. Same shape
            as the tiles above — one form, its own hidden fields — except that
            the file dialog does the choosing and the form submits itself. */}
        <form ref={uploadForm} action={formAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="avatarUrl" value={custom?.dataUri ?? ''} />
          <input type="hidden" name="color" value={color} />

          <Button
            type="button"
            variant="outline"
            size="hub"
            className="w-full"
            disabled={pending}
            data-testid="invite-profile-upload"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="add" size="md" inline="start" />
            {tForm('avatarUpload')}
          </Button>

          <input
            ref={fileInput}
            type="file"
            accept={CUSTOM_AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="invite-profile-upload-input"
            onChange={(event) => void onFilePicked(event.target.files?.[0])}
          />
        </form>

        <p className="text-xs text-muted-foreground">{tForm('avatarUploadHint')}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Interaction 3 of 3: grant Google access.
 *
 * A link, not a form, because the response has to be a cross-origin redirect to
 * Google's consent screen — the same reason `/api/google/oauth/start` is a GET
 * route rather than a Server Action. `returnTo=onboarding` is what makes the
 * callback land on the calendar instead of settings, so FR26's "immediately"
 * is literal: consent, redirect, own events merged into the family view.
 *
 * A plain `<a>` and not `next/link`: the target is a route handler that answers
 * with a redirect off-origin, so there is no client-side navigation to do and
 * nothing to prefetch. (`@next/next/no-html-link-for-pages` reads the query
 * string as a page path, which is why the href is assembled here rather than
 * written inline — the same `<a>` without a query passes the rule untouched in
 * `modules/google/ui/google-accounts-panel.tsx`.)
 */
const GOOGLE_CONNECT_HREF = `/api/google/oauth/start?${new URLSearchParams({
  returnTo: 'onboarding',
}).toString()}`;

export function InviteGoogleStep({
  displayName,
  configured,
}: {
  displayName: string;
  configured: boolean;
}) {
  const t = useTranslations('family.invite');

  return (
    <Card className="w-full max-w-md" data-testid="invite-google">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('google.title')}</h1>
        </CardTitle>
        <CardDescription>{t('google.description', { name: displayName })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {configured ? null : (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('google.notConfigured')}
          </p>
        )}

        <Button
          render={<a href={GOOGLE_CONNECT_HREF} />}
          // Base UI's `Button` assumes native `<button>` semantics (Space/Enter
          // activation, `disabled` handling) unless told otherwise — this one
          // renders as an `<a>` by design (see the comment above), so that
          // assumption is false and Base UI warns about it without this flag.
          nativeButton={false}
          size="hub"
          className="w-full"
          data-testid="invite-google-connect"
        >
          {t('google.submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
