import { getTranslations } from 'next-intl/server';
import { formatDateTime, type FormattingLocale } from '@/i18n/formatting-locale';
// A deep import of the calendar slice's `domain`, which is exactly what the
// share view's boundary rule allows (`eslint.config.mjs`,
// `shareViewBoundaryRule`) — and why the sentinel lives there rather than in
// the Google slice this tree may not reach. Not the barrel: that re-exports
// `queries.ts`, which is `server-only`.
import { titleOf } from '@/modules/calendar/domain/event-title';
import { ShareStepButton } from './share-step-button';
import type { ShareDay, ShareMember, ShareRoutine, ShareView } from './load';

/**
 * The caregiver's whole surface: a week of schedule, and today's routines.
 *
 * A server component with exactly one client island (`ShareStepButton`), which
 * is the shape the `(share)` tree's constraints push towards anyway — there is
 * nothing to hydrate on a read-only page. Everything here is already scoped by
 * `loadShareView`: this file filters nothing and decides nothing, so there is
 * no second place where the scope rule could be got wrong.
 *
 * The voice is neutral-board (FR30, research §"Ambient display"): it states
 * what is happening, and never attributes an instruction to a parent. A
 * babysitter reading "Mama says brush your teeth" is being handed a script for
 * someone else's authority; "Tanden poetsen" is a fact about the evening.
 *
 * M19 phase 2 puts it on the design system's tokens — the brand type scale in
 * place of the `text-2xl`/`text-sm` mix docs/rebuild-design-gaps.md §8 flagged,
 * `text-ink-secondary` in place of `text-muted-foreground`, 16px card radius
 * and the level-1 shadow, and the `tabular-time` utility on the clock column
 * that was reaching for raw `tabular-nums`. What it deliberately does *not*
 * gain is anything the `(share)` tree excludes by design: no service worker, no
 * toaster, no nav, no session — a caregiver's browser installs nothing and can
 * reach nothing. Read-only semantics are untouched: a `viewer` still gets a
 * `<div>` rather than a disabled control, for the reason stated below.
 */
export async function ShareBoard({ token, view }: { token: string; view: ShareView }) {
  const t = await getTranslations('sharing.view');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 p-6 pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h1 text-balance">
          {view.familyName ? t('title', { family: view.familyName }) : t('titleFallback')}
        </h1>
        <p className="text-ink-secondary text-body-sm">
          {view.role === 'contributor' ? t('roleContributor') : t('roleViewer')}
        </p>
      </header>

      {view.showRoutines && view.routines.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-overline text-ink-muted uppercase">{t('routinesTitle')}</h2>
          {view.routines.map((routine) => (
            <RoutineCard
              key={`${routine.id}:${routine.occurrenceDate}`}
              token={token}
              routine={routine}
              member={view.members.find((entry) => entry.id === routine.memberId)}
              canComplete={view.canComplete}
              stepDoneLabel={t('stepDone')}
            />
          ))}
        </section>
      ) : null}

      {view.showSchedule ? (
        <section className="flex flex-col gap-6">
          <h2 className="text-overline text-ink-muted uppercase">{t('scheduleTitle')}</h2>
          {view.days.map((day) => (
            <ShareDayRow
              key={day.dateKey}
              day={day}
              members={view.members}
              timeZone={view.timeZone}
              formattingLocale={view.formattingLocale}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}

async function RoutineCard({
  token,
  routine,
  member,
  canComplete,
  stepDoneLabel,
}: {
  token: string;
  routine: ShareRoutine;
  member: ShareMember | undefined;
  canComplete: boolean;
  stepDoneLabel: string;
}) {
  return (
    <article className="border-border bg-card shadow-sm flex flex-col gap-4 rounded-2xl border p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-h3">{routine.title}</h3>
        {member ? (
          <span className="text-ink-secondary text-body-sm">{member.displayName}</span>
        ) : null}
      </header>

      <ul className="flex flex-col gap-2">
        {routine.steps.map((step) => (
          <li key={step.id}>
            {canComplete ? (
              <ShareStepButton
                token={token}
                routineId={routine.id}
                routineStepId={step.id}
                memberId={routine.memberId}
                occurrenceDate={routine.occurrenceDate}
                clientId={step.clientId}
                title={step.title}
                done={step.done}
              />
            ) : (
              // A `viewer` gets the same information in a shape that cannot be
              // pressed. Not a disabled button — a disabled control still reads
              // as "this is yours, but not now", and it is not theirs.
              <div
                data-testid="share-step-readonly"
                className="border-line-subtle bg-surface-container-low text-body flex min-h-hub-target items-center gap-3 rounded-xl border px-4 py-3"
              >
                <span
                  aria-hidden
                  className="border-border size-6 shrink-0 rounded-full border bg-card"
                />
                <span className={step.done ? 'text-ink-muted line-through' : undefined}>
                  {step.title}
                </span>
                {step.done ? <span className="sr-only">{stepDoneLabel}</span> : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * One day of the caregiver's week.
 *
 * Exported (rather than kept private to this file) so the redaction rule below
 * can be asserted on rendered HTML in a unit test — `ShareBoard` itself is a
 * server component whose children are server components, which no client
 * renderer will walk.
 */
export async function ShareDayRow({
  day,
  members,
  timeZone,
  formattingLocale,
}: {
  day: ShareDay;
  members: ShareMember[];
  /** The shared family's zone (`ShareView.timeZone`) — a caregiver's own
   *  browser locale/zone must never leak into what "today" means here. */
  timeZone: string;
  /** The shared family's date/time convention (`ShareView.formattingLocale`). */
  formattingLocale: FormattingLocale;
}) {
  const t = await getTranslations('sharing.view');

  const date = new Date(`${day.dateKey}T12:00:00Z`);

  return (
    <div className="flex flex-col gap-2" data-testid="share-day" data-date={day.dateKey}>
      <h3 className="font-display text-body font-bold">
        {formatDateTime(date, formattingLocale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone,
        })}
      </h3>

      {day.events.length === 0 ? (
        <p className="text-ink-muted text-body-sm">{t('dayEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.events.map((item) => (
            <li
              key={item.key}
              data-testid="share-event"
              data-busy-only={item.busyOnly ? 'true' : 'false'}
              className="border-border bg-card shadow-sm flex items-baseline gap-3 rounded-xl border px-4 py-3"
            >
              <span className="tabular-time text-ink-secondary w-16 shrink-0 text-body-sm">
                {item.allDay
                  ? t('allDay')
                  : formatDateTime(new Date(item.startsAt), formattingLocale, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone,
                    })}
              </span>
              <span className="flex flex-col">
                {/* A redacted instance arrives carrying the calendar slice's
                    `BUSY_LABEL` sentinel; the label is translated here rather
                    than stored — the query withholds detail, the UI names the
                    withholding. */}
                <span className={item.busyOnly ? 'text-ink-muted italic' : undefined}>
                  {titleOf(item, { untitled: t('untitled'), busy: t('busy') })}
                </span>
                {!item.busyOnly && item.location ? (
                  <span className="text-ink-secondary text-body-sm">{item.location}</span>
                ) : null}
                {/* Who it is for, and nothing at all when that was withheld —
                    `null` from `toShareEvent`, plus the same `busyOnly` gate
                    the location above carries, so a redacted event stays
                    anonymous even if ids ever reach here another way. No
                    "iedereen" fallback either: saying a hidden hour is the
                    whole household's is itself a fact about the household. */}
                {!item.busyOnly && item.memberIds && item.memberIds.length > 0 ? (
                  <span className="text-ink-secondary text-body-sm">
                    {item.memberIds
                      .map((id) => members.find((entry) => entry.id === id)?.displayName)
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
