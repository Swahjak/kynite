import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../src/components/badge';
import { Button } from '../../src/components/button';
import { Card } from '../../src/components/card';
import { Icon } from '../../src/components/icon';
import type { IconName } from '../../src/components/icon-codepoints';
import { IconMedallion } from '../../src/components/icon-medallion';
import { Input } from '../../src/components/input';
import { MemberFace } from '../../src/components/member-face';
import { ProgressBar } from '../../src/components/progress-bar';
import { RoutineCard, type RoutineCardProps } from '../../src/components/routine-card';
import { StarCount } from '../../src/components/star-count';
import { Switch } from '../../src/components/switch';
import { cn } from '../../src/lib/utils';
import {
  DeviceCaption,
  GripHandle,
  Overline,
  PhoneFrame,
  PhoneStatusBar,
  PhoneTabBar,
  ScreenNote,
  DesignSheet,
  TabletFrame,
} from '../device';
import { KIDS, MANAGED, MILA, MORNING_STEPS, TODAY } from '../family';

/**
 * **Routines** — the child's board on the wall tablet, and the parent's
 * management screens on the phone.
 *
 * The board is the screen a six-year-old uses without help, so it makes four
 * commitments:
 *
 * - **Exactly one routine is expanded** — the first one that is actionable
 *   *now*. Everything else is a calm one-line row. A board where five things
 *   are open is a board where nothing is next.
 * - **A finished repeating routine stays**, as a quiet success line rather
 *   than disappearing. A finished one-off chore *does* disappear after its
 *   celebration, but keeps counting in the band's tally, because a chore that
 *   is over should not still be asking.
 * - **A missed routine has no state of its own.** "Not yet" and "you didn't"
 *   get the same single opacity — no red, no icon, no badge. Being late is not
 *   a failure a wall display should announce to the household.
 * - **Graduating is a promotion, never a downgrade.** The stars stop; the
 *   routine stays on the board with a quiet badge.
 *
 * The parent's side is a phone: a reorderable list per child with a switch per
 * routine, and one continuous form for editing rather than a wizard — all
 * fields visible, so changing a routine costs what creating one costs.
 */
const meta: Meta = {
  title: 'Pages/Routines',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

const COPY: RoutineCardProps['copy'] = {
  stepCount: '3 van 5 stappen',
  inProgress: 'NU',
  doneLine: 'Klaar — goed gedaan!',
  countdown: null,
  starLabel: (amount) => `${amount} sterren verdiend`,
  actionLabel: (title) => `Markeer ${title} als klaar`,
  praise: (key) =>
    ({ great: 'Goed bezig! Nog twee stapjes.', proud: 'Knap gedaan!' })[key] ?? 'Top!',
  graduated: null,
};

/** The band header: which part of the day, and how far into it we are. */
function Band({
  icon,
  title,
  done,
  total,
  percent,
  fillClass,
  iconClass,
}: {
  icon: IconName;
  title: string;
  done: number;
  total: number;
  percent: number;
  fillClass: string;
  iconClass: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3.5">
      <Icon name={icon} filled size="lg" className={iconClass} />
      <span className="font-display text-h1 font-extrabold text-ink">{title}</span>
      <ProgressBar
        value={percent}
        size="md"
        fillClassName={fillClass}
        label={`${title}: ${done} van ${total} klaar`}
        className="flex-1"
      />
      <span className="tnum font-display text-body font-bold text-ink-secondary">
        {done} van {total} klaar
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Kindbord                                                                    */
/* -------------------------------------------------------------------------- */

function KindbordScreen() {
  return (
    <TabletFrame>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-5 border-b border-line-subtle px-8 pt-7 pb-5.5">
          <Button variant="ghost" size="icon" aria-label="Terug">
            <Icon name="chevron_left" size="lg" />
          </Button>
          <MemberFace
            name={MILA.name}
            avatarUrl={MILA.avatar}
            surfaceClass={MILA.surface}
            size="hub"
          />
          <div className="min-w-0 flex-1">
            <span className="block font-display text-display-md font-extrabold text-ink">
              Hoi {MILA.name}
            </span>
            <span className="block text-body-lg text-ink-secondary">{TODAY.short}</span>
          </div>
          <StarCount value={28} srLabel="28 sterren gespaard" size="lg" className="px-5 py-3" />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] items-start gap-7 overflow-y-auto px-8 pt-6 pb-8">
          <div>
            <Band
              icon="wb_twilight"
              title="Ochtend"
              done={3}
              total={7}
              percent={43}
              fillClass="bg-cat-yellow-solid"
              iconClass="text-cat-yellow-fg"
            />

            <div className="mb-3">
              <RoutineCard
                expanded={false}
                copy={{ ...COPY, doneLine: '+2 sterren' }}
                routine={{
                  id: 'wakker',
                  title: 'Wakker worden',
                  icon: 'wb_twilight',
                  state: 'none',
                  complete: true,
                  starsPerCompletion: 2,
                  steps: [],
                }}
              />
            </div>

            <div className="mb-3">
              <RoutineCard
                expanded
                onComplete={() => {}}
                copy={COPY}
                routine={{
                  id: 'ochtendroutine',
                  title: 'Ochtendroutine',
                  icon: 'wb_sunny',
                  state: 'due',
                  complete: false,
                  starsPerCompletion: 3,
                  steps: MORNING_STEPS.map((step) => ({ ...step })),
                }}
              />
            </div>

            <div className="mb-3">
              <RoutineCard
                expanded={false}
                copy={{ ...COPY, stepCount: 'van gisteren — mag nog tot vanavond' }}
                routine={{
                  id: 'was',
                  title: 'Was opruimen',
                  icon: 'checkroom',
                  state: 'grace',
                  complete: false,
                  starsPerCompletion: 1,
                  steps: [],
                }}
              />
            </div>

            <div className="mb-7">
              <RoutineCard
                expanded={false}
                copy={{
                  ...COPY,
                  stepCount: '2 stappen',
                  graduated: 'Afgestudeerd — dat kun jij al zelf!',
                }}
                routine={{
                  id: 'ontbijt',
                  title: 'Ontbijt',
                  icon: 'restaurant',
                  state: 'none',
                  complete: false,
                  starsPerCompletion: 0,
                  steps: [],
                }}
              />
            </div>
          </div>

          <div>
            <Band
              icon="wb_sunny"
              title="Middag"
              done={0}
              total={2}
              percent={0}
              fillClass="bg-cat-teal-solid"
              iconClass="text-cat-teal-fg"
            />

            <div className="mb-3">
              <RoutineCard
                expanded={false}
                copy={{ ...COPY, stepCount: '3 stappen · +2 sterren', countdown: 'over 4 uur' }}
                routine={{
                  id: 'huiswerk',
                  title: 'Huiswerk',
                  icon: 'backpack',
                  state: 'upcoming',
                  complete: false,
                  starsPerCompletion: 2,
                  steps: [],
                }}
              />
            </div>

            <div className="mb-7">
              <RoutineCard
                expanded={false}
                copy={{
                  ...COPY,
                  stepCount: 'eenmalig klusje · +1 ster',
                  countdown: 'over 6 uur',
                }}
                routine={{
                  id: 'voetbaltas',
                  title: 'Tas voor voetbal',
                  icon: 'sports_soccer',
                  state: 'upcoming',
                  complete: false,
                  starsPerCompletion: 1,
                  steps: [],
                }}
              />
            </div>

            <Band
              icon="dark_mode"
              title="Avond"
              done={0}
              total={4}
              percent={0}
              fillClass="bg-cat-purple-solid"
              iconClass="text-cat-purple-fg"
            />

            <RoutineCard
              expanded={false}
              copy={{ ...COPY, stepCount: '4 stappen · +3 sterren', countdown: 'om 19:30' }}
              routine={{
                id: 'bedtime',
                title: 'Bedtime routine',
                icon: 'dark_mode',
                state: 'upcoming',
                complete: false,
                starsPerCompletion: 3,
                steps: [],
              }}
            />
          </div>
        </div>
      </div>
    </TabletFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Beheer                                                                      */
/* -------------------------------------------------------------------------- */

function Beheer() {
  return (
    <PhoneFrame>
      <PhoneStatusBar />

      <div className="shrink-0 px-5 pt-2 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h1 font-extrabold text-ink">Routines</h2>
          <Button size="icon" aria-label="Routine toevoegen" className="rounded-full">
            <Icon name="add" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {MANAGED.map((group) => (
          <div key={group.member.id}>
            <div className="my-2.5 flex items-center gap-2.5">
              <MemberFace
                name={group.member.name}
                avatarUrl={group.member.avatar}
                surfaceClass={group.member.surface}
                size="xs"
              />
              <span className="font-display text-body font-bold">{group.member.name}</span>
              <span className="text-caption text-ink-muted">{group.routines.length} routines</span>
            </div>

            <div className="mb-5.5 flex flex-col gap-2">
              {group.routines.map((routine) => (
                <div
                  key={routine.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-line-subtle bg-card px-3.5 py-3',
                    !routine.active && 'opacity-70'
                  )}
                >
                  <GripHandle />
                  <IconMedallion
                    icon={routine.icon}
                    tint={routine.active ? 'brand' : 'muted'}
                    shape="squircle"
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">
                      {routine.title}
                    </span>
                    <span className="tabular-time block truncate text-caption text-ink-secondary">
                      {routine.schedule}
                    </span>
                  </div>
                  {routine.stars ? (
                    <StarCount
                      value={routine.stars}
                      srLabel={`${routine.stars} sterren per afronding`}
                      size="sm"
                    />
                  ) : null}
                  <Switch defaultChecked={routine.active} aria-label={`${routine.title} actief`} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <Card className="gap-3 p-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Icon name="workspace_premium" filled size="sm" className="text-brand" />
              <span className="font-display text-body font-bold">Klaar om af te studeren</span>
            </div>
            <p className="text-caption leading-relaxed text-ink-secondary">
              Mila doet dit al 3 weken zonder herinnering. Afstuderen stopt de sterren, de routine
              blijft staan.
            </p>
          </div>
          <div className="flex items-center gap-2.5 border-t border-line-subtle pt-2.5">
            <IconMedallion icon="restaurant" tint="gold" shape="squircle" size="sm" />
            <span className="flex-1 text-body-sm font-semibold">Ontbijt · Mila</span>
            <Button size="sm">Laten afstuderen</Button>
          </div>
          <div className="flex items-center gap-2 border-t border-line-subtle pt-2.5">
            <Icon name="school" size="sm" className="text-ink-muted" />
            <span className="text-caption text-ink-secondary">2 afgestudeerde routines</span>
            <Icon name="chevron_right" size="sm" className="ml-auto text-ink-muted" />
          </div>
        </Card>
      </div>

      <PhoneTabBar current="routines" />
    </PhoneFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Routinebouwer                                                               */
/* -------------------------------------------------------------------------- */

const ICON_CHOICES: readonly IconName[] = [
  'dark_mode',
  'backpack',
  'brush',
  'pets',
  'checkroom',
  'more_horiz',
];

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;
const SCHOOLDAYS = new Set(['ma', 'di', 'wo', 'do', 'vr']);

const BUILDER_STEPS: readonly { id: string; icon: IconName; title: string; timer?: string }[] = [
  { id: 'uit-bed', icon: 'wb_sunny', title: 'Uit bed' },
  { id: 'aankleden', icon: 'checkroom', title: 'Aankleden' },
  { id: 'tanden', icon: 'brush', title: 'Tanden poetsen', timer: '2:00' },
  { id: 'tas', icon: 'backpack', title: 'Tas inpakken' },
];

function Bouwer() {
  return (
    <PhoneFrame>
      <PhoneStatusBar />

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-subtle px-5 pt-2 pb-3">
        <Button variant="ghost" size="icon" aria-label="Sluiten">
          <Icon name="chevron_left" />
        </Button>
        <h2 className="font-display text-h3 font-extrabold text-ink">Routine bewerken</h2>
        <Button size="sm">Opslaan</Button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-8">
        <div>
          <Overline className="mb-2">Titel &amp; icoon</Overline>
          <div className="flex items-center gap-2.5">
            <IconMedallion
              icon="wb_sunny"
              tint="none"
              shape="squircle"
              size="xl"
              className="border-2 border-primary bg-cat-teal-surface text-cat-teal-fg"
            />
            <Input defaultValue="Ochtendroutine" aria-label="Titel" className="flex-1" />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ICON_CHOICES.map((icon) => (
              <IconMedallion key={icon} icon={icon} tint="muted" shape="squircle" size="md" />
            ))}
          </div>
        </div>

        <div>
          <Overline className="mb-2">Voor wie</Overline>
          <div className="flex flex-wrap gap-2">
            {KIDS.map((kid, index) => (
              <span
                key={kid.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5',
                  index === 0
                    ? 'border-2 border-primary bg-accent'
                    : 'border border-line-subtle bg-card text-ink-secondary'
                )}
              >
                <MemberFace
                  name={kid.name}
                  avatarUrl={kid.avatar}
                  surfaceClass={kid.surface}
                  size="xs"
                />
                <span className="font-display text-body-sm font-bold">{kid.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <Overline className="mb-2">Schema</Overline>
          <div className="mb-3 flex gap-1 rounded-full bg-surface-container p-1">
            <span className="flex-1 rounded-full bg-card py-2 text-center font-display text-body-sm font-bold shadow-sm">
              Herhalend
            </span>
            <span className="flex-1 py-2 text-center font-display text-body-sm font-bold text-ink-muted">
              Eenmalig klusje
            </span>
          </div>
          <div className="mb-3 flex gap-1.5">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className={cn(
                  'flex h-11 flex-1 items-center justify-center rounded-xl font-display text-body-sm font-bold',
                  SCHOOLDAYS.has(day)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-container text-ink-muted'
                )}
              >
                {day}
              </span>
            ))}
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-xl bg-surface-container px-3.5 py-2.5">
              <span className="block text-[11px] text-ink-muted">Starttijd</span>
              <span className="tnum font-display text-h3 font-bold">07:15</span>
            </div>
            <div className="flex-1 rounded-xl bg-surface-container px-3.5 py-2.5">
              <span className="block text-[11px] text-ink-muted">Gratie</span>
              <span className="font-display text-h3 font-bold">1 dag</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Overline>Stappen</Overline>
            <span className="text-caption text-ink-muted">sleep om te herordenen</span>
          </div>
          <div className="flex flex-col gap-2">
            {BUILDER_STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex min-h-12 items-center gap-2.5 rounded-xl bg-card px-3 py-2.5',
                  step.timer ? 'border-2 border-primary' : 'border border-line-subtle'
                )}
              >
                <GripHandle />
                <Icon name={step.icon} size="sm" className="text-ink-secondary" />
                <span className="flex-1 text-body-sm font-semibold">{step.title}</span>
                {step.timer ? (
                  <Badge variant="soft" size="md" className="tnum gap-1 text-brand-ink">
                    <Icon name="timer" size="xs" />
                    {step.timer}
                  </Badge>
                ) : (
                  <Icon name="more_horiz" size="sm" className="text-ink-muted" />
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              className="min-h-12 border-2 border-line-subtle border-dashed text-brand-ink"
            >
              <Icon name="add" size="sm" />
              Stap toevoegen
            </Button>
          </div>
        </div>

        <div>
          <Overline className="mb-2">Beloning</Overline>
          <div className="flex items-center gap-3 rounded-xl border border-line-subtle bg-card p-3.5">
            <Icon name="star" filled size="md" className="text-gold" />
            <span className="flex-1 text-body-sm font-semibold">Sterren per afronding</span>
            <div className="flex items-center gap-2.5">
              {/* No `remove` glyph in the 64 KB icon subset, and a minus is a
                  character before it is an icon — so the decrement is typeset,
                  not drawn. */}
              <Button variant="outline" size="icon" className="rounded-full" aria-label="Minder">
                <span aria-hidden>−</span>
              </Button>
              <span className="tnum min-w-4.5 text-center font-display text-h3 font-extrabold">
                3
              </span>
              <Button size="icon" className="rounded-full" aria-label="Meer">
                <Icon name="add" size="sm" />
              </Button>
            </div>
          </div>
        </div>

        <Button variant="destructive-soft" className="rounded-full">
          <Icon name="delete" size="sm" />
          Routine verwijderen
        </Button>
      </div>
    </PhoneFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

export const Kindbord: Story = {
  name: 'Wandtablet — kindbord',
  render: () => (
    <DesignSheet
      title="Routines — kindbord"
      intro="De wandtablet zoals een kind hem ziet: banden voor ochtend, middag en avond, en één routine uitgeklapt."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834 — kindbord</DeviceCaption>
        <KindbordScreen />
        <ScreenNote width={1194}>
          Afgeronde herhalende routines blijven als rustige succesregel staan; eenmalige klusjes
          verdwijnen na de viering maar blijven meetellen in de bandteller. Gemiste routines krijgen
          geen eigen visuele staat.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const BeheerMobiel: Story = {
  name: 'Mobiel — beheer',
  render: () => (
    <DesignSheet
      title="Routines — beheer"
      intro="De ouderkant: per kind een herordenbare lijst, een schakelaar per routine, en de afstudeerkaart onderaan."
    >
      <div className="flex flex-wrap items-start gap-10">
        <div>
          <DeviceCaption icon="checklist">Mobiel — routine-beheer</DeviceCaption>
          <Beheer />
          <ScreenNote width={390}>
            De schakelaar is bewust geen vinkje: een routine aan- of uitzetten is een instelling, en
            een vinkje betekent in dit systeem “gedaan, met een ster erbij”.
          </ScreenNote>
        </div>
        <div>
          <DeviceCaption icon="brush">Mobiel — routinebouwer</DeviceCaption>
          <Bouwer />
          <ScreenNote width={390}>
            Eén doorlopend formulier in plaats van een wizard: alle velden zijn zichtbaar, zodat
            bewerken net zo snel gaat als aanmaken.
          </ScreenNote>
        </div>
      </div>
    </DesignSheet>
  ),
};
