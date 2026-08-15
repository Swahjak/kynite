import type { Meta, StoryObj } from '@storybook/react-vite';

import { Section, Specimen } from '../specimen';
import { HOLIDAY_BANNERS, ThemeBanner, VACATION_BANNERS } from './theme-banner';

/**
 * **Feestdagen & vakanties** — op de betreffende datum verschijnt een
 * thema-banner over de volle breedte bovenaan Vandaag (zie
 * `Pages/Vandaag — thema's`, waar hij in situ staat).
 *
 * Automatisch actief op basis van de kalenderdatum, en op de dag zelf vervalt
 * de aftelteller. Staat de dag nog voor de deur, dan krijgt de banner rechts
 * een witte kaart met het aantal nachtjes in indigo — dat is het ene getal dat
 * kleine kinderen uit zichzelf vragen.
 *
 * Er is hier geen component om te verhuizen: welke dag vandaag is, is een
 * *domein*-vraag (`modules/holidays/domain/nl.ts` rekent Pasen en Koningsdag
 * uit, `specialDaysOn()` beantwoordt hem in de tijdzone van het huishouden) en
 * de kopij komt uit `messages/*.json`. Wat het design system wél bezit is de
 * banner-vorm, en die staat hieronder uit pakket-onderdelen en de
 * `--cat-*`-tokens opgebouwd.
 *
 * Twee dingen die dit specimen vastlegt:
 *
 * - **Het tegeltje is een emoji, geen icoon.** De icoonfont is een 64KB-subset
 *   van Material Symbols; daar zit geen mijter, geen pompoen en geen paasei in,
 *   en er is geen glyph die als Sinterklaas leest. Een emoji heeft geen asset
 *   nodig — dezelfde afweging die `modules/holidays/domain/nl.ts` maakt.
 * - **De accentkleur komt uit de categorie-palet, niet uit een nieuw palet.**
 *   Acht tinten waren er al; een feestdag is een sorteersignaal net als een
 *   agendacategorie, en een negende kleur zou alleen maar een tweede taal zijn.
 */
const meta: Meta = {
  title: 'Pages/Feestdagen & vakanties',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const Themes: Story = {
  render: () => (
    <div className="flex flex-col gap-12">
      <Section title="Feestdagen">
        <Specimen
          name="Theme/feestdag"
          note="Op de dag zelf: geen teller. Sinterklaas staat hier nog voor de deur, dus mét."
        >
          <div className="flex w-full max-w-3xl flex-col gap-4">
            {HOLIDAY_BANNERS.map((banner) => (
              <ThemeBanner key={banner.slug} banner={banner} />
            ))}
          </div>
        </Specimen>
      </Section>

      <Section title="Schoolvakanties">
        <Specimen
          name="Theme/vakantie"
          note="Een periode in plaats van een dag — dezelfde banner, met een reeks in de metaregel."
        >
          <div className="flex w-full max-w-3xl flex-col gap-4">
            {VACATION_BANNERS.map((banner) => (
              <ThemeBanner key={banner.slug} banner={banner} />
            ))}
          </div>
        </Specimen>
      </Section>
    </div>
  ),
};
