'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useActionToast } from '@/components/ui/use-action-toast';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { idleState } from '../action-state';
import { setCalendarDisplayAction } from '../actions';
import { categoryForType } from '../domain/event-type';
import { EVENT_TYPES, type EventCategory, type EventType } from '../schema';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS } from './tokens';

/**
 * One row's worth of settings, declared by the component that renders it and
 * imported *by* `page-data.ts` — the same direction `WritableCalendar` runs in
 * `event-dialog.tsx`, and for the same reason: a client component may not
 * import from a `server-only` module, so the view type has to live on this
 * side of the boundary.
 */
export type CalendarDisplayView = {
  id: string;
  summary: string;
  /** Null for the household's own calendar, which hangs off no account. */
  accountEmail: string | null;
  /** The built-in "Gezin" calendar (M23): undeletable, never private. */
  isHousehold: boolean;
  /** The Google calendar it is bound to, if the owner has bound one. */
  boundCalendarId: string | null;
  visibility: 'family' | 'private';
  /**
   * Google's own colour for this calendar, mapped onto the palette (M23).
   *
   * Provenance, not category: it draws the dot beside the name so a parent can
   * tell two "Werk" calendars apart, and it decides nothing about how the
   * events on it render — those take their hue from their type.
   */
  color: EventCategory;
  /** The type its untyped events inherit (M23) — "Standaardtype" below. */
  defaultType: EventType;
};

/**
 * `calendar_visibility`'s two values, written out here rather than imported.
 * The enum lives in the *google* slice's schema, and a client component may
 * not reach a schema module in another slice (§2) — nor would we want drizzle
 * in this bundle. The annotation is what keeps the two in step: adding a third
 * visibility to the database without adding it here is a type error.
 */
const VISIBILITY_OPTIONS: readonly CalendarDisplayView['visibility'][] = ['family', 'private'];

/**
 * The calendars section of `(app)/settings` — FR28's "per-calendar
 * colour-coding", plus the family/private switch §7 already grades.
 *
 * One form per calendar rather than one form for all of them. A parent
 * recolouring the school calendar should not be submitting the other four
 * alongside it, and a per-row form means a failure names the row it belongs
 * to. Both fields of a row travel together because they land in one
 * transaction (`setCalendarDisplayAction`).
 *
 * The colour picker that used to sit here is gone (M23). An event's hue comes
 * from its type on every surface, so a per-calendar colour was a second answer
 * to a question that may only have one — and the one it gave was the one a
 * parent saw on the wall, which made the taxonomy invisible. Google's colour
 * survives as the dot beside the calendar's name: it answers "which calendar
 * is this", which is the only question this list is actually asking.
 */
export function CalendarDisplayList({
  calendars,
  bindable = [],
}: {
  calendars: CalendarDisplayView[];
  /** Google calendars the household calendar may be bound to. */
  bindable?: { id: string; summary: string }[];
}) {
  const t = useTranslations('settings.calendars');

  if (calendars.length === 0) {
    return <p className="text-body-sm text-ink-secondary">{t('empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-4" data-testid="calendar-display-list">
      {calendars.map((entry) => (
        <li key={entry.id}>
          <CalendarDisplayRow calendar={entry} bindable={bindable} />
        </li>
      ))}
    </ul>
  );
}

function CalendarDisplayRow({
  calendar,
  bindable,
}: {
  calendar: CalendarDisplayView;
  bindable: { id: string; summary: string }[];
}) {
  const t = useTranslations('settings.calendars');
  const tTypes = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(setCalendarDisplayAction, idleState);
  useActionToast(state, pending, { success: tCommon('saved') });

  return (
    <form
      action={formAction}
      // `Card variant="outlined"`'s shape, written out because the element has
      // to stay a `<form>` (the card primitive is a `div` and this row submits
      // its own action). The settings list is a stack of frames on an
      // already-light ground — the one case `components.md` § Cards still
      // wants an outline for — at the 24px card radius.
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
      data-testid="calendar-display-row"
      data-calendar-id={calendar.id}
    >
      <input type="hidden" name="calendarId" value={calendar.id} />

      <div className="flex items-center gap-2.5">
        {/* Provenance dot: Google's own colour for this calendar, at the solid
            tone `colors.md` gives a colour cue at this size. */}
        <span
          aria-hidden
          data-testid="calendar-color-dot"
          data-color={calendar.color}
          className={cn('size-3 shrink-0 rounded-full', CATEGORY_CLASSES[calendar.color].solid)}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-body font-semibold text-ink">{calendar.summary}</span>
          <span className="text-caption break-all text-ink-muted">
            {calendar.accountEmail ?? t('householdHint')}
          </span>
        </div>
      </div>

      {/* The rung that makes the taxonomy survive Google (M23): a synced event
          carries no type, so this is the one place a parent can say what two
          hundred of them are. Icons, because the glyph is what they will read
          on the board afterwards. */}
      <Field>
        <FieldLabel>{t('defaultType')}</FieldLabel>
        <Select name="defaultType" defaultValue={calendar.defaultType}>
          <SelectTrigger size="hub" data-testid="calendar-default-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                <span className="flex items-center gap-2">
                  <Icon
                    name={EVENT_TYPE_ICONS[type]}
                    size="sm"
                    className={cn('shrink-0', CATEGORY_CLASSES[categoryForType(type)].text)}
                  />
                  {tTypes(`types.${type}`)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('defaultTypeHint')}</FieldDescription>
      </Field>

      {/* Binding (M23): the household calendar may follow one Google calendar,
          and the events on that calendar then read as the family's. A pointer,
          not a merge — the bound calendar keeps its own row and syncs through
          the engine untouched, so unbinding takes nothing with it. */}
      {calendar.isHousehold && (
        <Field>
          <FieldLabel>{t('boundCalendar')}</FieldLabel>
          <Select name="boundCalendarId" defaultValue={calendar.boundCalendarId ?? ''}>
            <SelectTrigger size="hub" data-testid="calendar-bound">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('boundCalendarNone')}</SelectItem>
              {bindable.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.summary}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t('boundCalendarHint')}</FieldDescription>
        </Field>
      )}

      {/* The household calendar is never private: it is the one calendar the
          whole family is meant to read, and a wall display that redacted it
          would redact the thing it exists to show. */}
      {calendar.isHousehold ? (
        <input type="hidden" name="visibility" value="family" />
      ) : (
        <Field>
          <FieldLabel>{t('visibility')}</FieldLabel>
          <Select name="visibility" defaultValue={calendar.visibility}>
            <SelectTrigger size="hub" data-testid="calendar-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`visibilities.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="hub" disabled={pending} data-testid="save-calendar-display">
          {t('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-body-sm text-destructive">
            {t(`errors.${state.error}`)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
