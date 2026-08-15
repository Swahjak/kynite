import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import { Card } from '../../src/components/card';
import { FaceStack } from '../../src/components/face-stack';
import { Icon } from '../../src/components/icon';
import type { IconName } from '../../src/components/icon-codepoints';
import { IconMedallion } from '../../src/components/icon-medallion';
import { MediaRow } from '../../src/components/media-row';
import { PageHeader } from '../../src/components/page-header';
import { StarCount } from '../../src/components/star-count';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * **Page layout** — the sidebar + header + footer shell for the tablet/desktop
 * "Hub" context.
 *
 * The shell is a Next layout in the app (`app/[locale]/(hub)/layout.tsx`): it
 * reads the session, the household and the pairing state, so it is not a
 * component the design system can hold. What the design system owns is the
 * *shape* of it, and this specimen is that shape assembled from package parts —
 * the rail, the content header, the card rhythm and the status footer.
 *
 * Three things the specimen is here to pin:
 *
 * - **The rail is icons with words.** A wall display is read by people who did
 *   not install the app, including children who are still learning to read the
 *   words — so the glyph and the label both stay, at every width.
 * - **The header is `PageHeader surface="hub"`.** No icon tile, Display M
 *   title, clock in the action slot.
 * - **The footer states sync, quietly.** "Synced 2 min ago" is ambient
 *   reassurance in `ink-muted`; a stale hub does not get an alarm colour,
 *   because a kitchen screen shouting about a network is worse than a kitchen
 *   screen that is two minutes old.
 */
const meta: Meta = {
  title: 'Pages/Page layout',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

const NAV: { icon: IconName; label: string }[] = [
  { icon: 'home', label: 'Home' },
  { icon: 'calendar_month', label: 'Agenda' },
  { icon: 'checklist', label: 'Routines' },
  { icon: 'workspace_premium', label: 'Beloningen' },
  { icon: 'settings', label: 'Instellingen' },
];

export const HubShell: Story = {
  render: () => (
    <div className="min-h-screen bg-background p-6">
      <Section title="Hub shell">
        <Specimen
          name="Layout/hub"
          note="Rail · content header · card grid · status footer. Every part is a package component."
        >
          <div className="flex w-full overflow-hidden rounded-3xl border border-line-subtle bg-background shadow-sm">
            {/* Rail */}
            <nav
              aria-label="Hoofdnavigatie"
              className="flex w-52 shrink-0 flex-col gap-1 border-r border-line-subtle bg-card p-4"
            >
              <div className="mb-4 flex items-center gap-2.5">
                <IconMedallion
                  icon="family_home"
                  tint="brand-solid"
                  shape="squircle"
                  size="md"
                  filled
                />
                <span className="font-display text-h3 font-extrabold">Kynite</span>
              </div>

              {NAV.map((item, index) => (
                <a
                  key={item.label}
                  href="#hub"
                  aria-current={index === 0 ? 'page' : undefined}
                  className={
                    index === 0
                      ? 'flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 font-display text-body-sm font-bold text-primary-foreground'
                      : 'flex items-center gap-3 rounded-xl px-3 py-2.5 font-display text-body-sm font-bold text-ink-secondary transition-colors duration-200 hover:bg-surface-container hover:text-ink'
                  }
                >
                  <Icon name={item.icon} size="sm" filled={index === 0} />
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-col gap-6 p-8">
                <PageHeader
                  surface="hub"
                  title="Home"
                  subtitle="Woensdag 21 oktober"
                  action={
                    <div className="flex items-center gap-3">
                      <StarCount value={24} srLabel="24 sterren" size="lg" />
                      <Button variant="ghost" size="icon" aria-label="Meldingen">
                        <Icon name="notifications" />
                      </Button>
                    </div>
                  }
                />

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="gap-4 p-6">
                    <h2 className="font-display text-h2 font-bold">Vandaag thuis</h2>
                    <div className="flex flex-col gap-2">
                      <MediaRow
                        leading={<IconMedallion icon="restaurant" tint="gold" size="md" filled />}
                        title="Avondeten"
                        meta="18:00 · Iedereen"
                        actions={
                          <FaceStack
                            faces={MEMBERS.map((member) => ({
                              id: member.name,
                              name: member.name,
                              avatarUrl: member.src,
                            }))}
                          />
                        }
                      />
                      <MediaRow
                        leading={<IconMedallion icon="dark_mode" tint="muted" size="md" />}
                        title="Bedtijdroutine"
                        meta="19:30 · Kinderen"
                        actions={
                          <FaceStack
                            faces={MEMBERS.slice(0, 2).map((member) => ({
                              id: member.name,
                              name: member.name,
                              avatarUrl: member.src,
                            }))}
                          />
                        }
                      />
                    </div>
                  </Card>

                  <Card variant="muted" className="gap-4 p-6">
                    <h2 className="font-display text-h2 font-bold">Wacht op jou</h2>
                    <MediaRow
                      variant="tinted"
                      leading={
                        <IconMedallion icon="redeem" tint="brand-container" size="md" filled />
                      }
                      title="Mila vroeg een beloning aan"
                      meta={<StarCount value={12} srLabel="12 sterren" size="sm" />}
                      actions={<Button size="sm">Goedkeuren</Button>}
                    />
                  </Card>
                </div>
              </div>

              <footer className="mt-auto flex items-center justify-between border-t border-line-subtle px-8 py-4 text-caption text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Icon name="repeat" size="xs" />2 minuten geleden gesynchroniseerd
                </span>
                <span>Kynite Family Hub</span>
              </footer>
            </div>
          </div>
        </Specimen>
      </Section>
    </div>
  ),
};
