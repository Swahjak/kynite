'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  cn,
  GripHandle,
  Icon,
  IconMedallion,
  Input,
  MemberChip,
  Overline,
  SegmentedControl,
  StarStepper,
} from '@kynite/ui';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { DeleteRoutineButton } from './delete-routine-button';
import { ROUTINE_ICONS, ROUTINE_ICON_TILE, routineIconOf } from './tokens';

/**
 * The routine builder (`Routines.dc.html`, mobile routinebouwer).
 *
 * **One continuous form, not a wizard.** Every field is on screen at once —
 * title and icon, who it is for, when it runs, its steps, what it pays — so
 * editing a routine costs exactly what creating one costs. A wizard is a good
 * shape for something you do once; a routine is something a household adjusts
 * on a Tuesday evening because football moved, and three "Next" taps to change
 * a time is how a screen stops being opened.
 *
 * The schedule UI is a weekday picker plus a time, and it stores an RRULE
 * (`domain/schedule.ts`). That asymmetry is the point: parents think in "school
 * mornings", the data model thinks in RFC-5545, and keeping the rule format
 * means a future "every other week" needs a richer picker rather than a
 * migration.
 *
 * Steps are a local draft list posted as three parallel form fields. Their
 * *array order is the order*, so `sortOrder` is the index and reordering
 * persists by saving — no separate reorder round-trip. The grip is the design's
 * affordance; the two arrow buttons beside it are the one that works with a
 * keyboard and a screen reader, and they are not hidden behind a hover.
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
  compact = false,
}: {
  members: Member[];
  routine?: RoutineWithSteps;
  timeZone: string;
  /** The icon-only trigger the parent's list row uses, instead of a labelled button. */
  compact?: boolean;
}) {
  const t = useTranslations('routines');
  const isEdit = routine !== undefined;
  const [open, setOpen] = useState(false);

  const trigger =
    compact && routine ? (
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label={t('actions.editNamed', { title: routine.title })}
      >
        <Icon name="more_horiz" size="sm" />
      </Button>
    ) : compact ? (
      <Button size="icon-hub" className="rounded-full" aria-label={t('actions.add')}>
        <Icon name="add" size="md" />
      </Button>
    ) : (
      <Button variant={isEdit ? 'brand-outline' : 'default'} size="hub">
        {isEdit ? t('actions.edit') : t('actions.add')}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      {/* Full height on a phone: this is the sheets' whole-screen builder, and
          a form with six sections inside a floating box is a form that scrolls
          twice. */}
      <DialogContent size="hub" className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-lg">
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
  const [icon, setIcon] = useState(() => routineIconOf(routine?.icon ?? null));
  const [owner, setOwner] = useState(() => routine?.ownerMemberId ?? members[0]?.id ?? '');
  const [stars, setStars] = useState(() => routine?.starsPerCompletion ?? 1);

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

  const incomplete = kind === 'recurring' && days.length === 0;
  // The delete control is its own `<form>` (one routine, one action), so it
  // cannot live inside this one — nested forms are invalid. The submit button
  // in the header reaches back into the form by id instead.
  const formId = useId();

  return (
    <div className="flex max-h-[92dvh] min-h-0 flex-col">
      {/* The sheets' builder bar: leave, what this is, save. Save is the only
          filled control on the screen. */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
        <DialogClose
          render={
            <Button type="button" variant="ghost" size="icon" aria-label={t('actions.cancel')}>
              <Icon name="chevron_left" size="md" />
            </Button>
          }
        />
        <DialogTitle className="font-display text-h3 font-extrabold">
          {isEdit ? t('dialog.editTitle') : t('dialog.addTitle')}
        </DialogTitle>
        <Button
          type="submit"
          form={formId}
          size="sm"
          className="rounded-4xl"
          disabled={pending || incomplete}
        >
          {t('actions.save')}
        </Button>
      </div>

      <DialogDescription className="sr-only">{t('dialog.description')}</DialogDescription>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
        <form id={formId} action={formAction} className="flex flex-col gap-5">
          {isEdit ? <input type="hidden" name="routineId" value={routine.id} /> : null}
          <input type="hidden" name="active" value="on" />
          {/* Preserved rather than edited here: whether a routine still pays is
            the graduation decision, and it is made on the list's own card. */}
          {(routine ? routine.rewardEnabled : true) ? (
            <input type="hidden" name="rewardEnabled" value="on" />
          ) : null}
          <input type="hidden" name="ownerMemberId" value={owner} />
          <input type="hidden" name="icon" value={icon} />

          {/* ── Titel & icoon ─────────────────────────────────────────────── */}
          <div>
            <Overline className="mb-2">{t('form.titleAndIcon')}</Overline>
            <div className="flex items-center gap-2.5">
              <IconMedallion
                icon={icon}
                tint="none"
                shape="squircle"
                size="xl"
                className={cn('border-2 border-primary', ROUTINE_ICON_TILE[icon])}
              />
              <Input
                name="title"
                required
                maxLength={120}
                defaultValue={routine?.title ?? ''}
                autoComplete="off"
                aria-label={t('form.title')}
                className="flex-1"
              />
            </div>

            <div
              role="radiogroup"
              aria-label={t('form.icon')}
              className="mt-2.5 flex flex-wrap gap-2"
            >
              {ROUTINE_ICONS.map((option) => {
                const selected = option === icon;
                return (
                  <label
                    key={option}
                    data-testid={`routine-icon-${option}`}
                    data-selected={selected ? 'true' : 'false'}
                    className={cn(
                      'flex size-10 cursor-pointer items-center justify-center rounded-2xl transition-colors',
                      selected
                        ? cn('ring-2 ring-primary', ROUTINE_ICON_TILE[option])
                        : 'bg-surface-container text-ink-muted hover:text-ink-secondary'
                    )}
                  >
                    <input
                      type="radio"
                      name="iconChoice"
                      value={option}
                      checked={selected}
                      onChange={() => setIcon(option)}
                      className="sr-only"
                    />
                    <Icon name={option} size="sm" label={t(`icons.${option}`)} />
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Voor wie ──────────────────────────────────────────────────── */}
          <div>
            <Overline className="mb-2">{t('form.owner')}</Overline>
            <div role="radiogroup" aria-label={t('form.owner')} className="flex flex-wrap gap-2">
              {members.map((member) => {
                const selected = member.id === owner;
                return (
                  <label key={member.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="ownerChoice"
                      value={member.id}
                      checked={selected}
                      onChange={() => setOwner(member.id)}
                      className="sr-only"
                    />
                    <MemberChip
                      name={member.displayName}
                      avatarUrl={member.avatarUrl}
                      selected={selected}
                      data-testid={`routine-owner-${member.id}`}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Schema ────────────────────────────────────────────────────── */}
          <div>
            <Overline className="mb-2">{t('form.scheduleKind')}</Overline>
            <SegmentedControl
              name="scheduleKind"
              testIdPrefix="schedule-kind"
              label={t('form.scheduleKind')}
              value={kind}
              onValueChange={setKind}
              className="mb-3"
              options={SCHEDULE_KINDS.map((option) => ({
                value: option,
                label: t(`form.scheduleKinds.${option}`),
              }))}
            />

            {kind === 'once' ? (
              <DateField
                name="onceDate"
                size="hub"
                required
                aria-label={t('form.onceDate')}
                // A one-off in the past is never due (its window has already
                // closed), so the floor is today rather than a validation message
                // about a mistake the picker can simply not offer — except when
                // the stored date is already behind it (see `onceDateFloor`).
                min={onceDateFloor}
                value={onceDate}
                onValueChange={setOnceDate}
              />
            ) : (
              <div className="mb-3 flex gap-1.5" role="group" aria-label={t('form.days')}>
                {WEEKDAYS.map((day) => {
                  const selected = days.includes(day);
                  return (
                    <label
                      key={day}
                      data-testid={`weekday-${day}`}
                      data-selected={selected ? 'true' : 'false'}
                      className={cn(
                        'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl font-display text-body-sm font-bold transition-colors',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface-container text-ink-muted hover:text-ink-secondary'
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
            )}

            {/* Client-side half of the same rule the Server Action enforces:
              neither mode can be saved half-answered. */}
            {incomplete ? (
              <p role="alert" className="mb-3 text-caption text-ink-secondary">
                {t('form.daysRequired')}
              </p>
            ) : null}

            <div className="flex gap-2.5">
              <label className="flex flex-1 flex-col gap-1 rounded-xl bg-surface-container px-3.5 py-2.5">
                <span className="text-[11px] text-ink-muted">{t('form.timeOfDay')}</span>
                {/* `TimeField` — 12/24-hour display follows the household's
                  `formattingLocale`, not the browser. Still `HH:mm`. */}
                <TimeField
                  name="timeOfDay"
                  required
                  defaultValue={routine?.schedule.timeOfDay ?? DEFAULT_TIME_OF_DAY}
                  className="border-0 bg-transparent px-0 font-display text-h3 font-bold shadow-none"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 rounded-xl bg-surface-container px-3.5 py-2.5">
                <span className="text-[11px] text-ink-muted">{t('form.graceDays')}</span>
                <Input
                  type="number"
                  name="graceDays"
                  min={0}
                  max={MAX_GRACE_DAYS}
                  defaultValue={routine?.schedule.graceDays ?? 1}
                  className="border-0 bg-transparent px-0 font-display text-h3 font-bold shadow-none"
                />
              </label>
            </div>
          </div>

          {/* ── Stappen ───────────────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Overline>{t('form.steps')}</Overline>
              <span className="text-caption text-ink-muted">{t('form.stepsHint')}</span>
            </div>

            <ul data-testid="step-editor" className="flex flex-col gap-2">
              {steps.map((step, index) => (
                <li
                  key={step.key}
                  data-testid="step-editor-row"
                  className="flex items-center gap-2 rounded-xl border border-line-subtle bg-card px-2.5 py-2"
                >
                  <input type="hidden" name="stepId" value={step.id} />
                  <GripHandle />
                  <Input
                    name="stepTitle"
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
                    className="min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none"
                  />
                  <Input
                    type="number"
                    name="stepTimerSeconds"
                    min={0}
                    max={7200}
                    placeholder={t('form.stepTimerShort')}
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
                    className="w-16 shrink-0 border-0 bg-surface-container px-2 text-caption shadow-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('form.moveUp', { number: index + 1 })}
                    disabled={index === 0}
                    onClick={() => move(step.key, 'up')}
                  >
                    <Icon name="arrow_upward" size="sm" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('form.moveDown', { number: index + 1 })}
                    disabled={index === steps.length - 1}
                    onClick={() => move(step.key, 'down')}
                  >
                    <Icon name="arrow_downward" size="sm" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('form.removeStep', { number: index + 1 })}
                    disabled={steps.length <= 1}
                    onClick={() =>
                      setSteps((current) => current.filter((entry) => entry.key !== step.key))
                    }
                  >
                    <Icon name="delete" size="sm" />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="ghost"
              className="mt-2 min-h-12 w-full rounded-xl border-2 border-line-subtle border-dashed text-brand-ink"
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
              <Icon name="add" size="sm" />
              {t('actions.addStep')}
            </Button>
          </div>

          {/* ── Beloning ──────────────────────────────────────────────────── */}
          <div>
            <Overline className="mb-2">{t('form.reward')}</Overline>
            <div className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-card p-3.5">
              <Icon name="star" filled size="md" className="text-gold" />
              <span className="flex-1 text-body-sm font-semibold">
                {t('form.starsPerCompletion')}
              </span>
              <StarStepper
                name="starsPerCompletion"
                value={stars}
                onValueChange={setStars}
                max={20}
                copy={{
                  decrease: t('form.fewerStars'),
                  increase: t('form.moreStars'),
                  value: t('starsPerStep', { count: stars }),
                }}
              />
            </div>
          </div>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}
        </form>

        {isEdit ? <DeleteRoutineButton routineId={routine.id} title={routine.title} /> : null}
      </div>
    </div>
  );
}
