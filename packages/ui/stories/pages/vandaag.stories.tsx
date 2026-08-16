import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card } from '../../src/components/card';
import { Icon } from '../../src/components/icon';
import { MemberFace } from '../../src/components/member-face';
import {
  DeviceCaption,
  Overline,
  PhoneFab,
  PhoneFrame,
  PhoneStatusBar,
  PhoneTabBar,
  ScreenNote,
  DesignSheet,
} from '../device';
import { DAY, TODAY, TOM } from '../family';
import { KidProgress, NowBlock, TaskList, TimelineRow, VandaagHub } from './vandaag-hub';

/**
 * **Vandaag** — the hub's home screen, in both of its contexts.
 *
 * The same content twice at very different densities, which is the whole
 * design: a wall tablet in landscape is a *glanceable* day, a phone is the
 * *management* screen for the same day.
 *
 * Three things this page is here to pin:
 *
 * - **Only two elements have to be readable from two metres.** The clock and
 *   the "NU" block. Everything else on the hub is allowed to sit at 14–15px,
 *   because everything else is read by someone standing at the tablet.
 * - **The tabs survive onto the hub and die on the phone.** Dagoverzicht · Per
 *   persoon · Routines · Sterren is one tap away on a screen nobody scrolls;
 *   on a phone the same sections become one continuous column, because a thumb
 *   scrolls and a wall does not.
 * - **Nothing here is a scoreboard.** Stars are per child and never lined up
 *   as a ranking, a finished task is struck through rather than celebrated a
 *   second time, and "Bezet" gets a lock instead of a colour — a calendar the
 *   household may not read the contents of is a fact, not a status.
 *
 * The page itself is a Next route (`app/[locale]/(hub)/page.tsx`) that reads
 * the household, the roster and the timezone. What is reproduced here is its
 * *shape*, assembled from package components and the fixture household in
 * `stories/family.ts`. The hub composition lives in `pages/vandaag-hub.tsx`
 * because `Pages/Vandaag — thema's` renders the same screen.
 */
const meta: Meta = {
  title: 'Pages/Vandaag',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

/**
 * The phone's "Dagoverzicht" row: eyebrow left, the past-disclosure toggle
 * right, on one line ("Vandaag.dc.html":377–380).
 *
 * A specimen, not the component — the real one is app code
 * (`modules/today/ui/today-past-rows.tsx`), because the summary string is
 * built from the household's timezone and `next-intl`. What has to hold here
 * is the *anatomy*: the eyebrow never shrinks, the toggle does, and the
 * summary truncates instead of pushing the chevron off the card. The summary
 * names the last thing that happened, so it is as long as an event title —
 * which is exactly why it needs an ellipsis and not a wider column.
 */
function DagoverzichtRow({ summary }: { summary: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 pb-2.5">
      <div className="shrink-0">
        <Overline>Dagoverzicht</Overline>
      </div>
      <button
        type="button"
        className="flex min-w-0 items-center gap-1.5 rounded-lg text-ink-muted transition-colors duration-200 hover:text-ink"
      >
        <Icon name="expand_more" size="sm" className="shrink-0 transition-transform" />
        <span className="truncate text-caption">{summary}</span>
      </button>
    </div>
  );
}

export const Wandtablet: Story = {
  name: 'Wandtablet — hub',
  render: () => (
    <DesignSheet
      title="Vandaag"
      intro="Wandtablet in landscape als glanceable dagoverzicht. De vier tabs werken: dagoverzicht is de standaard, per persoon, routines en sterren zijn één tik weg."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834</DeviceCaption>
        <VandaagHub />
        <ScreenNote width={1194}>
          De klok en het NU-blok zijn de enige elementen die van twee meter afstand leesbaar hoeven
          zijn. De rest is voor wie bij de tablet staat.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const WandtabletSterren: Story = {
  name: 'Wandtablet — sterrentab',
  render: () => (
    <DesignSheet
      title="Vandaag — sterren"
      intro="Dezelfde hub, geopend op de sterrentab: één rij per stap, één kolom per kind, en nadrukkelijk geen ranglijst."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834</DeviceCaption>
        <VandaagHub initialTab="sterren" />
        <ScreenNote width={1194}>
          Geen totaal in een groter corps en geen podium: de voettekst noemt beide kinderen in
          dezelfde zin en hetzelfde gewicht.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const DagoverzichtKop: Story = {
  name: 'Mobiel — kop Dagoverzicht',
  render: () => (
    <DesignSheet
      title="Dagoverzicht — kop"
      intro="De kop van het dagoverzicht op mobiel, met een korte en een lange samenvatting. De eyebrow houdt zijn volle breedte; de samenvatting kort af met een ellips zodat de chevron nooit van de kaart geduwd wordt."
    >
      <div>
        <DeviceCaption icon="home">Kolombreedte 390 − 2 × 20 px padding</DeviceCaption>
        <div className="w-[350px] rounded-2xl bg-surface p-4">
          <DagoverzichtRow summary="1 afgerond" />
          <DagoverzichtRow summary="1 afgerond — Ontbijt (07:30)" />
          <DagoverzichtRow summary="4 afgerond — Zwemles Noor bij De Kuil (17:15)" />
        </div>
        <ScreenNote width={350}>
          De samenvatting staat op 12px Poppins in dezelfde gedempte inkt als de eyebrow, niet op
          14px: hij is een bijschrift bij de kop, geen tweede kop ernaast.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const Mobiel: Story = {
  render: () => (
    <DesignSheet
      title="Vandaag — mobiel"
      intro="Mobiel geen tabs maar één doorlopende kolom: dagoverzicht, routines, taken. Per persoon zit op mobiel in de kalender, niet in Vandaag."
    >
      <div>
        <DeviceCaption icon="home">Mobiel 390 × 844</DeviceCaption>
        <PhoneFrame>
          <PhoneStatusBar />

          <div className="shrink-0 px-5 pt-2 pb-3">
            <div className="flex items-center justify-between gap-2.5">
              <div>
                <h2 className="font-display text-h1 font-extrabold text-ink">
                  {TODAY.greeting}, {TOM.name}
                </h2>
                <span className="block text-caption text-ink-secondary">{TODAY.short}</span>
              </div>
              <MemberFace
                name={TOM.name}
                avatarUrl={TOM.avatar}
                surfaceClass={TOM.surface}
                size="default"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            <NowBlock compact />

            <div className="mt-5">
              <DagoverzichtRow summary="1 afgerond — Ontbijt (07:30)" />
            </div>

            {/* One card with hairlines, not nine floating cards. The phone
                shows the same row anatomy as the hub at a smaller size, so a
                parent who reads the wall and then their pocket reads the same
                object twice rather than learning two lists. */}
            <div className="rounded-2xl border border-line-subtle bg-card px-2">
              {DAY.filter((event) => !event.done).map((event) => (
                <TimelineRow key={event.id} event={event} size="phone" />
              ))}
            </div>

            <Overline className="mt-6 mb-1.5">Routines</Overline>
            <Card className="gap-3 p-3.5">
              <KidProgress size="compact" />
            </Card>

            <Overline className="mt-6 mb-1">Takenlijst</Overline>
            <TaskList />
          </div>

          <PhoneFab label="Nieuw item" />

          <PhoneTabBar current="vandaag" />
        </PhoneFrame>
        <ScreenNote width={390}>
          De afgeronde items zitten achter “1 afgerond”: wat al gebeurd is hoeft geen ruimte te
          houden op een scherm van 390 px.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};
