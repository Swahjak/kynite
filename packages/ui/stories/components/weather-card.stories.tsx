import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeatherCard, type WeatherScene } from '../../src/components/weather-card';
import { Section, Specimen } from '../specimen';

/**
 * `WeatherCard` — *"de hele kaart draagt het weer"*.
 *
 * The variant the Vandaag sheet actually composes into a page: at the head of
 * the hub's third column and above "Dagoverzicht" on the phone. The sheet's
 * other four weather treatments (white-card hub widget, compact thumbnail row,
 * forecast modal, mobile bottom sheet) are not placed in either layout and are
 * not built.
 *
 * Five card scenes carry twelve weather types. The card itself takes a scene
 * and three already-formatted strings — no `WeatherSnapshot`, no WMO code, no
 * translation. The app's `modules/weather/domain/visual.ts` owns the fold from
 * 28 WMO codes to twelve types to five scenes, and its wrapper supplies the
 * Dutch.
 *
 * ## What has no scene of its own
 *
 * The scenery layer draws sun, cloud, drop, bolt and moon. There is no snow
 * scene and no fog scene in the sheet, so snow and hail ride the rain sky and
 * fog rides the cloudy one — the labels below say which type each specimen is.
 *
 * ## The two visuals nothing can reach
 *
 * **Wind** and **hagel** are in the design system's twelve, and no weather
 * code produces either. WMO 4677 carries no wind state at all (and
 * `WeatherObservation` no wind field), and hail's only codes — 96 and 99 —
 * are *thunderstorm with hail*, which a household needs to read as thunder.
 * Both are drawn here for completeness and are unreachable from data.
 *
 * ## Night
 *
 * The sheet draws one Nacht theme and exactly two night icons (`clear_night`,
 * `partly_cloudy_night`). So `isDay: false` moves clear and partly-cloudy onto
 * the night sky and **leaves everything else on its day scene** — there is no
 * night rain, night snow, night fog or night thunder in the design, and none
 * is invented.
 *
 * Motion: every layer loops between 1.25s and 46s and stops dead under
 * `prefers-reduced-motion: reduce`.
 */
const meta = {
  title: 'Components/Weather card',
  component: WeatherCard,
  parameters: { layout: 'padded' },
  argTypes: {
    scene: {
      control: 'inline-radio',
      options: ['sunny', 'partly-cloudy', 'rain', 'storm', 'night'],
    },
    density: { control: 'inline-radio', options: ['hub', 'phone'] },
  },
  args: {
    scene: 'partly-cloudy',
    temperature: '21°',
    condition: 'Half bewolkt',
    meta: 'Utrecht · 23° / 14°',
    density: 'hub',
  },
  render: (args) => (
    <div className="max-w-[420px]">
      <WeatherCard {...args} />
    </div>
  ),
} satisfies Meta<typeof WeatherCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The instance the Vandaag sheet places at the head of the hub's column. */
export const Default: Story = {};

/**
 * The twelve weather types of the design system's "Weertypes" grid, each on
 * the card scene it folds onto. Two of them — wind and hagel — are drawn here
 * and reachable from no WMO code; see the component docs above.
 */
const TYPES: {
  key: string;
  label: string;
  scene: WeatherScene;
  temperature: string;
  meta: string;
  note?: string;
}[] = [
  {
    key: 'sunny',
    label: 'Zonnig',
    scene: 'sunny',
    temperature: '26°',
    meta: 'Utrecht · 26° / 15°',
  },
  {
    key: 'partly-cloudy',
    label: 'Half bewolkt',
    scene: 'partly-cloudy',
    temperature: '21°',
    meta: 'Utrecht · 23° / 14°',
  },
  {
    key: 'cloudy',
    label: 'Bewolkt',
    scene: 'partly-cloudy',
    temperature: '18°',
    meta: 'Utrecht · 19° / 12°',
    note: 'No sunless daytime sky exists in the sheet — overcast rides the half-bewolkt scene.',
  },
  { key: 'rain', label: 'Regen', scene: 'rain', temperature: '15°', meta: 'Utrecht · 16° / 11°' },
  {
    key: 'drizzle',
    label: 'Motregen',
    scene: 'rain',
    temperature: '14°',
    meta: 'Utrecht · 15° / 11°',
  },
  {
    key: 'thunder',
    label: 'Onweer',
    scene: 'storm',
    temperature: '24°',
    meta: 'Utrecht · 24° / 17°',
  },
  {
    key: 'snow',
    label: 'Sneeuw',
    scene: 'rain',
    temperature: '-1°',
    meta: 'Utrecht · 1° / -4°',
    note: 'The sheet draws no snow scene; snow rides the rain sky.',
  },
  {
    key: 'hail',
    label: 'Hagel',
    scene: 'rain',
    temperature: '6°',
    meta: 'Utrecht · 8° / 3°',
    note: 'UNREACHABLE — WMO has no hail code; 96/99 are thunderstorm-with-hail and render as Onweer.',
  },
  {
    key: 'fog',
    label: 'Mist',
    scene: 'partly-cloudy',
    temperature: '9°',
    meta: 'Utrecht · 12° / 7°',
    note: 'The sheet draws no fog scene; mist rides the cloudy sky.',
  },
  {
    key: 'wind',
    label: 'Wind',
    scene: 'partly-cloudy',
    temperature: '13°',
    meta: 'Utrecht · 14° / 9°',
    note: 'UNREACHABLE — WMO codes carry no wind state and the snapshot no wind field.',
  },
  {
    key: 'clear-night',
    label: 'Helder · nacht',
    scene: 'night',
    temperature: '13°',
    meta: 'Utrecht · 13° / 9°',
  },
  {
    key: 'partly-cloudy-night',
    label: 'Half bewolkt · nacht',
    scene: 'night',
    temperature: '12°',
    meta: 'Utrecht · 13° / 8°',
  },
];

export const AllTypes: Story = {
  name: 'All twelve weather types',
  parameters: { controls: { disable: true } },
  render: () => (
    <Section title="Weertypes">
      <div className="grid gap-6 sm:grid-cols-2">
        {TYPES.map((type) => (
          <Specimen key={type.key} name={type.label} note={type.note}>
            <div className="w-full min-w-[320px]">
              <WeatherCard
                scene={type.scene}
                temperature={type.temperature}
                condition={type.label}
                meta={type.meta}
              />
            </div>
          </Specimen>
        ))}
      </div>
    </Section>
  ),
};

/**
 * The same two conditions by day and after dark — the only pair the design
 * gives a night twin. Rain, snow, fog and thunder keep their day scene at
 * night, which is what the third row shows.
 */
export const DayAndNight: Story = {
  name: 'Day and night',
  parameters: { controls: { disable: true } },
  render: () => (
    <Section title="Dag en nacht">
      <div className="grid gap-6 sm:grid-cols-2">
        <Specimen name="Helder · dag">
          <div className="w-full min-w-[320px]">
            <WeatherCard
              scene="sunny"
              temperature="26°"
              condition="Zonnig"
              meta="Utrecht · 26° / 15°"
            />
          </div>
        </Specimen>
        <Specimen name="Helder · nacht">
          <div className="w-full min-w-[320px]">
            <WeatherCard
              scene="night"
              temperature="13°"
              condition="Helder"
              meta="Utrecht · 13° / 9°"
            />
          </div>
        </Specimen>
        <Specimen name="Half bewolkt · dag">
          <div className="w-full min-w-[320px]">
            <WeatherCard
              scene="partly-cloudy"
              temperature="21°"
              condition="Half bewolkt"
              meta="Utrecht · 23° / 14°"
            />
          </div>
        </Specimen>
        <Specimen name="Half bewolkt · nacht">
          <div className="w-full min-w-[320px]">
            <WeatherCard
              scene="night"
              temperature="12°"
              condition="Half bewolkt"
              meta="Utrecht · 13° / 8°"
            />
          </div>
        </Specimen>
        <Specimen
          name="Regen · nacht"
          note="Unchanged from the day scene: the sheet draws no night rain, and none is invented."
        >
          <div className="w-full min-w-[320px]">
            <WeatherCard
              scene="rain"
              temperature="12°"
              condition="Regen"
              meta="Utrecht · 14° / 10°"
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};

/**
 * The two densities the Vandaag sheet places: the wall's full-size card, and
 * the phone's compact one above "Dagoverzicht". The scenery is authored once
 * at hub size and the phone scales it from its top-right corner, which is the
 * relationship the sheet itself draws (210px stage → 150px).
 */
export const Densities: Story = {
  name: 'Hub and phone',
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-8">
      <Specimen name="density=hub">
        <div className="w-[420px]">
          <WeatherCard
            scene="partly-cloudy"
            temperature="21°"
            condition="Half bewolkt"
            meta="Utrecht · 23° / 14°"
          />
        </div>
      </Specimen>
      <Specimen name="density=phone">
        <div className="w-[360px]">
          <WeatherCard
            scene="partly-cloudy"
            temperature="21°"
            condition="Half bewolkt"
            meta="Utrecht · 23° / 14°"
            density="phone"
          />
        </div>
      </Specimen>
    </div>
  ),
};

/**
 * No place, no forecast day: the meta line is dropped rather than filled with
 * a placeholder. A household that has not named its location still gets the
 * temperature and the condition.
 */
export const WithoutMeta: Story = {
  name: 'Without a meta line',
  args: { meta: undefined, scene: 'rain', temperature: '15°', condition: 'Regen' },
};
