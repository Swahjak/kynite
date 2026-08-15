'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { idleState } from '../action-state';
import { signInWithGoogleAction } from '../actions';

/**
 * Google's "G" mark, inline.
 *
 * Inline rather than `<Image src="https://…">` because the sign-in page must
 * render with no third-party request at all: a logo fetched from Google's CDN
 * would tell Google who is *looking* at our sign-in form, before anybody has
 * chosen to sign in with them. It is also the one asset on this screen that
 * must not be recoloured — the four-colour mark on a neutral surface is what
 * Google's branding guidelines require, so the paths carry literal hex fills
 * and no `currentColor`.
 *
 * `aria-hidden`: the button's own text already says "Google".
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" — the social half of both account screens (M19 phase
 * 2; owner override of the PRD's email/password-only line, 2026-08-07).
 *
 * `variant="outline"` is not a stylistic choice: Google's sign-in branding
 * guidelines allow a neutral (white / light-surface) button with the
 * unmodified mark and a "Sign in with Google" / "Continue with Google" label,
 * and forbid recolouring the mark or filling the button with our own brand.
 * The design-system `outline` variant *is* that neutral button, so the screen
 * gets Google's rules and the stitch geometry (48px hub target, `rounded-xl`)
 * at the same time, without a second button implementation.
 *
 * The label is deliberately **not** "Inloggen"/"Sign in": `e2e/tests/app/auth`
 * addresses the credential submit by its accessible name, and a second button
 * matching that name would make those locators ambiguous.
 *
 * `callbackUrl` is the M18 round trip and is sanitized twice — once by the page
 * that renders this, once by `signInWithGoogleAction` — for the same reason the
 * password form's hidden input is.
 */
export function GoogleSignInButton({ callbackUrl }: { callbackUrl?: string | null }) {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState(signInWithGoogleAction, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {callbackUrl ? (
        <input
          type="hidden"
          name="callbackUrl"
          value={callbackUrl}
          data-testid="google-callback-url"
        />
      ) : null}

      <Button
        type="submit"
        variant="outline"
        size="hub"
        disabled={pending}
        className="w-full font-semibold"
        data-testid="google-sign-in"
      >
        <GoogleMark />
        {t('google.continue')}
      </Button>

      {state.status === 'error' ? (
        <p role="alert" className="text-body-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}

/** The "or" rule between the social button and the credential form. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-overline text-ink-muted uppercase">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
