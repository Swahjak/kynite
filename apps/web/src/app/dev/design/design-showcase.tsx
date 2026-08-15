'use client';

import * as React from 'react';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@kynite/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Toaster, toast } from '@/components/ui/toast';
import {
  BRAND_SWATCHES,
  CATEGORIES,
  ICON_SAMPLES,
  INK_SWATCHES,
  LINE_SWATCHES,
  STATUS_SWATCHES,
  SURFACE_SWATCHES,
  TYPE_SCALE,
  type Swatch,
} from './tokens';

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

function Section({
  id,
  title,
  description,
  children,
  ...props
}: React.ComponentProps<'section'> & { title: string; description?: string }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4" {...props}>
      <div className="space-y-1">
        <h2 className="text-h2">{title}</h2>
        {description ? <p className="text-body-sm text-ink-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Panel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-card p-5 shadow-sm', className)}
      {...props}
    />
  );
}

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {swatches.map((s) => (
        <li key={s.name} className="space-y-2">
          <div
            className={cn('h-16 w-full rounded-xl border border-line', s.className)}
            data-swatch={s.name}
          />
          <div>
            <p className="font-display text-body-sm font-medium">{s.name}</p>
            <p className="text-caption text-ink-secondary">
              {s.cssVar}
              {s.note ? ` — ${s.note}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Showcase                                                                    */
/* -------------------------------------------------------------------------- */

export function DesignShowcase({ initialTheme = 'light' }: { initialTheme?: 'light' | 'dark' }) {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(initialTheme);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    return () => {
      root.classList.remove('dark');
      delete root.dataset.theme;
    };
  }, [theme]);

  return (
    <Toaster>
      <div className="min-h-dvh bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand/20">
                <Icon name="family_home" filled size="md" className="text-brand-ink" />
              </span>
              <div>
                <h1 className="text-h3">Kynite design system</h1>
                <p className="label-overline text-ink-secondary">Internal — /dev/design</p>
              </div>
            </div>
            <Button
              size="hub"
              variant="outline"
              data-testid="theme-toggle"
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size="md" />
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-12 px-6 py-10" data-testid="design-main">
          {/* ---------------------------------------------------------------- */}
          <Section
            id="brand"
            title="Brand colours"
            description="Primary indigo #5d5fef and accent orange #ef8d5d, plus the accessible on-light ink variants."
          >
            <Panel>
              <SwatchGrid swatches={BRAND_SWATCHES} />
            </Panel>
          </Section>

          <Section
            id="surfaces"
            title="Surfaces, ink, lines and status"
            description="Every value flips with the dark class; contrast is verified at WCAG AA."
          >
            <Panel className="space-y-6">
              <div className="space-y-3">
                <h3 className="label-overline text-ink-secondary">Surfaces</h3>
                <SwatchGrid swatches={SURFACE_SWATCHES} />
              </div>
              <div className="space-y-3">
                <h3 className="label-overline text-ink-secondary">Ink</h3>
                <SwatchGrid swatches={INK_SWATCHES} />
              </div>
              <div className="space-y-3">
                <h3 className="label-overline text-ink-secondary">Lines</h3>
                <SwatchGrid swatches={LINE_SWATCHES} />
              </div>
              <div className="space-y-3">
                <h3 className="label-overline text-ink-secondary">Status</h3>
                <SwatchGrid swatches={STATUS_SWATCHES} />
              </div>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section
            id="categories"
            title="Category palette"
            description="Eight event colours, each with surface / border / text / solid variants."
          >
            <Panel>
              <ul className="grid gap-3 sm:grid-cols-2">
                {CATEGORIES.map((c) => (
                  <li key={c.name}>
                    <div
                      data-category={c.name}
                      className={cn(
                        'rounded-lg border-l-4 p-3 transition-all duration-200 ease-brand',
                        c.surface,
                        // The 4px rule is the *solid* hue, not the pale chip
                        // outline — `docs/design/calendar.md` § "Event list
                        // item".
                        c.rule
                      )}
                    >
                      <p className={cn('font-display text-body-sm font-bold', c.fg)}>
                        {c.name.toUpperCase()}
                      </p>
                      <p className={cn('text-caption', c.fg)}>{c.useCase}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn('size-3 rounded-full', c.solid)} aria-hidden="true" />
                      <span className="text-caption text-ink-secondary">
                        --cat-{c.name}-surface / -border / -fg / -solid
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section
            id="typography"
            title="Typography"
            description="Baloo 2 for display, Poppins for body — both self-hosted via next/font."
          >
            <Panel className="space-y-5">
              {TYPE_SCALE.map((t) => (
                <div key={t.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="w-28 shrink-0 text-caption text-ink-secondary">{t.name}</span>
                  <span className={cn('min-w-0 truncate', t.className)}>Today&rsquo;s Flow</span>
                  <span className="text-caption text-ink-muted">{t.spec}</span>
                </div>
              ))}
            </Panel>

            <Panel className="space-y-3">
              <h3 className="label-overline text-ink-secondary">Tabular numerals</h3>
              <p className="text-body-sm text-ink-secondary">
                The <code className="text-caption">tabular-time</code> utility fixes digit width so
                clocks do not jitter between frames.
              </p>
              <div className="flex flex-wrap items-baseline gap-6">
                <span className="tabular-time text-display-md" data-testid="tabular-time">
                  08:30
                </span>
                <span className="tabular-time text-display-md">11:11</span>
                <span className="tabular-time text-h1 text-brand-ink">00:45</span>
                <span className="text-body-sm text-ink-secondary">
                  vs. proportional: <span className="text-h3 font-display">08:30 11:11</span>
                </span>
              </div>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section
            id="icons"
            title="Iconography"
            description="Material Symbols Outlined, self-hosted variable font. FILL 0 default, FILL 1 for active states."
          >
            <Panel className="space-y-6">
              <div className="flex flex-wrap gap-5">
                {ICON_SAMPLES.map((name) => (
                  <span key={name} className="flex w-24 flex-col items-center gap-1 text-center">
                    <Icon name={name} size="lg" />
                    <span className="text-caption text-ink-secondary break-all">{name}</span>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-6">
                <span className="flex flex-col items-center gap-1">
                  <Icon name="star" size="xl" />
                  <span className="text-caption text-ink-secondary">outlined</span>
                </span>
                <span className="flex flex-col items-center gap-1">
                  <Icon name="star" size="xl" filled className="text-gold-ink" />
                  <span className="text-caption text-ink-secondary">icon-filled</span>
                </span>
                {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((size) => (
                  <span key={size} className="flex flex-col items-center gap-1">
                    <Icon name="schedule" size={size} />
                    <span className="text-caption text-ink-secondary">{size}</span>
                  </span>
                ))}
              </div>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section
            id="buttons"
            title="Buttons"
            description="200ms ease transitions with an active:scale-95 press, per the brand guideline."
          >
            <Panel className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="gold">Celebrate</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">Extra small</Button>
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="hub">Hub 48px</Button>
                <Button size="icon" aria-label="Add event (icon)">
                  <Icon name="add" size="sm" />
                </Button>
                <Button size="icon-hub" aria-label="Add event (hub icon)">
                  <Icon name="add" size="md" />
                </Button>
              </div>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="cards" title="Cards" description="Default, event and now cards.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Standard card</CardTitle>
                  <CardDescription>Used for general content display.</CardDescription>
                  <CardAction>
                    <Button variant="ghost" size="icon-sm" aria-label="Card options">
                      <Icon name="settings" size="sm" />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-ink-secondary">
                  Surface, 1px line, radius xl and the sm shadow.
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm">
                    Open
                  </Button>
                </CardFooter>
              </Card>

              <div className="rounded-lg border-l-4 border-cat-blue-solid bg-cat-blue-surface p-3">
                <p className="label-overline text-cat-blue-fg">Event card</p>
                <p className="font-display text-h3 text-cat-blue-fg">Voetbaltraining</p>
                <p className="tabular-time text-body-sm text-cat-blue-fg">17:30 — 18:45</p>
              </div>

              <div className="rounded-2xl border-2 border-brand bg-brand/10 p-4 shadow-md">
                <p className="label-overline text-brand-ink">Happening now</p>
                <p className="font-display text-h3">Kitchen duty: Leo</p>
                <p className="tabular-time text-body-sm text-ink-secondary">00:45 remaining</p>
              </div>
            </div>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="avatars-badges" title="Avatars & badges">
            <Panel className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar size="sm">
                  <AvatarFallback>SA</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>MI</AvatarFallback>
                </Avatar>
                <Avatar
                  size="lg"
                  className="ring-2 ring-cat-purple-border ring-offset-2 ring-offset-background"
                >
                  <AvatarFallback>DA</AvatarFallback>
                </Avatar>
                <Avatar
                  size="hub"
                  className="ring-2 ring-brand ring-offset-2 ring-offset-background"
                >
                  <AvatarFallback>PE</AvatarFallback>
                  <AvatarBadge />
                </Avatar>
                <AvatarGroup>
                  <Avatar>
                    <AvatarFallback>A</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>B</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>C</AvatarFallback>
                  </Avatar>
                </AvatarGroup>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Overdue</Badge>
                <Badge variant="now">Now</Badge>
                <Badge variant="today">Today</Badge>
                <Badge variant="gold">3 stars</Badge>
                <Badge size="hub" variant="today">
                  Hub badge
                </Badge>
              </div>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="forms" title="Inputs, selects and tabs">
            <Panel className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="ds-input" className="label-overline text-ink-secondary block">
                    Default input
                  </label>
                  <Input id="ds-input" placeholder="Add a new task…" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ds-select" className="label-overline text-ink-secondary block">
                    Default select
                  </label>
                  <Select defaultValue="week">
                    <SelectTrigger id="ds-select" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Tabs defaultValue="today">
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="chores">Chores</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="pt-2 text-ink-secondary">
                  Three events remaining.
                </TabsContent>
                <TabsContent value="week" className="pt-2 text-ink-secondary">
                  Weekly overview.
                </TabsContent>
                <TabsContent value="chores" className="pt-2 text-ink-secondary">
                  Two routines left.
                </TabsContent>
              </Tabs>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="overlays" title="Dialog, sheet and toast">
            <Panel className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete event?</DialogTitle>
                    <DialogDescription>
                      This removes the event from Kynite and from the linked Google Calendar.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter showCloseButton />
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Narrow the board down to one person.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>

              <Button
                variant="outline"
                onClick={() =>
                  toast.add({
                    title: 'Routine complete',
                    description: 'Mila finished the morning routine.',
                    type: 'success',
                  })
                }
              >
                Show toast
              </Button>
            </Panel>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section
            id="hub-variants"
            title="Hub variants"
            description="Every interactive element here renders at 48×48px minimum for wall-mounted kiosk use."
            data-testid="hub-variants"
          >
            <Panel className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="hub">Ik ben klaar</Button>
                <Button size="hub" variant="gold">
                  <Icon name="star" filled size="md" />
                  Beloning
                </Button>
                <Button size="hub" variant="outline">
                  Later
                </Button>
                <Button size="icon-hub" variant="ghost" aria-label="Add event">
                  <Icon name="add" size="md" />
                </Button>
                <Button size="icon-hub" variant="outline" aria-label="Open settings">
                  <Icon name="settings" size="md" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="hub-input" className="label-overline text-ink-secondary block">
                    Hub input
                  </label>
                  <Input id="hub-input" size="hub" placeholder="Nieuwe taak…" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="hub-select" className="label-overline text-ink-secondary block">
                    Hub select
                  </label>
                  <Select defaultValue="mila">
                    <SelectTrigger id="hub-select" size="hub" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem size="hub" value="mila">
                        Mila
                      </SelectItem>
                      <SelectItem size="hub" value="daan">
                        Daan
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Tabs defaultValue="mila">
                <TabsList size="hub">
                  <TabsTrigger value="mila">Mila</TabsTrigger>
                  <TabsTrigger value="daan">Daan</TabsTrigger>
                  <TabsTrigger value="iedereen">Iedereen</TabsTrigger>
                </TabsList>
                <TabsContent value="mila" className="pt-2 text-ink-secondary">
                  Ochtendroutine — 2 stappen open.
                </TabsContent>
                <TabsContent value="daan" className="pt-2 text-ink-secondary">
                  Alles klaar. Goed bezig.
                </TabsContent>
                <TabsContent value="iedereen" className="pt-2 text-ink-secondary">
                  Vier routines vandaag.
                </TabsContent>
              </Tabs>
            </Panel>
          </Section>
        </main>
      </div>
    </Toaster>
  );
}
