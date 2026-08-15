'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Checkbox,
  cn,
  Field,
  FieldDescription,
  FieldGroupLabel,
  FieldLabel,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kynite/ui';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DateField } from '@/components/ui/date-field';
import { TimeField } from '@/components/ui/time-field';
import type { Member } from '@/modules/family';
import { idleState } from '../action-state';
import { createRoutineAction, updateRoutineAction } from '../actions';
import { moveStep } from '../domain/steps';
import {
  DEFAULT_TIME_OF_DAY,
  MAX_GRACE_DAYS,
  SCHEDULE_KINDS,
  WEEKDAYS,
  oneOffDateOf,
  todayKeyIn,
  weekdaysOfRule,
  type ScheduleKind,
  type Weekday,
} from '../domain/schedule';
import type { RoutineWithSteps } from '../queries';
import { ROUTINE_ICONS, routineIconOf } from './tokens';

/**
 * The parent-facing routine builder (M07's `(app)/routines`).
 *
 * The schedule UI is a weekday picker plus a time, and it stores an RRULE
 * (`domain/schedule.ts`). That asymmetry is the point: parents think in "school
 * mornings", the data model thinks in RFC-5545, and keeping the rule format
 * means a future "every other week" needs a richer picker rather than a
 * migration.
 *
 * Steps are a local draft list posted as three parallel form fields. Their
 * *array order is the order*, so `sortOrder` is the index and reordering
 * persists by saving — no separate reorder round-trip, no drag-and-drop on a
 * phone-sized screen.
 */

type Draft = {
  /** Empty for a step that does not exist yet. */
  id: string;
  key: string;
  title: string;
  timerSeconds: string;
  sortOrder: number;
};

function draftsFrom(routine: RoutineWithSteps | undefined): Draft[] {
  if (!routine || routine.steps.length === 0) {
    return [
      { id: '', key: 'new-0', title: '', timerSeconds: '', sortOrder: 0 },
      { id: '', key: 'new-1', title: '', timerSeconds: '', sortOrder: 1 },
    ];
  }

  return routine.steps.map((step, index) => ({
    id: step.id,
    key: step.id,
    title: step.title,
    timerSeconds: step.timerSeconds === null ? '' : String(step.timerSeconds),
    sortOrder: index,
  }));
}

const DEFAULT_DAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

export function RoutineDialog({
  members,
  routine,
  timeZone,
}: {
  members: Member[];
  routine?: RoutineWithSteps;
  timeZone: string;
}) {
  const t = useTranslations('routines');
  const isEdit = routine !== undefined;
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? 'brand-outline' : 'default'} size="hub">
            {isEdit ? t('actions.edit') : t('actions.add')}
          </Button>
        }
      />
      <DialogContent size="hub" className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so a cancelled edit leaves nothing behind:
            the draft state is seeded from props on mount rather than reset by
            an effect (which is a cascading render, and lint-banned for it). */}
        {open ? (
          <RoutineForm
            members={members}
            routine={routine}
            timeZone={timeZone}
            onSaved={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RoutineForm({
  members,
  routine,
  timeZone,
  onSaved,
}: {
  members: Member[];
  routine?: RoutineWithSteps;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations('routines');
  const isEdit = routine !== undefined;
  const fieldId = useId();

  const [state, formAction, pending] = useActionState(
    isEdit ? updateRoutineAction : createRoutineAction,
    idleState
  );
  const wasPending = useRef(false);

  const [steps, setSteps] = useState<Draft[]>(() => draftsFrom(routine));
  const [days, setDays] = useState<Weekday[]>(() => {
    const existing = routine ? weekdaysOfRule(routine.schedule.rrule, timeZone) : [];
    return existing.length > 0 ? existing : DEFAULT_DAYS;
  });

  /**
   * M20's one-off. The toggle is a *mode*, not an extra field: a routine is
   * either a rhythm ("every school morning") or a single dated job ("clean the
   * garage on Saturday"), and showing a weekday picker and a date picker at the
   * same time would invite a parent to answer both and mean neither.
   */
  const [kind, setKind] = useState<ScheduleKind>(() =>
    routine && oneOffDateOf(routine.schedule) ? 'once' : 'recurring'
  );
  // Today in the *family's* zone, so a parent in a different one still gets
  // their own household's "today" as the floor and the default.
  const today = todayKeyIn(timeZone);
  const storedOnceDate = (routine ? oneOffDateOf(routine.schedule) : null) ?? null;
  const [onceDate, setOnceDate] = useState<string>(() => storedOnceDate ?? today);
  /**
   * The floor the picker enforces.
   *
   * Creating: today — a one-off in the past is never due, so the picker simply
   * does not offer one.
   *
   * Editing a one-off whose date has already passed: today would make the field
   * invalid on open, and `required` + `min` means the *whole dialog* refuses to
   * submit. A parent renaming yesterday's "Garage opruimen", or fixing its
   * steps, would be told nothing except that Save does not work. So the floor
   * drops to whatever is already stored: the date the parent never touched stays
   * savable, and anything they change it to is still today-or-later. Day keys
   * are `YYYY-MM-DD`, so the lexical minimum is the chronological one.
   */
  const onceDateFloor = storedOnceDate && storedOnceDate < today ? storedOnceDate : today;

  useEffect(() => {
    if (wasPending.current && !pending && state.status === 'idle') onSaved();
    wasPending.current = pending;
  }, [pending, state, onSaved]);

  const toggleDay = (day: Weekday) =>
    setDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]
    );

  const move = (stepId: string, direction: 'up' | 'down') =>
    setSteps((current) => {
      const keyed = current.map((step) => ({ ...step, id: step.key }));
      const moved = moveStep(keyed, stepId, direction);
      return moved.map((step, index) => {
        const original = current.find((entry) => entry.key === step.id)!;
        return { ...original, sortOrder: index };
      });
    });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
        <DialogDescription>{t('dialog.description')}</DialogDescription>
      </DialogHeader>

      {isEdit ? <input type="hidden" name="routineId" value={routine.id} /> : null}
      <input type="hidden" name="active" value="on" />

      <Field>
        <FieldLabel>{t('form.title')}</FieldLabel>
        <Input
          name="title"
          size="hub"
          required
          maxLength={120}
          defaultValue={routine?.title ?? ''}
          autoComplete="off"
        />
      </Field>

      <Field>
        <FieldLabel>{t('form.owner')}</FieldLabel>
        <Select name="ownerMemberId" defaultValue={routine?.ownerMemberId ?? members[0]?.id}>
          <SelectTrigger size="hub" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id} size="hub">
                {member.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('form.ownerHint')}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t('form.icon')}</FieldLabel>
        <Select name="icon" defaultValue={routineIconOf(routine?.icon ?? null)}>
          <SelectTrigger size="hub" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROUTINE_ICONS.map((icon) => (
              <SelectItem key={icon} value={icon} size="hub">
                {t(`icons.${icon}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Not a `Field`: a group of radios names itself (see the note on the
          reward checkbox below). The two pills carry the same indigo selected
          treatment as the weekday picker underneath them, so the whole
          schedule block reads as one control. */}
      <div className="flex w-full flex-col gap-1.5">
        <FieldGroupLabel>{t('form.scheduleKind')}</FieldGroupLabel>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-label={t('form.scheduleKind')}
          data-testid="schedule-kind"
        >
          {SCHEDULE_KINDS.map((option) => {
            const selected = kind === option;
            return (
              <label
                key={option}
                data-testid={`schedule-kind-${option}`}
                data-selected={selected ? 'true' : 'false'}
                className={cn(
                  'flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl px-3 font-display text-sm font-medium transition-colors',
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-ink-secondary hover:bg-surface-hover'
                )}
              >
                <input
                  type="radio"
                  name="scheduleKind"
                  value={option}
                  checked={selected}
                  onChange={() => setKind(option)}
                  className="sr-only"
                />
                {t(`form.scheduleKinds.${option}`)}
              </label>
            );
          })}
        </div>
      </div>

      {kind === 'once' ? (
        <Field>
          <FieldLabel>{t('form.onceDate')}</FieldLabel>
          {/* `DateField`, not `<input type="date">`: a native picker renders in
              the *browser's* locale, which ignored the household's
              `formattingLocale` setting (`src/i18n/formatting-locale.ts`).
              Same ISO `yyyy-MM-dd` value in and out. */}
          <DateField
            name="onceDate"
            size="hub"
            required
            // A one-off in the past is never due (its window has already
            // closed), so the floor is today rather than a validation message
            // about a mistake the picker can simply not offer — except when
            // the stored date is already behind it (see `onceDateFloor`).
            min={onceDateFloor}
            value={onceDate}
            onValueChange={setOnceDate}
          />
          <FieldDescription>{t('form.onceDateHint')}</FieldDescription>
        </Field>
      ) : (
        <Field>
          <FieldLabel>{t('form.days')}</FieldLabel>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('form.days')}>
            {WEEKDAYS.map((day) => {
              const selected = days.includes(day);
              return (
                <label
                  key={day}
                  data-testid={`weekday-${day}`}
                  data-selected={selected ? 'true' : 'false'}
                  className={cn(
                    'flex h-12 min-w-12 cursor-pointer items-center justify-center rounded-xl px-3 font-display text-sm font-medium transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day}
                    checked={selected}
                    onChange={() => toggleDay(day)}
                    className="sr-only"
                  />
                  {t(`weekdays.${day}`)}
                </label>
              );
            })}
          </div>
          <FieldDescription>{t('form.daysHint')}</FieldDescription>
        </Field>
      )}

      {/* Client-side half of the same rule the Server Action enforces: neither
          mode can be saved half-answered. The date input carries `required`
          itself; an empty weekday selection has no single control to hang
          `required` on, so it is stated here. */}
      {kind === 'recurring' && days.length === 0 ? (
        <p role="alert" className="text-sm text-ink-secondary">
          {t('form.daysRequired')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>{t('form.timeOfDay')}</FieldLabel>
          {/* `TimeField` — same reason as `onceDate` above: 12/24-hour display
              followed the browser, not `formattingLocale`. Still `HH:mm`. */}
          <TimeField
            name="timeOfDay"
            size="hub"
            required
            defaultValue={routine?.schedule.timeOfDay ?? DEFAULT_TIME_OF_DAY}
          />
        </Field>

        <Field>
          <FieldLabel>{t('form.graceDays')}</FieldLabel>
          <Input
            type="number"
            name="graceDays"
            size="hub"
            min={0}
            max={MAX_GRACE_DAYS}
            defaultValue={routine?.schedule.graceDays ?? 1}
          />
          <FieldDescription>{t('form.graceDaysHint')}</FieldDescription>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>{t('form.starsPerCompletion')}</FieldLabel>
          <Input
            type="number"
            name="starsPerCompletion"
            size="hub"
            min={0}
            max={20}
            defaultValue={routine?.starsPerCompletion ?? 1}
          />
        </Field>

        {/* Not a `Field`: Base UI's `Field.Root` owns the `id`/`name` of the
            control inside it, which is wrong for a plain checkbox we name
            ourselves. `FieldGroupLabel` exists for exactly this. */}
        <div className="flex w-full flex-col gap-1.5">
          <FieldGroupLabel id={`${fieldId}-reward-label`}>
            {t('form.rewardEnabled')}
          </FieldGroupLabel>
          {/* Shared `Checkbox` primitive (`ui/checkbox.tsx`) — Base UI's hidden
              native input is what makes this a real form field (uncontrolled,
              `defaultChecked` only), same as the old hand-rolled `peer` pair,
              minus reimplementing it. */}
          <label className="flex h-12 items-center gap-3 text-body-sm text-ink-secondary">
            <Checkbox
              id={`${fieldId}-reward`}
              name="rewardEnabled"
              defaultChecked={routine ? routine.rewardEnabled : true}
            />
            {t('form.rewardEnabledHint')}
          </label>
        </div>
      </div>

      {/* Also not a `Field`: a `Field.Root` propagates one `id` and one `name`
          to every input beneath it, which silently renamed each step's title
          input to the timer's name and made all of them share one label. A
          repeater is a group of independent controls, so it gets a group
          label and keeps its own names. */}
      <div className="flex w-full flex-col gap-1.5">
        <FieldGroupLabel>{t('form.steps')}</FieldGroupLabel>
        <ul data-testid="step-editor" className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={step.key} data-testid="step-editor-row" className="flex items-center gap-2">
              <input type="hidden" name="stepId" value={step.id} />
              <Input
                name="stepTitle"
                size="hub"
                maxLength={120}
                placeholder={t('form.stepTitlePlaceholder')}
                aria-label={t('form.stepNumber', { number: index + 1 })}
                value={step.title}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((entry) =>
                      entry.key === step.key ? { ...entry, title: event.target.value } : entry
                    )
                  )
                }
                className="flex-1"
              />
              <Input
                type="number"
                name="stepTimerSeconds"
                size="hub"
                min={0}
                max={7200}
                placeholder={t('form.stepTimerPlaceholder')}
                aria-label={t('form.stepTimer', { number: index + 1 })}
                value={step.timerSeconds}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((entry) =>
                      entry.key === step.key
                        ? { ...entry, timerSeconds: event.target.value }
                        : entry
                    )
                  )
                }
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-hub"
                aria-label={t('form.moveUp', { number: index + 1 })}
                disabled={index === 0}
                onClick={() => move(step.key, 'up')}
              >
                <Icon name="arrow_upward" size="md" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-hub"
                aria-label={t('form.moveDown', { number: index + 1 })}
                disabled={index === steps.length - 1}
                onClick={() => move(step.key, 'down')}
              >
                <Icon name="arrow_downward" size="md" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-hub"
                aria-label={t('form.removeStep', { number: index + 1 })}
                disabled={steps.length <= 1}
                onClick={() =>
                  setSteps((current) => current.filter((entry) => entry.key !== step.key))
                }
              >
                <Icon name="delete" size="md" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="brand-outline"
          size="hub"
          onClick={() =>
            setSteps((current) => [
              ...current,
              {
                id: '',
                key: `new-${Date.now()}-${current.length}`,
                title: '',
                timerSeconds: '',
                sortOrder: current.length,
              },
            ])
          }
        >
          <Icon name="add" size="md" inline="start" />
          {t('actions.addStep')}
        </Button>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose
          render={
            <Button type="button" variant="ghost" size="hub">
              {t('actions.cancel')}
            </Button>
          }
        />
        <Button
          type="submit"
          size="hub"
          disabled={pending || (kind === 'recurring' && days.length === 0)}
        >
          {t('actions.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
