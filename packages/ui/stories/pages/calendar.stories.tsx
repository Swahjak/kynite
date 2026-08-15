import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Calendar } from '../../src/components/calendar';
import { CategoryChip, CategoryDot } from '../../src/components/category-chip';
import { FaceStack } from '../../src/components/face-stack';
import { Icon } from '../../src/components/icon';
import { MediaRow } from '../../src/components/media-row';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * **Calendar** — the design sheet's own Calendar section, rebuilt out of the
 * package: week strip, month grid, day agenda, the overlapping fanned stack,
 * and the event list item.
 *
 * There is no single `<Calendar/>` composite to move here. The product's
 * calendar is a slice — it reads the household timezone, expands recurrence,
 * resolves owners against the roster and drives a drag-to-reschedule hook — so
 * `modules/calendar/ui/time-grid.tsx` stays in the app on purpose. What the
 * design system owns is the *language* those views speak, and that is what this
 * specimen pins: one category palette, one dot, one chip, one row shape, used
 * identically whether the surface is a strip, a grid or a list.
 *
 * The month grid itself *is* a package component — `Primitives/Calendar`, the
 * date picker — and it is the same object the month view renders.
 */
const meta: Meta = {
  title: 'Pages/Calendar',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

const WEEK = [
  { day: 'ma', date: 19 },
  { day: 'di', date: 20 },
  { day: 'wo', date: 21 },
  { day: 'do', date: 22 },
  { day: 'vr', date: 23 },
  { day: 'za', date: 24 },
  { day: 'zo', date: 25 },
];

const HUES = {
  blue: {
    surface: 'bg-cat-blue-surface text-cat-blue-fg',
    border: 'border-cat-blue-border',
    solid: 'bg-cat-blue-solid',
  },
  purple: {
    surface: 'bg-cat-purple-surface text-cat-purple-fg',
    border: 'border-cat-purple-border',
    solid: 'bg-cat-purple-solid',
  },
  orange: {
    surface: 'bg-cat-orange-surface text-cat-orange-fg',
    border: 'border-cat-orange-border',
    solid: 'bg-cat-orange-solid',
  },
};

function WeekStrip() {
  const [active, setActive] = useState(21);
  return (
    <div className="flex w-full max-w-2xl gap-2 rounded-2xl bg-card p-2 shadow-sm">
      {WEEK.map((entry) => {
        const selected = entry.date === active;
        return (
          <button
            key={entry.date}
            type="button"
            onClick={() => setActive(entry.date)}
            aria-pressed={selected}
            className={
              selected
                ? 'flex flex-1 flex-col items-center gap-1 rounded-xl bg-primary px-2 py-2.5 text-primary-foreground'
                : 'flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-ink-secondary transition-colors duration-200 hover:bg-surface-container'
            }
          >
            <span className="label-overline">{entry.day}</span>
            <span className="tnum font-display text-h3 font-bold">{entry.date}</span>
            <span className="flex gap-0.5">
              <CategoryDot size="xs" className={selected ? 'bg-card' : HUES.blue.solid} />
              <CategoryDot size="xs" className={selected ? 'bg-card' : HUES.orange.solid} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

const AGENDA = [
  { time: '16:00', title: 'Voetbaltraining', who: [0], hue: 'blue' as const, now: false },
  { time: '18:00', title: 'Avondeten', who: [0, 1, 2, 3], hue: 'orange' as const, now: true },
  { time: '19:30', title: 'Bedtijdroutine', who: [0, 1], hue: 'purple' as const, now: false },
];

export const Sheet: Story = {
  render: () => (
    <div className="flex flex-col gap-12">
      <Section title="Week strip">
        <Specimen
          name="Calendar/week strip"
          note="Dots, not titles: at strip height a category is a colour, and the day below carries the words."
        >
          <WeekStrip />
        </Specimen>
      </Section>

      <Section title="Month view / date picker">
        <Specimen
          name="Calendar/month"
          note="`Primitives/Calendar` — the same grid the month view and every date field render."
        >
          <div className="rounded-2xl bg-card p-2 shadow-sm">
            <Calendar
              formattingLocale="nl-NL"
              defaultMonth={new Date(2026, 9, 1)}
              selected={new Date(2026, 9, 21)}
              onSelect={() => {}}
            />
          </div>
        </Specimen>
      </Section>

      <Section title="Day agenda">
        <Specimen
          name="Calendar/day agenda"
          note="`NU` marks the block the clock is inside — a position, never a warning."
        >
          <div className="flex w-full max-w-2xl flex-col gap-2">
            {AGENDA.map((entry) => (
              <MediaRow
                key={entry.title}
                variant={entry.now ? 'tinted' : 'plain'}
                leading={
                  <span className="tabular-time w-14 shrink-0 text-body-sm text-ink-secondary">
                    {entry.time}
                  </span>
                }
                title={
                  <span className="flex items-center gap-2">
                    {entry.title}
                    {entry.now ? <span className="label-overline text-brand-ink">NU</span> : null}
                  </span>
                }
                meta={
                  <CategoryChip
                    dot
                    surfaceClass={HUES[entry.hue].surface}
                    borderClass={HUES[entry.hue].border}
                    dotClass={HUES[entry.hue].solid}
                  >
                    {entry.who.length === MEMBERS.length
                      ? 'Iedereen'
                      : entry.who.map((index) => MEMBERS[index].name).join(' & ')}
                  </CategoryChip>
                }
                actions={
                  <FaceStack
                    faces={entry.who.map((index) => ({
                      id: MEMBERS[index].name,
                      name: MEMBERS[index].name,
                      avatarUrl: MEMBERS[index].src,
                    }))}
                  />
                }
              />
            ))}
          </div>
        </Specimen>
      </Section>

      <Section title="Overlapping events (fanned stack)">
        <Specimen
          name="Calendar/fan"
          note="Two blocks sharing an hour split the column; a third fans behind them with a count."
        >
          <div className="relative h-28 w-full max-w-md">
            {[0, 1, 2].map((depth) => (
              <div
                key={depth}
                className={`absolute inset-x-0 rounded-xl border p-3 ${HUES.purple.surface} ${HUES.purple.border}`}
                style={{ top: depth * 10, left: depth * 12, right: depth * 4, zIndex: 3 - depth }}
              >
                {depth === 0 ? (
                  <span className="font-display text-body-sm font-semibold">
                    Etentje · 4 personen
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Specimen>
      </Section>

      <Section title="Event list item">
        <Specimen
          name="Calendar/list item"
          note="Start and end stacked in `tnum`, so a column of rows lines up on the colon."
        >
          <div className="flex w-full max-w-2xl flex-col gap-3">
            {[
              {
                from: '09:00',
                to: '10:00',
                title: 'Ouderavond',
                where: 'Lindenschool · lokaal 4',
                hue: 'blue' as const,
              },
              {
                from: '14:30',
                to: '15:00',
                title: 'Tandarts — Daan',
                where: 'Dr. Verhoeven',
                hue: 'orange' as const,
              },
            ].map((event) => (
              <MediaRow
                key={event.title}
                variant="outlined"
                leading={
                  <span className="tabular-time flex w-16 shrink-0 flex-col text-body-sm">
                    <span className="font-semibold text-ink">{event.from}</span>
                    <span className="text-ink-muted">{event.to}</span>
                  </span>
                }
                title={event.title}
                meta={
                  <span className="flex items-center gap-1.5">
                    <Icon name="location_on" size="xs" />
                    {event.where}
                  </span>
                }
                actions={<CategoryDot className={HUES[event.hue].solid} />}
              />
            ))}
          </div>
        </Specimen>
      </Section>
    </div>
  ),
};
