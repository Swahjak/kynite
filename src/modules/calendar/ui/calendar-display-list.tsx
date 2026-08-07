'use client';

import { useActionState, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FieldGroupLabel, FieldLabel } from '@/components/ui/field';
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
import { EVENT_CATEGORIES, type EventCategory } from '../schema';
import { CATEGORY_CLASSES } from './tokens';

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
  accountEmail: string;
  visibility: 'family' | 'private';
  /** Null = still inheriting Google's colour. */
  category: EventCategory | null;
  /** What that inheritance resolves to today, for the "inherit" swatch. */
  inheritedCategory: EventCategory;
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
 * The colour picker offers the eight design-system tokens plus "inherit",
 * which is the *default* and is shown with the colour it currently resolves
 * to. Inherit is not the absence of a choice — it is the choice to keep
 * following Google, and a family who has never thought about colours gets a
 * board that is already colour-coded.
 */
export function CalendarDisplayList({ calendars }: { calendars: CalendarDisplayView[] }) {
  const t = useTranslations('settings.calendars');

  if (calendars.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-4" data-testid="calendar-display-list">
      {calendars.map((entry) => (
        <li key={entry.id}>
          <CalendarDisplayRow calendar={entry} />
        </li>
      ))}
    </ul>
  );
}

function CalendarDisplayRow({ calendar }: { calendar: CalendarDisplayView }) {
  const t = useTranslations('settings.calendars');
  const [state, formAction, pending] = useActionState(setCalendarDisplayAction, idleState);
  const [category, setCategory] = useState<string>(calendar.category ?? '');
  const labelId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border p-4"
      data-testid="calendar-display-row"
      data-calendar-id={calendar.id}
    >
      <input type="hidden" name="calendarId" value={calendar.id} />
      <input type="hidden" name="category" value={category} />

      <div className="flex flex-col gap-0.5">
        <span className="font-display text-sm font-semibold">{calendar.summary}</span>
        <span className="text-xs text-muted-foreground">{calendar.accountEmail}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldGroupLabel id={labelId}>{t('color')}</FieldGroupLabel>
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-hub"
            aria-pressed={category === ''}
            aria-label={t('inherit')}
            onClick={() => setCategory('')}
            className={cn(category === '' && 'border-ring ring-3 ring-ring/50')}
            data-testid="calendar-color-inherit"
          >
            {/* The colour inheritance currently resolves to, drawn hollow so it
                reads as "whatever Google says" rather than as a ninth choice. */}
            <span
              aria-hidden
              className={cn(
                'size-6 rounded-full border-2 border-dashed',
                CATEGORY_CLASSES[calendar.inheritedCategory].border
              )}
            />
          </Button>
          {EVENT_CATEGORIES.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size="icon-hub"
              aria-pressed={category === option}
              aria-label={t(`colors.${option}`)}
              onClick={() => setCategory(option)}
              className={cn(category === option && 'border-ring ring-3 ring-ring/50')}
              data-testid={`calendar-color-${option}`}
            >
              <span
                aria-hidden
                className={cn('size-6 rounded-full', CATEGORY_CLASSES[option].solid)}
              />
            </Button>
          ))}
        </div>
      </div>

      <Field>
        <FieldLabel>{t('visibility')}</FieldLabel>
        <Select name="visibility" defaultValue={calendar.visibility}>
          <SelectTrigger size="hub" data-testid="calendar-visibility">
            {/* Base UI's `Select.Value` renders the raw *value* unless it is
                given a formatter, and the raw value here is a database enum
                (`family`/`private`). The trigger is the one place a parent
                reads this setting without opening the list, so it has to say
                what the option says. */}
            <SelectValue>
              {(value: string) => t(`visibilities.${value === 'private' ? 'private' : 'family'}`)}
            </SelectValue>
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

      <div className="flex items-center gap-3">
        <Button type="submit" size="hub" disabled={pending} data-testid="save-calendar-display">
          {t('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
