import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../src/components/badge';
import { Button } from '../../src/components/button';
import { Card } from '../../src/components/card';
import { Icon } from '../../src/components/icon';
import { IconMedallion } from '../../src/components/icon-medallion';
import { Input } from '../../src/components/input';
import { MemberFace } from '../../src/components/member-face';
import { ProgressBar } from '../../src/components/progress-bar';
import { RewardCard } from '../../src/components/reward-card';
import { SavingsGoalCard } from '../../src/components/savings-goal-card';
import { SectionHeading } from '../../src/components/section-heading';
import { StarCount } from '../../src/components/star-count';
import { cn } from '../../src/lib/utils';
import {
  DesignSheet,
  DeviceCaption,
  Overline,
  PhoneFrame,
  PhoneStatusBar,
  PhoneTabBar,
  ScreenNote,
  TabletFrame,
} from '../device';
import {
  BALANCES,
  KIDS,
  LEDGER,
  MILA,
  OUTSTANDING,
  QUEUE,
  SAVINGS_GOAL,
  STORE,
  WEEK_STARS,
  WEEK_TOTAL,
} from '../family';

/**
 * **Beloningen** — the child's store on the wall tablet, and the parent's
 * queue, catalogue and balances on the phone.
 *
 * Four things this page refuses to do, and they are the design:
 *
 * - **No balances side by side.** The avatar chips at the top are
 *   *navigation*, not comparison: you look at one child's store at a time, and
 *   there is nowhere on the screen where two children's totals can be read
 *   against each other.
 * - **Too expensive is never locked.** An out-of-reach reward stays legible
 *   and says "nog 12" instead of showing a padlock. Not yet is a plan, not a
 *   refusal.
 * - **Stars stay yours until the answer comes.** Asking is not spending; the
 *   tile says "Papa kijkt ernaar" and the balance does not move.
 * - **There is no button anywhere that takes stars away.** The parent's
 *   stepper does not go below zero and has no subtract mode. A star that has
 *   been earned is a fact about the past.
 *
 * The queue sits *before* the catalogue on the parent's screen, oldest request
 * first — the one part of the app where somebody is waiting on a human.
 */
const meta: Meta = {
  title: 'Pages/Beloningen',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

const REQUEST_COPY = {
  requestedLabel: 'Papa kijkt ernaar',
};

/** Mila's week as a bar per day — the same gold the stars themselves use. */
function WeekChart() {
  const max = Math.max(...WEEK_STARS.map((day) => day.stars));

  return (
    <div className="flex h-28 items-end justify-between gap-2">
      {WEEK_STARS.map((day) => (
        <div key={day.day} className="flex h-full flex-1 flex-col items-center gap-2">
          <ProgressBar
            orientation="vertical"
            value={day.stars}
            max={max}
            className="h-full w-full rounded-lg bg-transparent"
            fillClassName={cn('rounded-lg', day.today ? 'bg-gold' : 'bg-gold/45')}
            label={`${day.day}: ${day.stars} sterren`}
          />
          <span
            className={cn(
              'font-display text-caption font-bold',
              day.today ? 'text-ink' : 'text-ink-muted'
            )}
          >
            {day.day}
          </span>
        </div>
      ))}
    </div>
  );
}

function Winkel() {
  return (
    <TabletFrame>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-5 border-b border-line-subtle px-8 pt-5.5 pb-4.5">
          <Button variant="ghost" size="icon" aria-label="Terug">
            <Icon name="chevron_left" size="lg" />
          </Button>
          <h1 className="font-display text-display-md font-extrabold text-ink">Winkel</h1>
          {/* Navigation, not a scoreboard: one child's store at a time. */}
          <div className="ml-3 flex gap-2.5">
            {KIDS.map((kid, index) => (
              <span
                key={kid.id}
                className={cn(
                  'inline-flex items-center gap-2.5 rounded-full py-1.5 pr-4.5 pl-1.5',
                  index === 0
                    ? 'border-2 border-primary bg-accent'
                    : 'border border-line-subtle bg-card text-ink-secondary'
                )}
              >
                <MemberFace
                  name={kid.name}
                  avatarUrl={kid.avatar}
                  surfaceClass={kid.surface}
                  size="sm"
                />
                <span className="font-display text-h3 font-bold">{kid.name}</span>
              </span>
            ))}
          </div>
          <span className="flex-1" />
          <StarCount value={28} srLabel="28 sterren gespaard" size="lg" className="px-6 py-3" />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.5fr] items-start gap-6 overflow-y-auto px-8 pt-5.5 pb-8">
          <div className="flex flex-col gap-5">
            <SavingsGoalCard
              goal={{ ...SAVINGS_GOAL }}
              icon="pool"
              copy={{
                eyebrow: 'Jouw spaardoel',
                remaining: 'nog 12',
                progress: '28 van 40 sterren',
              }}
            />

            <Card className="gap-4 p-5.5">
              <SectionHeading
                title="Deze week"
                size="card"
                level={2}
                action={
                  <StarCount
                    value={WEEK_TOTAL}
                    srLabel={`${WEEK_TOTAL} sterren deze week`}
                    size="md"
                  />
                }
              />
              <WeekChart />
              <div className="flex flex-col border-t border-line-subtle">
                {LEDGER.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2.5 border-b border-line-subtle py-2.5 last:border-b-0"
                  >
                    <Icon
                      name={entry.icon}
                      filled
                      size="sm"
                      className={entry.amount ? 'text-gold' : 'text-brand'}
                    />
                    <span
                      className={cn(
                        'flex-1 text-body-sm',
                        entry.amount ? undefined : 'text-ink-secondary'
                      )}
                    >
                      {entry.title}
                    </span>
                    {entry.amount ? (
                      <span className="tnum font-display text-body-sm font-bold text-ink-secondary">
                        {entry.amount}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <h2 className="mb-3.5 font-display text-h1 font-extrabold text-ink">
              Wat je nu kunt kiezen
            </h2>
            <ul className="grid grid-cols-3 gap-3.5">
              {STORE.map((tile) => (
                <RewardCard
                  key={tile.id}
                  tile={tile}
                  tileClass={tile.tileClass}
                  copy={{
                    cost: `${tile.costStars} sterren`,
                    shortHint: `nog ${tile.costStars - 28}`,
                    requestedLabel: REQUEST_COPY.requestedLabel,
                    actionLabel: `Vraag ${tile.title} aan`,
                  }}
                  onRequest={tile.state === 'affordable' ? () => {} : undefined}
                />
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-surface-container px-4.5 py-3.5">
              <Icon name="info" size="sm" className="text-ink-muted" />
              <span className="text-body-sm text-ink-secondary">
                Wat je kiest gaat eerst naar papa of mama. Je sterren blijven van jou tot het is
                goedgekeurd.
              </span>
            </div>
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

      <div className="shrink-0 px-5 pt-2 pb-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h1 font-extrabold text-ink">Sterren</h2>
          <Button size="sm">
            <Icon name="star" size="sm" />
            Sterren geven
          </Button>
        </div>
        <div className="mt-3.5 flex gap-4.5 border-b border-line-subtle">
          <span className="inline-flex items-center gap-1.5 border-b-3 border-primary pb-2.5 font-display text-body font-bold">
            Wachtrij
            <Badge variant="default" className="tnum px-1.5">
              3
            </Badge>
          </span>
          <span className="pb-2.5 font-display text-body font-bold text-ink-muted">Catalogus</span>
          <span className="pb-2.5 font-display text-body font-bold text-ink-muted">Saldo</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-6">
        <Overline className="mb-2.5">Wacht op jou — oudste eerst</Overline>
        <div className="mb-6 flex flex-col gap-2.5">
          {QUEUE.map((request) => (
            <Card key={request.id} className="gap-3 p-3.5">
              <div className="flex items-center gap-2.5">
                <MemberFace
                  name={request.member.name}
                  avatarUrl={request.member.avatar}
                  surfaceClass={request.member.surface}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold">{request.title}</span>
                  <span className="block text-caption text-ink-secondary">
                    {request.member.name} · {request.waited}
                  </span>
                </div>
                <StarCount
                  value={request.costStars}
                  srLabel={`${request.costStars} sterren`}
                  size="sm"
                />
              </div>
              <div className="flex gap-2">
                <Button className="min-h-11 flex-1 rounded-full">Goedkeuren</Button>
                <Button variant="brand-outline" className="min-h-11 flex-1 rounded-full">
                  Afwijzen
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Overline className="mb-2.5">Uitstaand</Overline>
        <div className="mb-6 flex flex-col gap-2.5">
          {OUTSTANDING.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-2xl border border-line-subtle bg-card px-3.5 py-3"
            >
              <MemberFace
                name={item.member.name}
                avatarUrl={item.member.avatar}
                surfaceClass={item.member.surface}
                size="xs"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold">{item.title}</span>
                <span className="block truncate text-caption text-ink-secondary">{item.meta}</span>
              </div>
              {item.scheduled ? (
                <Icon name="event_available" size="sm" className="text-brand" />
              ) : (
                <Button variant="secondary" size="sm" className="min-h-11 rounded-full">
                  Afgerond
                </Button>
              )}
            </div>
          ))}
        </div>

        <Overline className="mb-2.5">Saldo</Overline>
        <div className="flex gap-2.5">
          {BALANCES.map((row) => (
            <Card key={row.member.id} className="flex-1 gap-2 p-3.5">
              <div className="flex items-center gap-2">
                <MemberFace
                  name={row.member.name}
                  avatarUrl={row.member.avatar}
                  surfaceClass={row.member.surface}
                  size="xs"
                />
                <span className="font-display text-body-sm font-bold">{row.member.name}</span>
              </div>
              <span className="tnum font-display text-h1 font-extrabold text-gold-ink">
                {row.balance}
              </span>
              <span className="tnum text-caption text-ink-secondary">
                {row.earned} verdiend · {row.spent} uitgegeven
              </span>
            </Card>
          ))}
        </div>
      </div>

      <PhoneTabBar current="sterren" />
    </PhoneFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Sterren geven                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The bottom sheet is drawn inline rather than with the package's `Sheet`,
 * which portals to the document body — correct in the app, and useless inside
 * a 390px story bezel. The geometry is the same.
 */
function SterrenGeven() {
  return (
    <PhoneFrame>
      <PhoneStatusBar />

      <div className="min-h-0 flex-1 overflow-hidden px-5 pt-2 opacity-45">
        <h2 className="mb-3 font-display text-h1 font-extrabold text-ink">Catalogus</h2>
        <div className="flex flex-col gap-2">
          {STORE.slice(0, 3).map((tile) => (
            <div
              key={tile.id}
              className="flex items-center gap-2.5 rounded-xl border border-line-subtle bg-card px-3.5 py-3"
            >
              <IconMedallion
                icon={tile.icon}
                tint="none"
                shape="squircle"
                size="md"
                className={tile.tileClass}
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold">{tile.title}</span>
                <span className="block truncate text-caption text-ink-secondary">
                  {tile.category} · alle kinderen
                </span>
              </div>
              <StarCount value={tile.costStars} srLabel={`${tile.costStars} sterren`} size="sm" />
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden className="absolute inset-0 bg-ink/35" />

      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background px-5 pt-2.5 pb-7 shadow-lg">
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line" />
        <h3 className="font-display text-h2 font-extrabold text-ink">Sterren geven</h3>
        <p className="mb-4.5 text-caption text-ink-secondary">
          Voor iets moois buiten de routines om.
        </p>

        <Overline className="mb-2">Aan wie</Overline>
        <div className="mb-4.5 flex gap-2">
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

        <Overline className="mb-2">Hoeveel sterren</Overline>
        <div className="mb-4.5 flex items-center justify-center gap-5 rounded-2xl border border-line-subtle bg-card p-3.5">
          {/* The stepper stops at zero and has no subtract mode: there is no
              screen in Kynite that takes a star back. */}
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-full"
            aria-label="Minder"
          >
            <span aria-hidden>−</span>
          </Button>
          <span className="flex items-center gap-2 text-gold-ink">
            <Icon name="star" filled size="xl" />
            <span className="tnum font-display text-display-md font-extrabold">5</span>
          </span>
          <Button size="icon" className="size-11 rounded-full" aria-label="Meer">
            <Icon name="add" />
          </Button>
        </div>

        <Overline className="mb-2">Reden</Overline>
        <div className="mb-3 flex gap-2">
          <span className="flex-1 rounded-full border-2 border-primary bg-accent py-2.5 text-center font-display text-body-sm font-bold">
            Bonus
          </span>
          <span className="flex-1 rounded-full border border-line-subtle bg-card py-2.5 text-center font-display text-body-sm font-bold text-ink-secondary">
            Verrassing
          </span>
        </div>
        <Input
          className="mb-4.5"
          aria-label="Notitie"
          placeholder="Notitie — bv. “hielp Daan met huiswerk”"
        />

        <Button className="min-h-13 w-full rounded-full text-body">
          5 sterren geven aan {MILA.name}
        </Button>
      </div>
    </PhoneFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

export const WinkelTablet: Story = {
  name: 'Wandtablet — winkel',
  render: () => (
    <DesignSheet
      title="Beloningen & store"
      intro="De winkel zoals een kind hem op de wandtablet ziet: spaardoel en weekstaafjes links, wat er nu te kiezen valt rechts."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834 — store</DeviceCaption>
        <Winkel />
        <ScreenNote width={1194}>
          Te dure beloningen blijven leesbaar en tonen “nog X” in plaats van een slot. Bij een kind
          met horizon <i>instant</i> vervalt de spaardoelkaart en schuift de sterrenkaart naar
          boven.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const BeheerMobiel: Story = {
  name: 'Mobiel — beheer & sterren geven',
  render: () => (
    <DesignSheet
      title="Beloningen — beheer"
      intro="De ouderkant op de telefoon: goedkeuringswachtrij, catalogus en saldo, plus het handmatig geven van sterren."
    >
      <div className="flex flex-wrap items-start gap-10">
        <div>
          <DeviceCaption icon="star">Mobiel — beloningsbeheer</DeviceCaption>
          <Beheer />
          <ScreenNote width={390}>
            Wachtrij staat vóór catalogus: wie het langst wacht bovenaan. Er bestaat nergens een
            knop om sterren af te pakken.
          </ScreenNote>
        </div>
        <div>
          <DeviceCaption icon="redeem">Mobiel — sterren geven</DeviceCaption>
          <SterrenGeven />
          <ScreenNote width={390}>
            Alleen positief: de stepper gaat niet onder nul en er is geen aftrek-modus.
          </ScreenNote>
        </div>
      </div>
    </DesignSheet>
  ),
};
