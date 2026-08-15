/**
 * The one non-error thing the sign-in form ever has to say (M19, F4).
 *
 * A parent whose member row was removed keeps a valid login and no household,
 * which is indistinguishable — to `getPrincipal()` — from a brand new social
 * account. `(auth)/onboarding` tells them apart and sends the removed one back
 * here with this query parameter, so the form can explain why it is asking
 * again instead of bouncing them around the same three routes.
 *
 * A shared module rather than two string literals because the producer
 * (`onboarding/page.tsx`) and the consumer (`sign-in/page.tsx`) are different
 * files, and a notice nobody renders is worse than no notice at all.
 */
export const SIGN_IN_NOTICE_PARAM = 'notice';

/** Value of {@link SIGN_IN_NOTICE_PARAM}; a key under `auth.errors`. */
export const MEMBERSHIP_REMOVED_NOTICE = 'membershipRemoved';
