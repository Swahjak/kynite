import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Button } from '../../src/components/button';
import { Icon } from '../../src/components/icon';
import { DeviceCaption, DesignSheet, ScreenNote } from '../device';
import { ThemeBanner, HOLIDAY_BANNERS, VACATION_BANNERS, bannerFor } from './theme-banner';
import { VandaagHub } from './vandaag-hub';

/**
 * **Vandaag — thema's** — the same hub, on a day that means something.
 *
 * The claim this page exists to make is a negative one: on a birthday, at
 * Christmas or in the summer holidays, **nothing is rearranged**. The theme
 * banner is one full-width row added above the three columns, and the day
 * column, the per-person grid, the routines and the tasks are exactly where
 * they were yesterday. A wall display that reshuffled itself six times a year
 * would be a display nobody can read at a glance any more.
 *
 * The banner is also *ambient* rather than instructive: it says what today is
 * and, if the day is still ahead, how many nights are left. It never takes the
 * NU block's job of saying what is happening right now — decoration does not
 * get to outrank the routine a child is standing in front of.
 *
 * In the app the theme follows the calendar date — `modules/holidays/domain/nl.ts`
 * computes Easter and Koningsdag, `specialDaysOn()` answers in the household's
 * timezone. The chip row here is a story control, not a product surface.
 *
 * The banner shapes themselves, and all twelve Dutch days that get one, are in
 * `Pages/Feestdagen & vakanties`.
 */
const meta: Meta = {
  title: "Pages/Vandaag — thema's",
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

const CHIPS: readonly { slug: string; label: string }[] = [
  { slug: 'geen', label: 'Geen thema' },
  ...HOLIDAY_BANNERS.map((banner) => ({
    slug: banner.slug,
    label: banner.eyebrow === 'JARIG!' ? 'Verjaardag' : titleCase(banner.eyebrow),
  })),
  ...VACATION_BANNERS.map((banner) => ({
    slug: banner.slug,
    label: titleCase(banner.eyebrow),
  })),
];

function titleCase(caps: string): string {
  return caps.charAt(0) + caps.slice(1).toLowerCase();
}

function ThemedHub({ initial }: { initial: string }) {
  const [slug, setSlug] = React.useState(initial);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-caption text-ink-muted">
          <Icon name="palette" size="xs" />
          In de app volgt het thema de datum
        </span>
        {CHIPS.map((chip) => (
          <Button
            key={chip.slug}
            type="button"
            size="sm"
            variant={chip.slug === slug ? 'default' : 'outline'}
            aria-pressed={chip.slug === slug}
            onClick={() => setSlug(chip.slug)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      <VandaagHub banner={slug === 'geen' ? undefined : <ThemeBanner banner={bannerFor(slug)} />} />
    </div>
  );
}

export const Zomervakantie: Story = {
  render: () => (
    <DesignSheet
      title="Vandaag — met thema's"
      intro="Zelfde opbouw als Vandaag, met de seizoensthema's erbij. Vrijdag 14 augustus 2026 valt in de zomervakantie, dus die staat aan. Wissel van thema met de chips."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834</DeviceCaption>
        <ThemedHub initial="zomervakantie" />
        <ScreenNote width={1194}>
          De vakantiebanner staat over de volle breedte boven de kolommen. Alles eronder — NU-blok,
          dagoverzicht, per persoon, routines, taken — staat exact waar het gisteren stond.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const Verjaardag: Story = {
  render: () => (
    <DesignSheet
      title="Vandaag — verjaardag"
      intro="De enige banner zonder aftelteller in dit specimen: het is vandaag. De teller verdwijnt op de dag zelf in plaats van 'nog 0' te lezen."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834</DeviceCaption>
        <ThemedHub initial="verjaardag" />
        <ScreenNote width={1194}>
          De jarige staat in de banner en nergens anders: het dagoverzicht blijft het dagoverzicht,
          ook op je verjaardag.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};

export const Sinterklaas: Story = {
  render: () => (
    <DesignSheet
      title="Vandaag — Sinterklaas op komst"
      intro="Een dag die nog vóór ons ligt: dezelfde banner, mét de witte aftelkaart rechts. Dat getal is het enige dat kleine kinderen uit zichzelf vragen."
    >
      <div>
        <DeviceCaption icon="tablet_mac">Wandtablet landscape 1194 × 834</DeviceCaption>
        <ThemedHub initial="sinterklaas" />
        <ScreenNote width={1194}>
          De aftelkaart is wit met indigo cijfers — de enige plek op de banner waar het merkblauw
          terugkomt, zodat het getal het eerste is wat je ziet.
        </ScreenNote>
      </div>
    </DesignSheet>
  ),
};
