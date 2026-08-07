import 'server-only';
import { createTranslator } from 'next-intl';
import { routing, type Locale } from '@/i18n/routing';
import type { PushPayload } from './queues';

/**
 * Notification bodies, localized per family (`family.locale`).
 *
 * A job has no request, so `getTranslations()` — which reads the request
 * locale — is not available here. `createTranslator` over the same message
 * files is: one import of `messages/<locale>.json` and the identical ICU
 * pipeline the UI uses, so a push body and an on-screen string cannot drift.
 *
 * **Voice.** Push copy obeys the same law the hub does (PRD FR30, research
 * §"Nagging / device as messenger"): the notification is a *board speaking for
 * itself*, never a parent's mouthpiece and never a reproach. "Schoenen aan
 * over 1 minuut" states a fact about the schedule. There is no "don't forget",
 * no "you still haven't", no exclamation mark, and there is deliberately no
 * notification for a *missed* routine at all — a missed task is the absence of
 * a row (§3), and a push about an absence is exactly the nagging the device is
 * supposed to have replaced.
 */

/**
 * The message tree's real shape, taken from the `nl` file (the default locale,
 * and the one `messages`-parity tests pin `en` against). Typing it as
 * `Record<string, unknown>` instead would make every key `never` — the whole
 * point of `createTranslator`'s generic is that a typo in a notification key
 * fails `pnpm typecheck` rather than a parent's phone.
 */
type Messages = typeof import('../../../messages/nl.json');

const cache = new Map<Locale, Promise<Messages>>();

function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

/** Falls back to the default locale rather than failing to notify. */
export function resolveLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : routing.defaultLocale;
}

async function loadMessages(locale: Locale): Promise<Messages> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = import(`../../../messages/${locale}.json`).then(
      (module: { default: Messages }) => module.default
    );
    cache.set(locale, pending);
  }
  return pending;
}

async function translator(locale: Locale) {
  return createTranslator({ locale, messages: await loadMessages(locale) });
}

/**
 * The reminder a routine's **owner** gets, `minutes` before it is due.
 *
 * `url` deep-links into the parent app's routines screen (§6 step 5); `tag`
 * is the idempotency key, so a re-send replaces the notification on the lock
 * screen instead of stacking a second one next to it.
 */
export async function reminderPayload(input: {
  locale: string | null | undefined;
  routineTitle: string;
  minutes: number;
  routineId: string;
  occurrenceDate: string;
  memberId: string;
}): Promise<PushPayload> {
  const locale = resolveLocale(input.locale);
  const t = await translator(locale);

  return {
    title: input.routineTitle,
    body:
      input.minutes > 0
        ? t('notifications.reminder.soon', { title: input.routineTitle, minutes: input.minutes })
        : t('notifications.reminder.now', { title: input.routineTitle }),
    url: `/${locale}/routines`,
    tag: `reminder:${input.routineId}:${input.occurrenceDate}:${input.memberId}`,
  };
}

/**
 * The fan-out the *other* adults get when a routine step is ticked off
 * (PRD FR22, M18).
 *
 * The voice is the hardest part of this one and it is settled here. It states
 * what happened and who did it — "Sofie heeft tanden poetsen gedaan" — and
 * that is the whole message. It is not a progress report, it carries no count,
 * no "still to do", and no comparison with yesterday or with a sibling, all of
 * which would turn a parent's lock screen into the scoreboard FR13 and FR11
 * exist to prevent. It is also never sent for a *missed* step: a missed step
 * is the absence of a row (§3), and there is nothing to say about an absence.
 *
 * `tag` is the completion's `clientId`, which is the same idempotency key the
 * write used — so a replayed tap from an offline outbox replaces the
 * notification on the lock screen instead of stacking a second one beside it.
 */
export async function routineCompletedPayload(input: {
  locale: string | null | undefined;
  memberName: string;
  stepTitle: string;
  clientId: string;
}): Promise<PushPayload> {
  const locale = resolveLocale(input.locale);
  const t = await translator(locale);

  return {
    title: t('notifications.completion.title'),
    body: t('notifications.completion.body', {
      name: input.memberName,
      step: input.stepTitle,
    }),
    url: `/${locale}/routines`,
    tag: `completion:${input.clientId}`,
  };
}

/** The fan-out every adult gets when a child asks to spend stars (§6, FR19). */
export async function redemptionRequestPayload(input: {
  locale: string | null | undefined;
  childName: string;
  rewardTitle: string;
  redemptionId: string;
}): Promise<PushPayload> {
  const locale = resolveLocale(input.locale);
  const t = await translator(locale);

  return {
    title: t('notifications.redemption.title'),
    body: t('notifications.redemption.body', {
      name: input.childName,
      reward: input.rewardTitle,
    }),
    url: `/${locale}/rewards`,
    tag: `redemption:${input.redemptionId}`,
  };
}
