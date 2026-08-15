import * as React from 'react';

import { Badge } from '../../src/components/badge';
import { Button } from '../../src/components/button';
import { Card } from '../../src/components/card';
import { FaceStack } from '../../src/components/face-stack';
import { Icon } from '../../src/components/icon';
import type { IconName } from '../../src/components/icon-codepoints';
import { IconMedallion } from '../../src/components/icon-medallion';
import { KidStatCard } from '../../src/components/kid-stat-card';
import { MemberFace } from '../../src/components/member-face';
import { PageHeader } from '../../src/components/page-header';
import { PillTabs, PillTabsPanel, type PillTabItem } from '../../src/components/pill-tabs';
import { ProgressBar } from '../../src/components/progress-bar';
import { SectionHeading } from '../../src/components/section-heading';
import { cn } from '../../src/lib/utils';
import { HubRail, TabletFrame } from '../device';
import {
  DAY,
  FAMILY,
  KIDS,
  MORNING_STEPS,
  PER_MEMBER,
  ROUTINE_PROGRESS,
  TASKS,
  TODAY,
  facesOf,
  type DayEvent,
  type Member,
} from '../family';

/**
 * The Vandaag screen, assembled once.
 *
 * Two stories render it — `Pages/Vandaag` and `Pages/Vandaag — thema's` — and
 * the second differs from the first by exactly one thing: on a special day a
 * theme banner is added above the three columns. Building it twice would let
 * the two drift, and the whole claim of the themed story is that *nothing else
 * moves*.
 */

export type TabKey = 'dag' | 'personen' | 'routines' | 'sterren';

export const TABS: readonly PillTabItem<TabKey>[] = [
  { value: 'dag', label: 'Dagoverzicht', icon: 'calendar_month' },
  { value: 'personen', label: 'Per persoon', icon: 'view_column' },
  { value: 'routines', label: 'Routines', icon: 'checklist' },
  { value: 'sterren', label: 'Sterren', icon: 'bar_chart' },
];

/**
 * The "NU" block — the one card on the page sized for the far side of the
 * kitchen, and the only place that says what is happening right now. A theme
 * banner never takes its job; it sits above it.
 */
export function NowBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-surface-container',
        compact ? 'p-4' : 'px-5 py-4.5'
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-30 rounded-full bg-primary/8 blur-xl"
      />
      <div className="relative flex items-center gap-3.5">
        {/* `IconMedallion` has no category tints — category is the calendar's
            vocabulary, not the medallion's — so the hue arrives as a class. */}
        <IconMedallion
          icon="wb_twilight"
          tint="none"
          shape="squircle"
          size={compact ? 'lg' : 'xl'}
          className="bg-cat-teal-surface text-cat-teal-fg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="status" size="md" className="h-6 px-2.5">
              NU
            </Badge>
            <span
              className={cn(
                'font-display font-extrabold text-ink',
                compact ? 'text-h3' : 'text-h2'
              )}
            >
              Ochtendroutine
            </span>
          </div>
          <span className="block text-body-sm text-ink-secondary">
            Mila &amp; Daan · nog 18 min
          </span>
        </div>
      </div>
      <ProgressBar
        value={60}
        size={compact ? 'sm' : 'md'}
        tone="brand"
        label="Ochtendroutine — 60% van de stappen klaar"
        className="mt-3.5"
      />
    </div>
  );
}

/**
 * One line of the day list, in the anatomy the August sheet settled on.
 *
 * Left to right: the category rail, the time *range* stacked start over end,
 * the category glyph, the title, and the faces of whoever is on it. Two of
 * those replaced older answers and both replacements are the point:
 *
 * - **Faces instead of a "Mila & Daan" subtitle.** The row lost its second
 *   line, so nine rows fit where six did, and who-it-is-for reads at a glance
 *   instead of being parsed.
 * - **A glyph beside the rail.** Colour alone cannot separate the pairs that
 *   share a hue (school/opvang, muziek/spelen), and the rail is 4px of it.
 *
 * Rows are divided by a hairline rather than spaced apart: the list reads as
 * one object, which is what lets the live row lift out of it with a tint.
 */
export function TimelineRow({ event, size = 'hub' }: { event: DayEvent; size?: 'hub' | 'phone' }) {
  const phone = size === 'phone';
  const faces = facesOf(event.id);

  return (
    <div
      className={cn(
        'flex items-center border-t border-line-subtle first:border-t-0',
        phone ? 'min-h-12 gap-2.5 px-2 py-3' : 'gap-3 p-3',
        event.now && 'rounded-xl bg-primary/7',
        event.done && 'opacity-50'
      )}
    >
      <span className={cn('w-1 shrink-0 self-stretch rounded-full', event.solid)} />
      <div className={cn('flex shrink-0 flex-col', phone ? 'w-10.5' : 'w-13')}>
        <span
          className={cn(
            'tabular-time font-semibold',
            phone ? 'text-caption' : 'text-body-sm',
            event.now && 'font-bold text-brand'
          )}
        >
          {event.time}
        </span>
        <span
          className={cn(
            'tabular-time text-caption',
            event.now ? 'text-brand/70' : 'text-ink-muted'
          )}
        >
          {event.end}
        </span>
      </div>
      <Icon
        name={event.icon}
        size={phone ? 'sm' : 'md'}
        className={cn('shrink-0', event.iconText)}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          phone ? 'text-body-sm' : 'text-body',
          event.now ? 'font-bold' : 'font-semibold',
          event.done && 'line-through',
          event.busy && 'text-ink-muted'
        )}
      >
        {event.title}
      </span>
      {faces.length > 0 ? (
        <FaceStack faces={faces} size={phone ? 'xs' : 'sm'} label={event.who} />
      ) : null}
      {event.now ? (
        <Badge variant="status" size="default" className="shrink-0 px-2">
          NU
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * The day list's own member filter — the sheet's replacement for the "Per
 * persoon" column that used to sit beside it.
 *
 * The column answered "what does Tom's day look like" by repeating the whole
 * day four times, once per member, in a third of the width. The filter answers
 * it in place: tap a face and the list beside it narrows. "Iedereen" is the
 * resting state and is drawn as the selected pill, so the unfiltered day never
 * looks like a filtered one somebody forgot to clear.
 */
function DayFilter() {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="status" size="lg" className="h-8.5 px-3.5">
        Iedereen
      </Badge>
      {FAMILY.map((member) => (
        <MemberFace
          key={member.id}
          name={member.name}
          avatarUrl={member.avatar}
          surfaceClass={member.surface}
          size="default"
          className="opacity-45"
        />
      ))}
    </div>
  );
}

/**
 * The four things a parent walking past the tablet actually does, as buttons
 * rather than as a route they have to find.
 *
 * One filled and three outlined: starting a timer is the one that happens mid
 * task, with wet hands, from two steps away. The other three are deliberate
 * acts and can afford to be quieter. All four are 56px tall — this is a wall
 * device, and a thumb aiming from an arm's length away needs the target.
 *
 * All four are drawn here because this is the *design*. The running wall shows
 * two of them: "Nieuw event" and "Taak erbij" are writes a device principal is
 * denied (§7 — the same rule that gives the hub no event FAB and no task
 * quick-add), so the app gates each tile on the permission its action needs.
 * The parent app, where an adult is the principal, gets all four.
 */
function QuickActions() {
  const actions: {
    icon: IconName;
    label: string;
    primary?: boolean;
    starred?: boolean;
  }[] = [
    { icon: 'timer', label: 'Timer starten', primary: true },
    { icon: 'add_task', label: 'Taak erbij' },
    { icon: 'event', label: 'Nieuw event' },
    { icon: 'star', label: 'Ster geven', starred: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.primary ? 'default' : 'outline'}
          className="min-h-14 justify-start gap-2.5 rounded-2xl px-4 text-body font-bold"
        >
          <Icon
            name={action.icon}
            size="md"
            filled={action.starred}
            className={action.primary ? undefined : action.starred ? 'text-gold' : 'text-brand'}
          />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

/** A member's slice of the day: the hub's second column, and its own tab. */
function MemberDay({ member, size = 'sm' }: { member: Member; size?: 'sm' | 'lg' }) {
  const events = PER_MEMBER[member.id].map(
    (id) => DAY.find((event) => event.id === id) as DayEvent
  );

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <MemberFace
          name={member.name}
          avatarUrl={member.avatar}
          surfaceClass={member.surface}
          size={size === 'lg' ? 'default' : 'xs'}
        />
        <span
          className={cn('font-display font-bold text-ink', size === 'lg' ? 'text-h3' : 'text-body')}
        >
          {member.name}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <span
            key={event.id}
            className={cn(
              'flex items-baseline gap-2 text-body-sm',
              event.done && 'text-ink-muted line-through opacity-60',
              event.now && '-ml-1.5 rounded-lg bg-primary/8 px-1.5 py-0.5 font-bold',
              event.busy && 'text-ink-muted'
            )}
          >
            {event.busy ? (
              <Icon name="lock" size="xs" className="shrink-0" />
            ) : (
              <span className={cn('size-1.5 shrink-0 rounded-full', event.solid)} />
            )}
            {event.time} {event.title}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The task list — a checkbox-shaped glyph, the title, and whose it is. */
export function TaskList() {
  return (
    <div className="flex flex-col">
      {TASKS.map((task) => (
        <div
          key={task.id}
          className="flex min-h-12 items-center gap-2.5 border-b border-line-subtle py-2.5 last:border-b-0"
        >
          <Icon
            name={task.done ? 'check_circle' : 'radio_button_unchecked'}
            filled={task.done}
            size="sm"
            className={task.done ? 'text-success' : 'text-line'}
          />
          <span className={cn('flex-1 text-body-sm', task.done && 'text-ink-muted line-through')}>
            {task.title}
          </span>
          <MemberFace
            name={task.owner.name}
            avatarUrl={task.owner.avatar}
            surfaceClass={task.owner.surface}
            size="xs"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The Sterren tab's matrix: one row per step, one column per child.
 *
 * Deliberately not a leaderboard — the columns are *labels*, no total is set
 * larger than the rest, and the footer names both children in one sentence at
 * one weight.
 */
function StarMatrix() {
  const earned: Record<string, readonly boolean[]> = {
    'Uit bed': [true, true],
    Aankleden: [true, true],
    'Bed opmaken': [true, false],
    'Tanden poetsen': [false, false],
    'Tas inpakken': [false, false],
  };

  return (
    <Card className="max-w-3xl gap-4 p-6">
      <SectionHeading title="Sterren vandaag" size="card" level={2} />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th />
            {KIDS.map((kid) => (
              <th key={kid.id} className="w-30 pb-3">
                <span className="flex flex-col items-center gap-1.5">
                  <MemberFace
                    name={kid.name}
                    avatarUrl={kid.avatar}
                    surfaceClass={kid.surface}
                    size="sm"
                  />
                  <span className="label-overline text-ink-muted">{kid.name}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MORNING_STEPS.map((step) => (
            <tr key={step.id} className="border-t border-line-subtle">
              <td className="py-3.5 text-body-sm">{step.title}</td>
              {KIDS.map((kid, index) => (
                <td key={kid.id} className="py-3.5 text-center">
                  {earned[step.title]?.[index] ? (
                    <Icon name="star" filled size="md" className="text-gold" />
                  ) : (
                    <Icon name="radio_button_unchecked" size="md" className="text-line" />
                  )}
                  <span className="sr-only">
                    {earned[step.title]?.[index]
                      ? `${kid.name} heeft ${step.title} gedaan`
                      : `${kid.name} moet ${step.title} nog doen`}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
          <Icon name="info" size="sm" />
          Tik op een vakje om af te vinken
        </span>
        <span className="text-body-sm text-ink-secondary">
          Mila <b className="text-ink">3/5</b> · Daan <b className="text-ink">2/5</b>
        </span>
      </div>
    </Card>
  );
}

/** Today's routine progress per child, at the size the context asks for. */
export function KidProgress({ size }: { size: 'compact' | 'default' }) {
  return (
    <>
      {ROUTINE_PROGRESS.map((row) => (
        <KidStatCard
          key={row.member.id}
          size={size}
          name={row.member.name}
          avatarUrl={row.member.avatar}
          avatarSurfaceClass={row.member.surface}
          barClass={row.member.bar}
          starsToday={row.stars}
          percent={row.percent}
          stepsLabel={`${row.doneSteps} van ${row.totalSteps} stappen`}
          starsLabel={`${row.stars} sterren vandaag`}
          progressLabel={`Voortgang van ${row.member.name}`}
        />
      ))}
    </>
  );
}

/**
 * The hub screen.
 *
 * `banner` is the theme slot: a full-width row above the three columns, on the
 * days that have a theme. It *adds*, and rearranges nothing — the NU block, the
 * day column, the per-person grid and the tasks stay exactly where they were.
 */
export function VandaagHub({
  initialTab = 'dag',
  banner,
}: {
  initialTab?: TabKey;
  banner?: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<TabKey>(initialTab);

  return (
    <TabletFrame>
      <HubRail current="vandaag" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line-subtle px-7 pt-5 pb-4">
          <PageHeader
            surface="hub"
            title={TODAY.greeting}
            subtitle={TODAY.long}
            /* Just the clock. The family's faces used to sit here too, and
               they now sit where they do something: on the day list's filter,
               and on the rows themselves. A second copy in the header was
               decoration competing with the one element that has to read from
               two metres. */
            action={
              <span className="tabular-time font-display text-display-md font-extrabold text-ink">
                {TODAY.clock}
              </span>
            }
          />
        </div>

        <PillTabs
          items={TABS}
          value={tab}
          onValueChange={setTab}
          label="Weergave"
          className="min-h-0 flex-1 flex-col px-7 pt-3.5 pb-7"
          listClassName="shrink-0"
        >
          <PillTabsPanel value="dag" className="min-h-0 flex-1 overflow-y-auto">
            {banner ? <div className="mb-5">{banner}</div> : null}
            {/* Two columns, not three. The day list took the width the "Per
                persoon" column used to hold, and per-person moved into that
                list as a filter — the same answer in a third of the space,
                with the rows big enough to carry faces and a glyph. */}
            <div className="grid grid-cols-[1.55fr_1fr] items-start gap-5">
              <div className="flex flex-col gap-4">
                <NowBlock />
                <Card className="gap-3.5 px-2 pt-5 pb-2">
                  <div className="flex items-center gap-3 px-3">
                    <SectionHeading title="Dagoverzicht" size="card" level={2} className="flex-1" />
                    <DayFilter />
                  </div>
                  <div className="flex flex-col">
                    {DAY.map((event) => (
                      <TimelineRow key={event.id} event={event} />
                    ))}
                  </div>
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                <QuickActions />
                <Card className="gap-4 p-5">
                  <SectionHeading title="Routines vandaag" size="card" level={2} />
                  <div className="flex flex-col gap-4">
                    <KidProgress size="compact" />
                  </div>
                </Card>
                <Card className="gap-3 p-5">
                  <SectionHeading title="Takenlijst" size="card" level={2} />
                  <TaskList />
                </Card>
              </div>
            </div>
          </PillTabsPanel>

          <PillTabsPanel value="personen" className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-5">
              {FAMILY.map((member) => (
                <Card key={member.id} className="p-5">
                  <MemberDay member={member} size="lg" />
                </Card>
              ))}
            </div>
          </PillTabsPanel>

          <PillTabsPanel value="routines" className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-5">
              {ROUTINE_PROGRESS.map((row) => (
                <Card key={row.member.id} className="p-6">
                  <KidStatCard
                    name={row.member.name}
                    avatarUrl={row.member.avatar}
                    avatarSurfaceClass={row.member.surface}
                    barClass={row.member.bar}
                    starsToday={row.stars}
                    percent={row.percent}
                    stepsLabel={`${row.doneSteps} van ${row.totalSteps} stappen`}
                    starsLabel={`${row.stars} sterren vandaag`}
                    progressLabel={`Voortgang van ${row.member.name}`}
                  />
                </Card>
              ))}
            </div>
          </PillTabsPanel>

          <PillTabsPanel value="sterren" className="min-h-0 flex-1 overflow-y-auto">
            <StarMatrix />
          </PillTabsPanel>
        </PillTabs>
      </div>
    </TabletFrame>
  );
}
