import { getFormatter, getTranslations } from 'next-intl/server';
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
 */
export async function ShareBoard({ token, view }: { token: string; view: ShareView }) {
  const t = await getTranslations('sharing.view');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 pb-16 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">
          {view.familyName ? t('title', { family: view.familyName }) : t('titleFallback')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {view.role === 'contributor' ? t('roleContributor') : t('roleViewer')}
        </p>
      </header>

      {view.showRoutines && view.routines.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-h3 font-semibold">{t('routinesTitle')}</h2>
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
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-h3 font-semibold">{t('scheduleTitle')}</h2>
          {view.days.map((day) => (
            <DayRow key={day.dateKey} day={day} members={view.members} />
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
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{routine.title}</h3>
        {member ? (
          <span className="text-sm text-muted-foreground">{member.displayName}</span>
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
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-base"
              >
                <span aria-hidden className="size-6 shrink-0 rounded-full border border-border" />
                <span className={step.done ? 'text-muted-foreground line-through' : undefined}>
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

async function DayRow({ day, members }: { day: ShareDay; members: ShareMember[] }) {
  const t = await getTranslations('sharing.view');
  const format = await getFormatter();

  const date = new Date(`${day.dateKey}T12:00:00Z`);

  return (
    <div className="flex flex-col gap-2" data-testid="share-day" data-date={day.dateKey}>
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {format.dateTime(date, { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>

      {day.events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dayEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.events.map((item) => (
            <li
              key={item.key}
              data-testid="share-event"
              data-busy-only={item.busyOnly ? 'true' : 'false'}
              className="flex items-baseline gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">
                {item.allDay
                  ? t('allDay')
                  : format.dateTime(new Date(item.startsAt), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
              </span>
              <span className="flex flex-col">
                {/* A redacted instance arrives carrying the calendar slice's
                    `BUSY_LABEL` sentinel; the label is translated here rather
                    than stored — the query withholds detail, the UI names the
                    withholding. */}
                <span className={item.busyOnly ? 'italic text-muted-foreground' : undefined}>
                  {item.busyOnly ? t('busy') : item.title}
                </span>
                {!item.busyOnly && item.location ? (
                  <span className="text-sm text-muted-foreground">{item.location}</span>
                ) : null}
                {item.memberIds.length > 0 ? (
                  <span className="text-sm text-muted-foreground">
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
