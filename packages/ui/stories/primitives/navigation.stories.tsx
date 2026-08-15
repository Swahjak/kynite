import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import { Icon } from '../../src/components/icon';
import type { IconName } from '../../src/components/icon-codepoints';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/tabs';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Navigation` — the bottom tab bar and the sidebar rail from the design
 * sheet, plus the `Tabs` primitive they are often confused with.
 *
 * The bar and the rail are *specimens*, not components: the shipped versions
 * live in `apps/web/src/components/app-nav/` because every item is a route and
 * a translated label, both of which the package boundary keeps out. What is
 * reproduced here is the shape — sizes, active tint, label treatment — so a
 * phase-3 extraction has something to be checked against.
 */
const meta = {
  title: 'Primitives/Navigation',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: { label: string; icon: IconName }[] = [
  { label: 'Home', icon: 'home' },
  { label: 'Agenda', icon: 'event' },
  { label: 'Routines', icon: 'checklist' },
  { label: 'Rewards', icon: 'redeem' },
  { label: 'Settings', icon: 'settings' },
];

export const BottomBar: Story = {
  name: 'Bottom tab bar',
  render: () => (
    <Section title="Navigation — bottom bar">
      <Specimen
        name="Nav/Bottom bar"
        note="80px row, 24px glyphs, Baloo 2 700 uppercase labels; active is brand."
      >
        <nav className="glass flex w-[520px] max-w-full items-center justify-around rounded-2xl border border-line-subtle px-2">
          {ITEMS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`flex h-20 min-w-12 flex-col items-center justify-center gap-1 ${
                index === 0 ? 'text-brand-ink' : 'text-ink-secondary'
              }`}
            >
              <Icon name={item.icon} filled={index === 0} />
              <span className="label-overline">{item.label}</span>
            </button>
          ))}
        </nav>
      </Specimen>
    </Section>
  ),
};

export const Sidebar: Story = {
  name: 'Sidebar rail',
  render: () => (
    <Section title="Navigation — sidebar">
      <Specimen
        name="Nav/Sidebar"
        note="200px wide, 10px item radius, active tint rgba(93,95,239,.08)."
      >
        <aside className="flex h-96 w-50 flex-col gap-1 border-r border-line-subtle bg-sidebar px-4 py-6">
          <div className="mb-5 flex items-center gap-2.5 px-2.5">
            <span className="grid size-7 place-items-center rounded-full bg-primary font-display text-[13px] font-extrabold text-primary-foreground">
              K
            </span>
            <span className="font-display text-body font-bold">Kynite</span>
          </div>
          {ITEMS.slice(0, 4).map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left ${
                index === 0
                  ? 'bg-sidebar-accent font-display text-body-sm font-bold text-sidebar-accent-foreground'
                  : 'text-body-sm text-ink-secondary'
              }`}
            >
              <Icon name={item.icon} size="sm" filled={index === 0} />
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-body-sm text-ink-secondary"
          >
            <Icon name="settings" size="sm" />
            Settings
          </button>
        </aside>
      </Specimen>
    </Section>
  ),
};

export const TabsPrimitive: Story = {
  name: 'Tabs',
  render: () => (
    <Section title="Navigation — tabs">
      <SpecimenGrid>
        <Specimen
          name="Tabs/default"
          note="The segmented control: filled track, raised active tab."
        >
          <Tabs defaultValue="today">
            <TabsList>
              <TabsTrigger value="today">Vandaag</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Maand</TabsTrigger>
            </TabsList>
            <TabsContent value="today">Vandaag</TabsContent>
            <TabsContent value="week">Week</TabsContent>
            <TabsContent value="month">Maand</TabsContent>
          </Tabs>
        </Specimen>
        <Specimen name="Tabs/line" note="Underlined, for a tab strip that sits on a card edge.">
          <Tabs defaultValue="mila">
            <TabsList variant="line">
              <TabsTrigger value="mila">Mila</TabsTrigger>
              <TabsTrigger value="daan">Daan</TabsTrigger>
              <TabsTrigger value="lotte">Lotte</TabsTrigger>
            </TabsList>
            <TabsContent value="mila">Mila</TabsContent>
            <TabsContent value="daan">Daan</TabsContent>
            <TabsContent value="lotte">Lotte</TabsContent>
          </Tabs>
        </Specimen>
        <Specimen name="Tabs/hub" note="48px triggers, Baloo 2 — the wall-hub step.">
          <Tabs defaultValue="today">
            <TabsList size="hub">
              <TabsTrigger value="today">Vandaag</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
            <TabsContent value="today">Vandaag</TabsContent>
            <TabsContent value="week">Week</TabsContent>
          </Tabs>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const HeaderRow: Story = {
  name: 'Page header',
  render: () => (
    <Section title="Navigation — header">
      <Specimen name="Nav/Header" note="64px: title, notifications, avatar slot.">
        <header className="flex h-16 w-[560px] max-w-full items-center gap-3 border-b border-line-subtle bg-surface px-5">
          <h1 className="flex-1 font-display text-h2">Home</h1>
          <Button variant="ghost" size="icon-hub" aria-label="Meldingen">
            <Icon name="notifications" />
          </Button>
        </header>
      </Specimen>
    </Section>
  ),
};
