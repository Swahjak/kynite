import type { Meta, StoryObj } from '@storybook/react-vite';

import { CategoryDot } from '../../src/components/category-chip';
import { MemberFace } from '../../src/components/member-face';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * **Calendar view patterns** — the building blocks for day, week and month
 * across the two contexts.
 *
 * The rule the whole section exists to state: **a 7-column time grid is
 * unreadable at 390px.** So the views do not scale down, they *change shape*.
 * On the hub, day splits into a column per family member. On mobile, week
 * becomes an agenda list and month becomes a dot grid with the selected day
 * spelled out underneath it.
 *
 * The grid itself lives in the app (`modules/calendar/ui/time-grid.tsx`): it
 * needs the household timezone, recurrence expansion, the roster and a
 * drag-to-reschedule hook, none of which belong in a design system. What is
 * pinned here is the geometry and the vocabulary — 58px per hour, the now line,
 * the person header, and the hatch fill that means "busy, no detail".
 *
 * That hatch is the section's other real decision. A blocked-out hour a
 * caregiver may not read the contents of gets a *texture*, not a colour: every
 * category colour already means "this kind of thing", and there is no hue free
 * to mean "you may not know".
 */
const meta: Meta = {
  title: 'Pages/Calendar view patterns',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

const HOURS = ['09:00', '10:00', '11:00'];

const HATCH = 'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.06) 0 6px, transparent 6px 12px)';

function TimeGridColumn({
  member,
  avatar,
  children,
}: {
  member: string;
  avatar: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-40 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-2">
        <MemberFace name={member} avatarUrl={avatar} size="xs" />
        <span className="font-display text-body-sm font-bold">{member}</span>
      </div>
      <div className="relative" style={{ height: 58 * HOURS.length }}>
        {HOURS.map((_, index) => (
          <div
            key={index}
            className="absolute inset-x-0 border-b border-line-subtle"
            style={{ top: index * 58, height: 58 }}
          />
        ))}
        {children}
      </div>
    </div>
  );
}

export const Patterns: Story = {
  render: () => (
    <div className="flex flex-col gap-12">
      <Section title="Time grid column — person header, event block, now line">
        <Specimen
          name="Grid/column"
          note='58px per hour. "Bezet" (busy, no detail) uses a hatch fill instead of a category colour.'
        >
          <div className="flex w-full max-w-2xl rounded-2xl bg-card p-3 shadow-sm">
            <div className="w-14 shrink-0 pt-9">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="tabular-time text-caption text-ink-muted"
                  style={{ height: 58 }}
                >
                  {hour}
                </div>
              ))}
            </div>

            <TimeGridColumn member={MEMBERS[0].name} avatar={MEMBERS[0].src}>
              <div
                className="absolute inset-x-1 rounded-lg border border-cat-blue-border bg-cat-blue-surface p-2 text-cat-blue-fg"
                style={{ top: 9, height: 78 }}
              >
                <span className="block font-display text-body-sm font-bold">Schoolreis</span>
                <span className="tabular-time block text-caption">09:15 – 11:30</span>
              </div>
              {/* The now line: one 2px rule with a dot on the left edge. It says
                  where the clock is, and nothing about whether that is good. */}
              <div
                className="pointer-events-none absolute inset-x-0 flex items-center"
                style={{ top: 96 }}
              >
                <span className="size-2 rounded-full bg-brand" />
                <span className="h-0.5 flex-1 bg-brand" />
              </div>
            </TimeGridColumn>

            <TimeGridColumn member={MEMBERS[3].name} avatar={MEMBERS[3].src}>
              <div
                className="absolute inset-x-1 rounded-lg border border-line-subtle p-2 text-ink-secondary"
                style={{ top: 29, height: 58, backgroundImage: HATCH }}
              >
                <span className="font-display text-body-sm font-bold">Bezet</span>
              </div>
            </TimeGridColumn>
          </div>
        </Specimen>
      </Section>

      <Section title="Mobile day strip">
        <Specimen
          name="Mobile/day strip"
          note="Week, at 390px: seven taps, the selected day filled, dots for what is on it."
        >
          <div className="flex w-[358px] gap-1 rounded-2xl bg-card p-2 shadow-sm">
            {[
              ['ma', 10],
              ['di', 11],
              ['wo', 12],
              ['do', 13],
              ['vr', 14],
              ['za', 15],
              ['zo', 16],
            ].map(([day, date]) => (
              <div
                key={date}
                className={
                  date === 14
                    ? 'flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-primary py-2 text-primary-foreground'
                    : 'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-ink-secondary'
                }
              >
                <span className="label-overline">{day}</span>
                <span className="tnum font-display text-body font-bold">{date}</span>
                <CategoryDot size="xs" className={date === 14 ? 'bg-card' : 'bg-cat-blue-solid'} />
              </div>
            ))}
          </div>
        </Specimen>
      </Section>

      <Section title="Agenda row (mobile week &amp; month)">
        <Specimen
          name="Mobile/agenda row"
          note="The date sits in its own gutter, so a run of rows reads as one date column."
        >
          <div className="flex w-[358px] gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex w-10 shrink-0 flex-col items-center">
              <span className="label-overline text-ink-muted">vr</span>
              <span className="tnum font-display text-h3 font-bold">14</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {[
                {
                  title: 'Schoolreis',
                  meta: '09:15 – 11:30 · Mila & Daan',
                  hue: 'bg-cat-blue-solid',
                },
                { title: 'Werklunch', meta: '12:30 · Tom', hue: 'bg-cat-yellow-solid' },
              ].map((row) => (
                <div key={row.title} className="flex items-start gap-2">
                  <CategoryDot className={`mt-1.5 ${row.hue}`} />
                  <div className="min-w-0">
                    <p className="font-display text-body-sm font-bold">{row.title}</p>
                    <p className="text-caption text-ink-secondary">{row.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Specimen>
      </Section>

      <Section title="Month cells — hub (titles) vs mobile (dots)">
        <Specimen
          name="Month/cell"
          note="Same day, two contexts. The hub cell can afford two titles and a +n; the phone cell can afford dots."
        >
          <div className="flex items-start gap-6">
            <div className="flex h-28 w-32 flex-col gap-1 rounded-xl border border-line-subtle bg-card p-2">
              <span className="tnum font-display text-body-sm font-bold">14</span>
              <span className="truncate rounded bg-cat-blue-surface px-1.5 py-0.5 text-caption text-cat-blue-fg">
                Schoolreis
              </span>
              <span className="truncate rounded bg-cat-orange-surface px-1.5 py-0.5 text-caption text-cat-orange-fg">
                Tandarts
              </span>
              <span className="text-caption text-ink-muted">+2 meer</span>
            </div>

            <div className="flex size-14 flex-col items-center justify-center gap-1 rounded-xl border border-line-subtle bg-card">
              <span className="tnum font-display text-body-sm font-bold">14</span>
              <span className="flex gap-0.5">
                <CategoryDot size="xs" className="bg-cat-blue-solid" />
                <CategoryDot size="xs" className="bg-cat-orange-solid" />
                <CategoryDot size="xs" className="bg-cat-purple-solid" />
              </span>
            </div>
          </div>
        </Specimen>
      </Section>
    </div>
  ),
};
