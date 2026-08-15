import { getTranslations } from 'next-intl/server';
import { Card, GripHandle, Icon, IconMedallion, MemberFace, StarCount } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import {
  MEMBER_COLOR_CLASSES,
  getHouseholdFormattingLocale,
  initialsOf,
  type Member,
} from '@/modules/family';
import { hasGraduated } from '../domain/stars';
import { isSchedulable, oneOffDateOf, weekdaysOfRule } from '../domain/schedule';
import type { OwnerOption } from '../page-data';
import type { RoutineWithSteps } from '../queries';
import { GraduateRoutineButton } from './graduate-routine-button';
import { RoutineActiveSwitch } from './routine-active-switch';
import { RoutineDialog } from './routine-dialog';
import { ROUTINE_ICON_TILE, routineIconOf } from './tokens';

/**
 * The parent's routine list (`Routines.dc.html`, mobile beheer).
 *
 * Grouped by child, because that is the question a parent actually opens this
 * screen with — "what is Mila's morning" — and never as one flat roster where
 * two children's routines interleave. Each group is that child's face, their
 * name, and how many routines they have; each row is what the routine *is*,
 * never how it went. Completion belongs to the child's own board (research
 * §Decisions 3: no screen puts two children's progress side by side).
 *
 * A row is a grip, the routine's own coloured medallion, its title and its
 * schedule, what it pays, and the switch. Tapping it opens the builder. The
 * grip is honest about order: the array order *is* the order, which is what the
 * builder saves.
 *
 * The card at the bottom is the fade path (research §Decisions 7, FR17), and
 * it is written as a promotion throughout — the stars stop, the routine stays,
 * and nothing a child already earned is touched.
 */

export type ManagedRoutine = RoutineWithSteps;

export async function RoutineManager({
  routines,
  members,
  owners,
  timeZone,
  canWrite,
}: {
  routines: ManagedRoutine[];
  members: Member[];
  /** The builder's "Voor wie" options — faces already resolved (`page-data.ts`). */
  owners: OwnerOption[];
  timeZone: string;
  canWrite: boolean;
}) {
  const t = await getTranslations('routines');
  const formattingLocale = await getHouseholdFormattingLocale();

  /**
   * A date key rendered in the reader's locale. Noon UTC, not midnight: the key
   * already *is* the family's calendar day, and reading it back at midnight
   * would let any zone west of UTC render the day before.
   */
  const dayOf = (dateKey: string) =>
    formatDateTime(new Date(`${dateKey}T12:00:00Z`), formattingLocale, {
      day: 'numeric',
      month: 'short',
    });

  const scheduleOf = (routine: ManagedRoutine) => {
    const onceDate = oneOffDateOf(routine.schedule);
    if (onceDate) return t('schedule.onceShort', { date: dayOf(onceDate) });

    // A routine whose schedule names nothing a board can expand is not a daily
    // routine — it is a routine that never runs. Saying so is the only reading
    // a parent can act on; "Elke dag" over an empty board is the one that
    // wastes an evening (`domain/schedule.ts` → `isSchedulable`).
    if (!isSchedulable(routine.schedule)) return t('schedule.none');

    const days = weekdaysOfRule(routine.schedule.rrule, timeZone);
    // `FREQ=DAILY` comes back as all seven — the same list the picker shows
    // ticked, so the row and the builder cannot disagree.
    const when =
      days.length === 7 ? t('schedule.daily') : days.map((day) => t(`weekdays.${day}`)).join(' ');
    const time = routine.schedule.timeOfDay;

    return t('manage.scheduleLine', {
      when: time ? `${when} ${time}` : when,
      steps: routine.steps.length,
    });
  };

  if (routines.length === 0) {
    return (
      <p data-testid="routines-empty" className="text-body-lg text-ink-secondary">
        {t('empty')}
      </p>
    );
  }

  // Children first and then everybody else, each with their own routines in the
  // order they are stored. A member with none is not a group — an empty heading
  // is a question nobody asked.
  const groups = [...members]
    .sort((left, right) => Number(right.role === 'child') - Number(left.role === 'child'))
    .map((member) => ({
      member,
      routines: routines.filter((routine) => routine.ownerMemberId === member.id),
    }))
    .filter((group) => group.routines.length > 0);

  const graduated = routines.filter((routine) => hasGraduated(routine));
  // The fade candidates: the routines that have been running longest and still
  // pay. "Longest running" is what the database actually knows — nothing here
  // claims to have measured a habit.
  const candidates = routines
    .filter((routine) => !hasGraduated(routine) && routine.active)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-6" data-testid="routine-manager">
      {groups.map((group) => (
        <section key={group.member.id} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <MemberFace
              size="xs"
              name={group.member.displayName}
              avatarUrl={group.member.avatarUrl}
              initials={initialsOf(group.member.displayName)}
              surfaceClass={MEMBER_COLOR_CLASSES[group.member.color].surface}
            />
            <h3 className="font-display text-body font-bold">{group.member.displayName}</h3>
            <span className="text-caption text-ink-muted">
              {t('manage.routineCount', { count: group.routines.length })}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {group.routines.map((routine) => (
              <li
                key={routine.id}
                data-testid="routine-row"
                data-routine-id={routine.id}
                data-active={routine.active ? 'true' : 'false'}
                // An inactive routine recedes by one opacity and keeps every
                // word legible. It is paused, not broken.
                className={
                  'flex items-center gap-3 rounded-2xl border border-line-subtle bg-card px-3.5 py-3' +
                  (routine.active ? '' : ' opacity-70')
                }
              >
                <GripHandle />
                <IconMedallion
                  icon={routineIconOf(routine.icon)}
                  tint={routine.active ? 'none' : 'muted'}
                  shape="squircle"
                  size="md"
                  className={routine.active ? ROUTINE_ICON_TILE[routineIconOf(routine.icon)] : ''}
                />

                {canWrite ? (
                  <RoutineDialog
                    owners={owners}
                    routine={routine}
                    timeZone={timeZone}
                    variant="row"
                    scheduleLine={routine.active ? scheduleOf(routine) : t('manage.paused')}
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">
                      {routine.title}
                    </span>
                    <span className="tnum block truncate text-caption text-ink-secondary">
                      {routine.active ? scheduleOf(routine) : t('manage.paused')}
                    </span>
                  </div>
                )}

                {hasGraduated(routine) ? (
                  <Icon
                    name="workspace_premium"
                    filled
                    size="sm"
                    className="shrink-0 text-brand"
                    label={t('graduated')}
                  />
                ) : routine.starsPerCompletion > 0 ? (
                  // Bare, not a pill: the row already carries a medallion, a
                  // title, a schedule line and a switch (`Routines.dc.html`
                  // r216-225).
                  <StarCount
                    value={routine.starsPerCompletion}
                    srLabel={t('starsPerStep', { count: routine.starsPerCompletion })}
                    size="sm"
                    tone="bare"
                  />
                ) : null}

                {canWrite ? (
                  <RoutineActiveSwitch
                    routineId={routine.id}
                    title={routine.title}
                    active={routine.active}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {canWrite && (candidates.length > 0 || graduated.length > 0) ? (
        <Card className="gap-3 p-4" data-testid="graduation-card">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Icon name="workspace_premium" filled size="sm" className="text-brand" />
              <span className="font-display text-body font-bold">{t('manage.graduateTitle')}</span>
            </div>
            <p className="text-caption leading-relaxed text-ink-secondary">
              {t('manage.graduateBody')}
            </p>
          </div>

          {candidates.map((routine) => (
            <div
              key={routine.id}
              className="flex items-center gap-2.5 border-t border-line-subtle pt-2.5"
            >
              <IconMedallion
                icon={routineIconOf(routine.icon)}
                tint="none"
                shape="squircle"
                size="sm"
                className={ROUTINE_ICON_TILE[routineIconOf(routine.icon)]}
              />
              <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">
                {routine.title} ·{' '}
                <span className="text-ink-secondary">
                  {members.find((entry) => entry.id === routine.ownerMemberId)?.displayName ?? ''}
                </span>
              </span>
              <GraduateRoutineButton
                routineId={routine.id}
                title={routine.title}
                graduated={false}
                compact
              />
            </div>
          ))}

          <div className="flex items-center gap-2 border-t border-line-subtle pt-2.5">
            <Icon name="school" size="sm" className="text-ink-muted" />
            <span className="text-caption text-ink-secondary">
              {t('manage.graduatedCount', { count: graduated.length })}
            </span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
