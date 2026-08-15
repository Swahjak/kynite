'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@kynite/ui';
import { EmptyState, MediaRow } from '@/components/kynite';
import { GraduateRoutineButton } from './graduate-routine-button';

/**
 * Every routine's fade state, in one place (M16).
 *
 * The per-routine control already exists on the routines builder; what M16
 * adds is the *list*, and the list is the point. Fade is per-routine state by
 * design (research §Decisions 7) — a routine that has become a habit stops
 * paying stars while the others keep going — and until now a parent could only
 * see that one routine at a time, scattered across the builder. Reviewing "who
 * has grown out of what" is a household-level question and it needs a
 * household-level surface.
 *
 * The button is the same component and the same action as the builder's
 * (`setRoutineRewardAction`), so there is exactly one way to flip this and the
 * two surfaces cannot disagree. The action writes `rewardEnabled`/`fadedAt`
 * for the one routine named in the form and nothing else.
 *
 * Copy note: a graduated routine is labelled as an achievement, never as a
 * loss. Nothing was taken away — stars already earned are untouched — and this
 * list is read by parents standing next to their children.
 */
export type GraduationRoutine = {
  id: string;
  title: string;
  ownerName: string;
  graduated: boolean;
};

export function RoutineGraduationList({ routines }: { routines: GraduationRoutine[] }) {
  const t = useTranslations('settings.graduation');

  if (routines.length === 0) {
    return <EmptyState title={t('empty')} />;
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="graduation-list">
      {routines.map((routine) => (
        <li
          key={routine.id}
          data-testid="graduation-row"
          data-routine-id={routine.id}
          data-graduated={routine.graduated ? 'true' : 'false'}
        >
          <MediaRow
            variant="outlined"
            title={routine.title}
            meta={<span className="text-caption text-ink-secondary">{routine.ownerName}</span>}
            actions={
              <>
                <Badge variant="outline">
                  {t(routine.graduated ? 'states.graduated' : 'states.earning')}
                </Badge>
                <GraduateRoutineButton
                  routineId={routine.id}
                  title={routine.title}
                  graduated={routine.graduated}
                />
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}
