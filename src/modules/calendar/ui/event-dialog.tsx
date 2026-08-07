'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitGuard } from '@/components/ui/use-submit-guard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Member } from '@/modules/family';
import { idleState } from '../action-state';
import { createEventAction, deleteEventAction, updateEventAction } from '../actions';
import { presetFor, RECURRENCE_PRESETS } from '../domain/presets';
import { toWall } from '../domain/zone';
import { EVENT_CATEGORIES, EVENT_TYPES } from '../schema';
import type { CalendarEvent } from '../queries';
import { CATEGORY_CLASSES } from './tokens';

/**
 * Event create/edit/delete, from the parent app only (`event:write` is `deny`
 * for children and devices — the hub never renders this).
 *
 * The one genuinely tricky control is the recurrence scope. Editing an
 * instance of a series is ambiguous in a way no other edit is: "this one" and
 * "all of them" are both reasonable readings, and guessing wrong silently
 * rewrites a custody schedule. So a series edit asks, and the answer maps onto
 * the two shapes §3 defines — an override child + parent EXDATE, or a plain
 * series update.
 */

export type WritableCalendar = { id: string; summary: string };

export type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = create. */
  event?: CalendarEvent | null;
  members: Member[];
  calendars: WritableCalendar[];
  timeZone: string;
  /** Prefilled start for a create, usually "now, rounded up". */
  defaultStart?: Date;
};

/**
 * M19: the form is grouped into what / when / who / where sections rather than
 * being fourteen fields in a column. The mockups have no event dialog of their
 * own, so the idiom is borrowed from the rest of the stitch system — an
 * overline section heading, a hairline rule, 48px targets and pill-shaped
 * choice chips — inside the shadcn primitives, which stay the component base
 * (owner decision). Nothing about the behaviour moved: same field names, same
 * test ids, same recurrence-scope semantics.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="label-overline text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

/** An instant → the `datetime-local` value that reads as it does in `timeZone`. */
function toLocalInput(instant: Date, timeZone: string, allDay: boolean): string {
  const wall = toWall(instant, allDay ? 'UTC' : timeZone);
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
  return allDay ? date : `${date}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  members,
  calendars,
  timeZone,
  defaultStart,
}: EventDialogProps) {
  const t = useTranslations('calendar');
  const router = useRouter();
  const isEdit = !!event;

  const [state, formAction, pending] = useActionState(
    isEdit ? updateEventAction : createEventAction,
    idleState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(deleteEventAction, idleState);

  // Seeded from the event on mount only. `CalendarShell` gives this component
  // a `key` derived from the selection, so picking a different event remounts
  // it and every field re-seeds — no state-syncing effect required.
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [scope, setScope] = useState<'series' | 'occurrence'>('occurrence');
  // M18: a delete is confirmed rather than performed on the first tap.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteGuard = useSubmitGuard(deletePending);

  const wasPending = useRef(false);

  useEffect(() => {
    const busy = pending || deletePending;
    const settled = state.status === 'idle' && deleteState.status === 'idle';
    if (wasPending.current && !busy && settled) {
      onOpenChange(false);
      // No SSE until M10: pull the server's new state back explicitly.
      router.refresh();
    }
    wasPending.current = busy;
  }, [pending, deletePending, state, deleteState, onOpenChange, router]);

  const start = event?.startsAt ?? defaultStart ?? new Date();
  const end = event?.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000);
  const error = state.status === 'error' ? state.error : null;
  const deleteError = deleteState.status === 'error' ? deleteState.error : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="hub"
        className="max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:max-w-lg sm:p-6"
        data-testid="event-dialog"
      >
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="font-display text-h2 font-bold">
              {isEdit ? t('dialog.editTitle') : t('dialog.addTitle')}
            </DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>

          {isEdit && <input type="hidden" name="eventId" value={event.seriesId} />}
          {isEdit && event.recurring && (
            <>
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="occurrenceStart" value={event.startsAt.toISOString()} />
            </>
          )}

          <Section title={t('dialog.sections.what')}>
            <Field>
              <FieldLabel>{t('form.title')}</FieldLabel>
              <Input
                name="title"
                size="hub"
                required
                maxLength={200}
                defaultValue={event?.title ?? ''}
                autoComplete="off"
                data-testid="event-title"
              />
            </Field>

            {/* M18. The column has existed since M03 and `actions.ts` has
                validated it since M06 — there was simply no input, so a note a
                parent added in Google could be read by the sync and never
                written or edited here. */}
            <Field>
              <FieldLabel>{t('form.description')}</FieldLabel>
              <Textarea
                name="description"
                size="hub"
                maxLength={4000}
                defaultValue={event?.description ?? ''}
                data-testid="event-description"
              />
              <FieldDescription>{t('form.descriptionHint')}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>{t('form.eventType')}</FieldLabel>
              <Select name="eventType" defaultValue={event?.eventType ?? 'appointment'}>
                <SelectTrigger size="hub" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} size="hub">
                      {t(`types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t('form.category')}</FieldLabel>
              {/* Radios, not a select: the whole point of a colour is seeing it. */}
              <div
                role="radiogroup"
                aria-label={t('form.category')}
                className="flex flex-wrap gap-2"
              >
                <label className="flex min-h-12 cursor-pointer items-center gap-1.5 rounded-4xl border border-border px-4 transition-colors has-checked:border-ring has-checked:bg-accent">
                  <input
                    type="radio"
                    name="category"
                    value=""
                    defaultChecked={!event?.category}
                    className="sr-only"
                  />
                  <Icon name="palette" size="sm" />
                  <span className="text-caption">{t('form.categoryInherit')}</span>
                </label>
                {EVENT_CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className="flex size-12 cursor-pointer items-center justify-center rounded-4xl border-2 border-transparent transition-transform hover:scale-105 has-checked:border-ring"
                    title={t(`categories.${category}`)}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={category}
                      defaultChecked={event?.category === category}
                      className="sr-only"
                    />
                    <span className="sr-only">{t(`categories.${category}`)}</span>
                    <span className={cn('size-7 rounded-full', CATEGORY_CLASSES[category].solid)} />
                  </label>
                ))}
              </div>
            </Field>
          </Section>

          <Section title={t('dialog.sections.when')}>
            <Field>
              <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-4xl border border-border px-4 has-checked:border-ring has-checked:bg-accent">
                <input
                  type="checkbox"
                  name="allDay"
                  className="size-5"
                  checked={allDay}
                  onChange={(changeEvent) => setAllDay(changeEvent.target.checked)}
                />
                <span className="text-body">{t('form.allDay')}</span>
              </label>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t('form.startsAt')}</FieldLabel>
                <Input
                  type={allDay ? 'date' : 'datetime-local'}
                  name="startsAt"
                  size="hub"
                  required
                  defaultValue={toLocalInput(start, timeZone, allDay)}
                  key={`start-${allDay}`}
                  data-testid="event-starts-at"
                />
              </Field>
              <Field>
                <FieldLabel>{t('form.endsAt')}</FieldLabel>
                <Input
                  type={allDay ? 'date' : 'datetime-local'}
                  name="endsAt"
                  size="hub"
                  required
                  defaultValue={toLocalInput(end, timeZone, allDay)}
                  key={`end-${allDay}`}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>{t('form.recurrence')}</FieldLabel>
              <Select name="recurrence" defaultValue={presetFor(event?.rrule ?? null)}>
                <SelectTrigger size="hub" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset} size="hub">
                      {t(`recurrence.${preset}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isEdit && event.recurring && (
              <Field>
                <FieldLabel>{t('form.scope')}</FieldLabel>
                <div role="radiogroup" aria-label={t('form.scope')} className="flex flex-col gap-2">
                  {(['occurrence', 'series'] as const).map((option) => (
                    <label
                      key={option}
                      className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 transition-colors has-checked:border-ring has-checked:bg-accent"
                    >
                      <input
                        type="radio"
                        name="scopeChoice"
                        value={option}
                        checked={scope === option}
                        onChange={() => setScope(option)}
                        className="size-5"
                      />
                      <span className="text-body-sm">{t(`scope.${option}`)}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
          </Section>

          <Section title={t('dialog.sections.who')}>
            <Field>
              <FieldLabel>{t('form.owner')}</FieldLabel>
              <Select name="ownerMemberId" defaultValue={event?.ownerMemberId ?? ''}>
                <SelectTrigger size="hub" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" size="hub">
                    {t('form.everyone')}
                  </SelectItem>
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
              <FieldLabel>{t('form.attendees')}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex min-h-12 cursor-pointer items-center gap-2 rounded-4xl border border-border px-4 transition-colors has-checked:border-ring has-checked:bg-accent"
                  >
                    <input
                      type="checkbox"
                      name="attendeeMemberIds"
                      value={member.id}
                      defaultChecked={event?.attendeeMemberIds.includes(member.id)}
                      className="size-5"
                    />
                    <span className="text-body-sm">{member.displayName}</span>
                  </label>
                ))}
              </div>
            </Field>
          </Section>

          <Section title={t('dialog.sections.where')}>
            <Field>
              <FieldLabel>{t('form.location')}</FieldLabel>
              <Input
                name="location"
                size="hub"
                maxLength={400}
                defaultValue={event?.location ?? ''}
                autoComplete="off"
              />
            </Field>

            <Field>
              <FieldLabel>{t('form.calendar')}</FieldLabel>
              <Select name="calendarId" defaultValue={event?.calendarId ?? ''}>
                <SelectTrigger size="hub" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" size="hub">
                    {t('form.nativeCalendar')}
                  </SelectItem>
                  {calendars.map((calendar) => (
                    <SelectItem key={calendar.id} value={calendar.id} size="hub">
                      {calendar.summary}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t('form.calendarHint')}</FieldDescription>
            </Field>
          </Section>

          {(error || deleteError) && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${error ?? deleteError}`)}
            </p>
          )}

          {/* The delete *trigger* sits in the footer with the other two
              actions, where the mockups' destructive action lives — opposite
              corner, same row. The delete itself is still a separate form:
              it must not carry the edit form's fields, and it lives inside the
              portalled `AlertDialogContent`, so no form is ever nested inside
              another in the DOM.

              M18: the button opens a confirmation rather than deleting. A
              single mis-tap used to remove a custody arrangement or a whole
              recurring series from the household's calendar with no way back —
              the one destructive action in this product that a parent is most
              likely to reach for while holding a phone in one hand. */}
          <DialogFooter className="sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                size="hub"
                disabled={deletePending}
                onClick={() => setConfirmingDelete(true)}
                data-testid="event-delete"
              >
                <Icon name="delete" size="sm" inline="start" />
                {t('actions.delete')}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <DialogClose
                render={
                  <Button type="button" variant="ghost" size="hub">
                    {t('actions.cancel')}
                  </Button>
                }
              />
              <Button type="submit" size="hub" disabled={pending} data-testid="event-save">
                {t('actions.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {isEdit && (
          <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
            <AlertDialogContent size="hub" data-testid="event-delete-confirm">
              <form
                action={deleteAction}
                onSubmit={deleteGuard.lock}
                className="flex flex-col gap-4"
              >
                <input type="hidden" name="eventId" value={event.seriesId} />
                {event.recurring && (
                  <>
                    <input type="hidden" name="scope" value={scope} />
                    <input
                      type="hidden"
                      name="occurrenceStart"
                      value={event.startsAt.toISOString()}
                    />
                  </>
                )}
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('actions.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('actions.deleteConfirmBody', { title: event.title })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose
                    render={
                      <Button type="button" variant="ghost" size="hub">
                        {t('actions.cancel')}
                      </Button>
                    }
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="hub"
                    disabled={deleteGuard.locked}
                    data-testid="event-delete-confirm-yes"
                  >
                    {t('actions.deleteConfirmYes')}
                  </Button>
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
