import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from '../../src/components/button';
import { CategoryDot } from '../../src/components/category-chip';
import { Icon } from '../../src/components/icon';
import type { IconName } from '../../src/components/icon-codepoints';
import { FaceStack } from '../../src/components/face-stack';
import { MemberFace } from '../../src/components/member-face';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/tabs';
import { cn } from '../../src/lib/utils';
import {
  DeviceCaption,
  HubRail,
  Overline,
  PhoneFab,
  PhoneFrame,
  PhoneStatusBar,
  PhoneTabBar,
  ScreenNote,
  DesignSheet,
  TabletFrame,
} from '../device';
import {
  AGENDA,
  DAAN,
  FAMILY,
  HOURS,
  HOUR_HEIGHT,
  LOTTE,
  MILA,
  MONTH_CELLS,
  TOM,
  TODAY,
  WEEK_DAYS,
  heightFor,
  topFor,
  type Member,
} from '../family';

/**
 * **Kalender** — day, week and month, in the two contexts.
 *
 * The rule the whole page turns on: **a seven-column time grid is unreadable
 * at 390px.** So the views do not scale down, they *change shape*.
 *
 * - **Hub day is a column per family member.** That is the core value of a
 *   family calendar and it only fits on the wide screen — five columns of who
 *   is where, read from across the kitchen.
 * - **Mobile week is an agenda list**, the way Google Calendar's Schedule view
 *   is, and **mobile month is a dot grid with the selected day spelled out
 *   underneath**, the way Apple Calendar's is. Tapping a day refreshes only
 *   the list.
 * - **There is no year view.** A year view exists to navigate; the month title
 *   with its dropdown already does that.
 *
 * Two vocabulary items the page pins. **Busy is a texture, not a colour** — a
 * blocked-out hour whose contents the household may not read gets a hatch,
 * because every hue already means "this kind of thing" and none is free to
 * mean "you may not know". And **the now line is a fact**: one 2px rule with a
 * dot, in the `--now` token, saying where the clock is and nothing about
 * whether that is good.
 *
 * The grid itself is app code (`modules/calendar/ui/time-grid.tsx`) — it needs
 * the household timezone, recurrence expansion and a drag-to-reschedule hook.
 * What is reproduced here is the geometry: 58px per hour from 06:00, and the
 * fixture week in `stories/family.ts`.
 */
const meta: Meta = {
  title: 'Pages/Kalender',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

type View = 'dag' | 'week' | 'maand';

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'dag', label: 'Dag' },
  { value: 'week', label: 'Week' },
  { value: 'maand', label: 'Maand' },
];

const HATCH = 'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.06) 0 6px, transparent 6px 12px)';

/* -------------------------------------------------------------------------- */
/* Fixtures shaped for a grid                                                  */
/* -------------------------------------------------------------------------- */

type Block = {
  id: string;
  title: string;
  from: string;
  to: string;
  surface: string;
  border: string;
  /**
   * The event-type glyph. `Kalender.dc.html`:108–115 draws one on every block,
   * day and week alike, at 14px in the category's own icon step — the half of
   * "what kind of thing is this" that the hue cannot carry on its own, since
   * eleven types share eight hues.
   */
  icon?: IconName;
  /**
   * Whose it is, trailing. 16px faces (`Avatar`'s `2xs`), because a block is as
   * tall as its event is long and a half-hour appointment has 29px to spend.
   * `everyone` swaps the stack for the group glyph — a different fact, not a
   * longer list of names.
   */
  faces?: readonly Member[];
  everyone?: boolean;
  meta?: string;
  done?: boolean;
  busy?: boolean;
  /** Two events at the same hour split the column. */
  lane?: 'left' | 'right';
};

const TEAL = { surface: 'bg-cat-teal-surface', border: 'border-l-cat-teal-solid' };
const BLUE = { surface: 'bg-cat-blue-surface', border: 'border-l-cat-blue-solid' };
const GREEN = { surface: 'bg-cat-green-surface', border: 'border-l-cat-green-solid' };
const YELLOW = { surface: 'bg-cat-yellow-surface', border: 'border-l-cat-yellow-solid' };
const PINK = { surface: 'bg-cat-pink-surface', border: 'border-l-cat-pink-solid' };
const RED = { surface: 'bg-cat-red-surface', border: 'border-l-cat-red-solid' };
const PURPLE = { surface: 'bg-cat-purple-surface', border: 'border-l-cat-purple-solid' };

const DAY_COLUMNS: readonly { key: string; member: Member | null; blocks: readonly Block[] }[] = [
  {
    key: 'iedereen',
    member: null,
    blocks: [
      {
        id: 'ontbijt',
        title: 'Ontbijt',
        icon: 'restaurant',
        everyone: true,
        from: '07:30',
        to: '08:15',
        meta: '07:30',
        done: true,
        ...TEAL,
      },
      {
        id: 'etentje',
        title: 'Etentje bij oma',
        icon: 'celebration',
        everyone: true,
        from: '18:00',
        to: '19:30',
        meta: '18:00 – 19:30',
        ...PINK,
      },
    ],
  },
  {
    key: 'tom',
    member: TOM,
    blocks: [
      {
        id: 'bezet',
        title: 'Bezet',
        icon: 'lock',
        from: '11:00',
        to: '12:30',
        meta: '11:00 – 12:30',
        busy: true,
        surface: 'bg-surface-container',
        border: 'border-l-line',
      },
      {
        id: 'werklunch',
        title: 'Werklunch',
        icon: 'work',
        faces: [TOM],
        from: '12:30',
        to: '13:30',
        meta: '12:30 – 13:30',
        ...YELLOW,
      },
    ],
  },
  {
    key: 'lotte',
    member: LOTTE,
    blocks: [
      {
        id: 'tandarts',
        title: 'Tandarts',
        from: '10:00',
        to: '10:45',
        meta: '10:00',
        icon: 'medical_services',
        faces: [LOTTE],
        ...RED,
      },
    ],
  },
  {
    key: 'mila',
    member: MILA,
    blocks: [
      {
        id: 'ochtend',
        title: 'Ochtendroutine',
        icon: 'wb_twilight',
        faces: [MILA],
        from: '08:15',
        to: '09:15',
        meta: '08:15 – 09:15',
        ...TEAL,
      },
      {
        id: 'schoolreis',
        title: 'Schoolreis',
        icon: 'school',
        faces: [MILA, DAAN],
        from: '09:15',
        to: '11:30',
        meta: '09:15 – 11:30',
        ...BLUE,
      },
      {
        id: 'voetbal',
        title: 'Voetbaltraining',
        icon: 'sports_soccer',
        faces: [MILA],
        from: '15:30',
        to: '16:30',
        meta: '15:30 – 16:30',
        ...GREEN,
      },
      {
        id: 'bedtime',
        title: 'Bedtime',
        from: '19:30',
        to: '20:15',
        meta: '19:30',
        icon: 'bedtime',
        faces: [MILA],
        ...TEAL,
      },
    ],
  },
  {
    key: 'daan',
    member: DAAN,
    blocks: [
      {
        id: 'ochtend-d',
        title: 'Ochtendroutine',
        icon: 'wb_twilight',
        faces: [DAAN],
        from: '08:15',
        to: '09:15',
        meta: '08:15 – 09:15',
        ...TEAL,
      },
      {
        id: 'schoolreis-d',
        title: 'Schoolreis',
        icon: 'school',
        faces: [MILA, DAAN],
        from: '09:15',
        to: '11:30',
        meta: '09:15 – 11:30',
        ...BLUE,
      },
      {
        id: 'bedtime-d',
        title: 'Bedtime',
        from: '19:30',
        to: '20:15',
        meta: '19:30',
        icon: 'bedtime',
        faces: [DAAN],
        ...TEAL,
      },
    ],
  },
];

const WEEK_COLUMNS: readonly (readonly Block[])[] = [
  [
    {
      id: 'ma-school',
      title: 'School',
      from: '09:00',
      to: '10:00',
      icon: 'school',
      faces: [MILA, DAAN],
      ...BLUE,
    },
    {
      id: 'ma-zwemles',
      title: 'Zwemles',
      from: '15:30',
      to: '16:30',
      icon: 'sports_soccer',
      faces: [DAAN],
      ...GREEN,
    },
  ],
  [
    {
      id: 'di-school',
      title: 'School',
      from: '09:00',
      to: '10:00',
      icon: 'school',
      faces: [MILA, DAAN],
      ...BLUE,
    },
    {
      id: 'di-thuis',
      title: 'Lotte thuis',
      from: '13:30',
      to: '15:00',
      icon: 'work',
      faces: [LOTTE],
      ...PURPLE,
    },
  ],
  [
    {
      id: 'wo-school',
      title: 'School',
      from: '09:00',
      to: '10:00',
      icon: 'school',
      faces: [MILA, DAAN],
      ...BLUE,
    },
    {
      id: 'wo-huisarts',
      title: 'Huisarts',
      from: '14:30',
      to: '15:30',
      icon: 'medical_services',
      faces: [MILA],
      ...RED,
    },
  ],
  [
    {
      id: 'do-school',
      title: 'School',
      from: '09:00',
      to: '10:00',
      icon: 'school',
      faces: [MILA, DAAN],
      ...BLUE,
    },
    {
      id: 'do-ouderavond',
      title: 'Ouderavond',
      from: '18:00',
      to: '19:00',
      icon: 'celebration',
      faces: [TOM, LOTTE],
      ...PINK,
    },
  ],
  [
    {
      id: 'vr-ochtend',
      title: 'Ochtendroutine',
      from: '08:15',
      to: '09:15',
      icon: 'wb_twilight',
      everyone: true,
      ...TEAL,
    },
    {
      id: 'vr-schoolreis',
      title: 'Schoolreis',
      icon: 'school',
      faces: [MILA, DAAN],
      from: '09:15',
      to: '11:30',
      meta: '09:15',
      ...BLUE,
    },
    {
      id: 'vr-werklunch',
      title: 'Werklunch',
      from: '12:30',
      to: '13:30',
      icon: 'work',
      faces: [TOM],
      ...YELLOW,
    },
    {
      id: 'vr-voetbal',
      title: 'Voetbal',
      from: '15:30',
      to: '16:30',
      icon: 'sports_soccer',
      faces: [MILA],
      ...GREEN,
    },
    {
      id: 'vr-etentje',
      title: 'Etentje',
      from: '18:00',
      to: '19:30',
      icon: 'celebration',
      everyone: true,
      ...PINK,
    },
  ],
  [
    {
      id: 'za-wedstrijd',
      title: 'Voetbalwedstrijd',
      from: '10:00',
      to: '11:30',
      icon: 'sports_soccer',
      faces: [DAAN],
      ...GREEN,
    },
  ],
  [
    {
      id: 'zo-familiedag',
      title: 'Familiedag',
      from: '12:00',
      to: '14:00',
      icon: 'celebration',
      everyone: true,
      ...PINK,
    },
  ],
];

const MOBILE_DAY: readonly Block[] = [
  {
    id: 'ontbijt',
    icon: 'restaurant',
    title: 'Ontbijt',
    from: '07:30',
    to: '08:15',
    done: true,
    ...TEAL,
  },
  {
    id: 'ochtend',
    icon: 'wb_twilight',
    title: 'Ochtendroutine',
    from: '08:15',
    to: '09:15',
    meta: '08:15 · Mila & Daan',
    ...TEAL,
  },
  {
    id: 'schoolreis',
    icon: 'school',
    title: 'Schoolreis',
    from: '09:15',
    to: '11:30',
    meta: '09:15 – 11:30 · Mila & Daan',
    lane: 'left',
    ...BLUE,
  },
  {
    id: 'tandarts',
    icon: 'medical_services',
    title: 'Tandarts',
    from: '10:00',
    to: '10:45',
    meta: '10:00 · Lotte',
    lane: 'right',
    ...RED,
  },
  {
    id: 'werklunch',
    icon: 'work',
    title: 'Werklunch',
    from: '12:30',
    to: '13:30',
    meta: '12:30 · Tom',
    ...YELLOW,
  },
  {
    id: 'voetbal',
    icon: 'sports_soccer',
    title: 'Voetbaltraining',
    from: '15:30',
    to: '16:30',
    meta: '15:30 · Mila',
    ...GREEN,
  },
  {
    id: 'etentje',
    icon: 'celebration',
    title: 'Etentje bij oma',
    from: '18:00',
    to: '19:30',
    meta: '18:00 – 19:30 · Iedereen',
    ...PINK,
  },
];

/** 08:42 — the moment every screen in the design system is frozen at. */
const NOW_TOP = topFor('08:42');

/* -------------------------------------------------------------------------- */
/* Grid pieces                                                                 */
/* -------------------------------------------------------------------------- */

function HourGutter({ width }: { width: number }) {
  return (
    <div className="shrink-0" style={{ width }}>
      {HOURS.map((hour) => (
        <div key={hour} className="pr-2.5 text-right" style={{ height: HOUR_HEIGHT }}>
          <span className="tabular-time relative -top-1.5 text-caption text-ink-muted">{hour}</span>
        </div>
      ))}
    </div>
  );
}

function HourLines() {
  return (
    <>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-t border-line-subtle"
          style={{ height: HOUR_HEIGHT }}
          aria-hidden
        />
      ))}
    </>
  );
}

function EventBlock({ block, dense }: { block: Block; dense?: boolean }) {
  return (
    <div
      className={cn(
        'absolute overflow-hidden rounded-lg border-l-3 px-2 py-1.5',
        block.surface,
        block.border,
        block.done && 'opacity-55',
        block.lane === 'left' && 'right-1/2 left-0 mr-1',
        block.lane === 'right' && 'right-0 left-1/2',
        !block.lane && 'inset-x-1'
      )}
      style={{
        top: topFor(block.from),
        height: heightFor(block.from, block.to),
        backgroundImage: block.busy ? HATCH : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-1">
        {block.icon ? (
          <Icon
            name={block.busy ? 'lock' : block.icon}
            size="xs"
            className={cn('shrink-0', block.busy && 'text-ink-secondary')}
          />
        ) : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-semibold',
            dense ? 'text-caption' : 'text-body-sm',
            block.done && 'line-through',
            block.busy && 'text-ink-secondary'
          )}
        >
          {block.title}
        </span>
        {/* Never on a hatched block: identity is exactly as much of a detail as
            the title on a calendar the viewer may only read as free/busy. */}
        {!block.busy && block.everyone ? (
          <Icon name="group" size="xs" label="Iedereen" className="shrink-0 text-ink-muted" />
        ) : null}
        {!block.busy && !block.everyone && block.faces?.length ? (
          <FaceStack
            size="2xs"
            className="shrink-0"
            faces={block.faces.map((face) => ({
              id: face.id,
              name: face.name,
              avatarUrl: face.avatar,
              surfaceClass: face.surface,
            }))}
          />
        ) : null}
      </div>
      {block.meta ? (
        <span className="tabular-time block truncate text-caption text-ink-secondary">
          {block.meta}
        </span>
      ) : null}
    </div>
  );
}

/** One 2px rule with a dot. `--now` is the only alarm-adjacent colour on the page. */
function NowLine({ top, className }: { top: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute flex items-center', className)}
      style={{ top }}
    >
      <span className="size-2.5 rounded-full bg-now" />
      <span className="h-0.5 flex-1 bg-now" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hub                                                                         */
/* -------------------------------------------------------------------------- */

function HubDay() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-line-subtle pr-6">
        <div className="w-16 shrink-0" />
        {DAY_COLUMNS.map((column) => (
          <div
            key={column.key}
            className="flex flex-1 items-center justify-center gap-2 border-l border-line-subtle py-3"
          >
            {column.member ? (
              <MemberFace
                name={column.member.name}
                avatarUrl={column.member.avatar}
                surfaceClass={column.member.surface}
                size="xs"
              />
            ) : (
              <Icon name="group" size="sm" className="text-ink-muted" />
            )}
            <span className="font-display text-body-sm font-bold">
              {column.member?.name ?? 'Iedereen'}
            </span>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex pr-6">
          <HourGutter width={64} />
          {DAY_COLUMNS.map((column) => (
            <div key={column.key} className="relative flex-1 border-l border-line-subtle">
              <HourLines />
              {column.blocks.map((block) => (
                <EventBlock key={block.id} block={block} dense />
              ))}
            </div>
          ))}
          <NowLine top={NOW_TOP} className="right-6 left-14" />
        </div>
      </div>
    </div>
  );
}

function HubWeek() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-line-subtle pr-6">
        <div className="w-16 shrink-0" />
        {WEEK_DAYS.map((day) => (
          <div key={day.date} className="flex-1 border-l border-line-subtle py-2.5 text-center">
            <span className="label-overline block text-ink-muted">{day.dow}</span>
            <span
              className={cn(
                'tnum mt-1 inline-flex size-8 items-center justify-center rounded-full font-display text-body font-bold',
                day.today && 'bg-primary text-primary-foreground',
                !day.today && day.weekend && 'text-ink-muted'
              )}
            >
              {day.date}
            </span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 border-b border-line-subtle bg-surface-container-low pr-6">
        <div className="flex w-16 shrink-0 items-center justify-end pr-2.5">
          <span className="text-[10px] text-ink-muted">hele dag</span>
        </div>
        {WEEK_DAYS.map((day) => (
          <div key={day.date} className="flex-1 border-l border-line-subtle p-1.5">
            {day.date === 11 ? (
              <div className="truncate rounded-md border-l-3 border-l-cat-blue-solid bg-cat-blue-surface px-2 py-0.5 text-caption font-semibold">
                Zomerkamp Daan
              </div>
            ) : null}
            {day.date === 14 ? (
              <div className="truncate rounded-md border-l-3 border-l-cat-yellow-solid bg-cat-yellow-surface px-2 py-0.5 text-caption font-semibold">
                Tom vrij
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex pr-6">
          <HourGutter width={64} />
          {WEEK_COLUMNS.map((blocks, index) => (
            <div
              key={WEEK_DAYS[index].date}
              className={cn(
                'relative flex-1 border-l border-line-subtle',
                WEEK_DAYS[index].today && 'bg-primary/4'
              )}
            >
              <HourLines />
              {blocks.map((block) => (
                <EventBlock key={block.id} block={block} dense />
              ))}
            </div>
          ))}
          <NowLine top={NOW_TOP} className="right-6 left-14" />
        </div>
      </div>
    </div>
  );
}

function HubMonth() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-5">
      <div className="grid shrink-0 grid-cols-7 border-b border-line-subtle">
        {WEEK_DAYS.map((day) => (
          <div key={day.dow} className="label-overline py-2.5 text-center text-ink-muted">
            {day.dow}
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line-subtle bg-line-subtle">
        {MONTH_CELLS.map((cell, index) => (
          <div
            key={index}
            className={cn(
              'flex flex-col gap-0.5 overflow-hidden p-1.5',
              cell.outside ? 'bg-surface-container-low' : 'bg-card'
            )}
          >
            <span
              className={cn(
                'tnum inline-flex h-5.5 min-w-5.5 items-center justify-center self-start rounded-full px-1 font-display text-caption font-bold',
                cell.today && 'bg-primary text-primary-foreground',
                cell.outside && 'text-ink-muted'
              )}
            >
              {cell.date}
            </span>
            {cell.events.slice(0, 2).map((event) => (
              <div key={event.title} className="flex min-w-0 items-center gap-1.5">
                <CategoryDot size="xs" className={event.solid} />
                <span className="truncate text-caption">{event.title}</span>
              </div>
            ))}
            {cell.events.length > 2 ? (
              <span className="pl-3 text-[10px] text-ink-muted">
                +{cell.events.length - 2} meer
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function HubCalendar({ initial = 'dag' }: { initial?: View }) {
  const [view, setView] = React.useState<View>(initial);
  const title = { dag: 'Vrijdag 14 augustus', week: '10 – 16 augustus', maand: 'Augustus 2026' }[
    view
  ];

  return (
    <TabletFrame>
      <HubRail current="kalender" />
      <Tabs
        value={view}
        onValueChange={(next) => setView(next as View)}
        className="min-w-0 flex-1 flex-col gap-0"
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-line-subtle px-6 pt-4.5 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="icon" aria-label="Vorige">
              <Icon name="chevron_left" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Volgende">
              <Icon name="chevron_right" />
            </Button>
            <h2 className="font-display text-h1 font-extrabold text-ink">{title}</h2>
          </div>
          <Button variant="outline" size="sm">
            Vandaag
          </Button>
          <span className="flex-1" />
          {/* Member filters. Three are on, Daan is off — an off filter is
              dimmed, never removed, so nobody disappears from the family. */}
          <div className="flex items-center gap-1.5">
            {FAMILY.map((member) => (
              <MemberFace
                key={member.id}
                name={member.name}
                avatarUrl={member.avatar}
                surfaceClass={member.surface}
                size="sm"
                ringed={member.id !== 'daan'}
                className={member.id === 'daan' ? 'opacity-45' : undefined}
              />
            ))}
          </div>
          <TabsList>
            {VIEWS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button size="sm">
            <Icon name="add" size="sm" />
            Nieuw
          </Button>
        </div>

        <TabsContent value="dag" className="flex min-h-0 flex-1 flex-col">
          <HubDay />
        </TabsContent>
        <TabsContent value="week" className="flex min-h-0 flex-1 flex-col">
          <HubWeek />
        </TabsContent>
        <TabsContent value="maand" className="flex min-h-0 flex-1 flex-col">
          <HubMonth />
        </TabsContent>
      </Tabs>
    </TabletFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile                                                                      */
/* -------------------------------------------------------------------------- */

function DayStrip({ dots = true }: { dots?: boolean }) {
  return (
    <div className="flex shrink-0 justify-between gap-0.5 border-b border-line-subtle px-3 pt-1.5 pb-2.5">
      {WEEK_DAYS.map((day) => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1 py-0.5">
          <span className="label-overline text-ink-muted">{day.dow}</span>
          <span
            className={cn(
              'tnum inline-flex size-8 items-center justify-center rounded-full font-display text-body-sm font-bold',
              day.today && 'bg-primary text-primary-foreground',
              !day.today && day.weekend && 'text-ink-muted'
            )}
          >
            {day.date}
          </span>
          {dots ? (
            <CategoryDot
              size="xs"
              className={cn(
                day.today ? 'bg-primary' : day.date === 15 ? 'bg-transparent' : 'bg-line'
              )}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MobileDay() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DayStrip />
      <div className="min-h-0 flex-1 overflow-y-auto pb-5">
        <div className="relative flex pr-3.5">
          <HourGutter width={52} />
          <div className="relative flex-1">
            <HourLines />
            {MOBILE_DAY.map((block) => (
              <EventBlock key={block.id} block={block} />
            ))}
          </div>
          <NowLine top={NOW_TOP} className="right-3.5 left-11" />
        </div>
      </div>
    </div>
  );
}

function MobileWeek() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DayStrip dots={false} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1">
        {AGENDA.map((day) => (
          <div key={day.date} className="flex gap-3.5 border-b border-line-subtle py-3.5">
            <div className="w-11 shrink-0 text-center">
              <span className="label-overline block text-ink-muted">{day.dow}</span>
              <span
                className={cn(
                  'tnum mt-1 inline-flex size-8.5 items-center justify-center rounded-full font-display text-h3 font-extrabold',
                  day.today && 'bg-primary text-primary-foreground'
                )}
              >
                {day.date}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {day.items.map((item) => (
                <div
                  key={item.id}
                  className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line-subtle bg-card px-3 py-2.5"
                >
                  <span className={cn('w-1 self-stretch rounded-full', item.solid)} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">{item.title}</span>
                    <span className="tabular-time block truncate text-caption text-ink-secondary">
                      {item.meta}
                    </span>
                  </div>
                  <MemberFace
                    name={item.member.name}
                    avatarUrl={item.member.avatar}
                    surfaceClass={item.member.surface}
                    size="xs"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileMonth() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3">
        <div className="grid grid-cols-7">
          {WEEK_DAYS.map((day) => (
            <div key={day.dow} className="label-overline py-1.5 text-center text-ink-muted">
              {day.dow}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {MONTH_CELLS.slice(0, 35).map((cell, index) => (
            <div key={index} className="flex h-13 flex-col items-center gap-1 pt-1">
              <span
                className={cn(
                  'tnum inline-flex size-7.5 items-center justify-center rounded-full font-display text-body-sm font-bold',
                  cell.today && 'bg-primary text-primary-foreground',
                  cell.outside && 'text-ink-muted'
                )}
              >
                {cell.date}
              </span>
              <span className="flex gap-0.5">
                {cell.events.slice(0, 3).map((event) => (
                  <CategoryDot key={event.title} size="xs" className={event.solid} />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 h-px shrink-0 bg-line-subtle" />

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-container-low px-5 pt-3.5 pb-6">
        <Overline className="mb-3">Vrijdag 14 augustus</Overline>
        <div className="flex flex-col gap-2">
          {AGENDA[0].items.map((item) => (
            <div
              key={item.id}
              className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line-subtle bg-card px-3 py-2.5"
            >
              <span className={cn('w-1 self-stretch rounded-full', item.solid)} />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold">{item.title}</span>
                <span className="tabular-time block truncate text-caption text-ink-secondary">
                  {item.meta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileCalendar({ initial = 'dag' }: { initial?: View }) {
  const [view, setView] = React.useState<View>(initial);
  const title = { dag: 'Augustus', week: 'Augustus', maand: 'Augustus' }[view];

  return (
    <PhoneFrame>
      <PhoneStatusBar />
      <Tabs
        value={view}
        onValueChange={(next) => setView(next as View)}
        className="min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 px-5 pt-1.5 pb-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-1">
              <h2 className="font-display text-h1 font-extrabold text-ink">{title}</h2>
              <Icon name="expand_more" size="md" className="text-ink-muted" />
            </div>
            <MemberFace
              name={TOM.name}
              avatarUrl={TOM.avatar}
              surfaceClass={TOM.surface}
              size="default"
            />
          </div>
          <TabsList className="mt-3 w-full">
            {VIEWS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="flex-1">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="dag" className="flex min-h-0 flex-1 flex-col">
          <MobileDay />
        </TabsContent>
        <TabsContent value="week" className="flex min-h-0 flex-1 flex-col">
          <MobileWeek />
        </TabsContent>
        <TabsContent value="maand" className="flex min-h-0 flex-1 flex-col">
          <MobileMonth />
        </TabsContent>
      </Tabs>

      <PhoneFab label="Nieuwe afspraak" />
      <PhoneTabBar current="kalender" />
    </PhoneFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

export const Wandtablet: Story = {
  name: 'Wandtablet — dag · week · maand',
  render: () => (
    <DesignSheet
      title="Kalender"
      intro={`Tablet in landscape, ${TODAY.short}. De segmented control schakelt tussen de drie weergaven; dag is een kolom per gezinslid.`}
    >
      <div>
        <DeviceCaption icon="tablet_mac">Tablet landscape 1194 × 834</DeviceCaption>
        <HubCalendar />
        <ScreenNote width={1194}>
          Een kolom per gezinslid is de kernwaarde van een gezinsagenda, en past alleen op het brede
          scherm. “Bezet” krijgt een arcering in plaats van een kleur: elke tint betekent al iets
          anders.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const WandtabletMaand: Story = {
  name: 'Wandtablet — maand',
  render: () => (
    <DesignSheet
      title="Kalender — maand"
      intro="Dezelfde tablet, geopend op maand: de cel is breed genoeg voor twee titels plus een “+n meer”."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Tablet landscape 1194 × 834</DeviceCaption>
        <HubCalendar initial="maand" />
        <ScreenNote width={1194}>
          Dagen buiten de maand blijven staan in een rustiger vlak — een raster met gaten leest
          slechter dan een raster met stille cellen.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const Mobiel: Story = {
  name: 'Mobiel — dag · week · maand',
  render: () => (
    <DesignSheet
      title="Kalender — mobiel"
      intro="Dezelfde drie weergaven op 390 px, elk in een andere vorm: dag blijft een tijdraster van één kolom, week wordt een agendalijst, maand een stippenraster met de dagagenda eronder."
    >
      <div className="flex flex-wrap items-start gap-10">
        <div>
          <DeviceCaption icon="calendar_month">Mobiel — dag</DeviceCaption>
          <MobileCalendar />
          <ScreenNote width={390}>
            Twee afspraken op hetzelfde uur delen de kolom; meer dan twee zou onleesbaar worden en
            valt terug op de agendalijst.
          </ScreenNote>
        </div>
        <div>
          <DeviceCaption icon="view_column">Mobiel — week</DeviceCaption>
          <MobileCalendar initial="week" />
          <ScreenNote width={390}>
            Week is geen 7-koloms raster maar een agendalijst per dag. Een tijdraster van zeven
            kolommen is op 390 px onleesbaar.
          </ScreenNote>
        </div>
        <div>
          <DeviceCaption icon="grid_view">Mobiel — maand</DeviceCaption>
          <MobileCalendar initial="maand" />
          <ScreenNote width={390}>
            Tikken op een dag ververst alleen de lijst eronder. Geen jaarweergave: die dient alleen
            om te navigeren, en de maandtitel met dropdown doet dat al.
          </ScreenNote>
        </div>
      </div>
    </DesignSheet>
  ),
};
