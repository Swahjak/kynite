import type { ReactNode } from 'react';
import { PageHeader, SectionHeading } from '@/components/kynite';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon-codepoints';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * The settings/family list idiom, as five primitives (M19 phase 2).
 *
 * The stitch design system has exactly one shape for a page of settings
 * (`docs/design/stitch/.../kynite_design_system_overview/code.html:16,45`): a
 * `label-caps` group heading in the muted outline colour, then a card that owns
 * the rows underneath it. Everything else on those screens — the icon tiles,
 * the trailing chevron, the 48px row height — falls out of the M3 list spec the
 * mockups are drawn against.
 *
 * Before this, every settings surface hand-rolled its own `flex flex-col gap-1`
 * heading with a generic `text-lg`/`text-sm text-muted-foreground` pair
 * (docs/rebuild-design-gaps.md §9: "CardTitle should use the brand type
 * scale"). Six pages spelled the same three elements six ways. They are here
 * once instead, which is also what makes the hub and its four subpages read as
 * one surface rather than five.
 *
 * Server-renderable on purpose: every consumer is a server component, and the
 * interactive parts (forms, dialogs) stay in the module slices that own them.
 */

/** The page frame — one column, capped, with room above the mobile bottom bar. */
export function SettingsPage({ children, className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      className={cn('mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 pb-12 sm:p-8', className)}
      {...props}
    >
      {children}
    </main>
  );
}

/**
 * The tinted glyph tile the mockups lead every list row and page header with.
 *
 * `brand-container` rather than `primary`: a page with eight of these must not
 * be eight full-strength brand rectangles, and the container pair is the tonal
 * step M3 defines for exactly this (`globals.css` `--brand-container`).
 */
export function SettingsIconTile({
  icon,
  size = 'default',
  className,
}: {
  icon: IconName;
  size?: 'default' | 'lg';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-slot="settings-icon-tile"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-brand-container text-brand-container-ink',
        size === 'lg' ? 'size-14' : 'size-11',
        className
      )}
    >
      <Icon name={icon} size={size === 'lg' ? 'xl' : 'md'} />
    </span>
  );
}

/** A subpage's way back to the hub. The four flows are deep links in the wild. */
export function SettingsBackLink({ href = '/settings', label }: { href?: string; label: string }) {
  return (
    <Link
      href={href}
      data-slot="settings-back"
      className="-ml-2 inline-flex w-fit items-center gap-1 rounded-4xl px-2 py-1 font-display text-body-sm font-semibold text-brand-ink transition-colors duration-200 ease-brand hover:bg-surface-container"
    >
      <Icon name="chevron_left" size="sm" />
      {label}
    </Link>
  );
}

/**
 * A subpage's title block: icon tile, `h1` on the brand scale, one line of why.
 *
 * `layout.md` § Header covers the shell's own bar; this is the content header
 * one level in, which `kynite/page-header.tsx` draws at `headline-lg` for every
 * route in the system — so it delegates rather than repeating that markup.
 */
export function SettingsPageHeader({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description?: string;
}) {
  return <PageHeader icon={icon} iconTint="brand-container" title={title} subtitle={description} />;
}

/**
 * A group: `SectionHeading` inside a card, content underneath it.
 *
 * `components.md` § Cards' `Card/Stat` is the model — "Header row separated by
 * `border-bottom:1px solid #e1e3e4;padding-bottom:16px;margin-bottom:16px;`" —
 * so the heading lives inside the card rather than as a hand-rolled label
 * above it. `danger` sections get `outlined` for the visible red frame; every
 * other section is `default` (elevation-only), which is enough contrast on
 * this page's cream background.
 *
 * `id` is optional and drives the anchor *and* the `settings-section-*` test id
 * the e2e suite walks (`e2e/tests/app/settings/settings.spec.ts:95-107`), so a
 * heading with no route behind it does not have to invent one.
 */
export function SettingsSection({
  id,
  title,
  description,
  action,
  tone = 'default',
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  /** Rendered opposite the heading — the "add member" trigger, and nothing else so far. */
  action?: ReactNode;
  tone?: 'default' | 'danger';
  children: ReactNode;
}) {
  return (
    <section id={id} data-testid={id ? `settings-section-${id}` : undefined}>
      <Card
        variant={tone === 'danger' ? 'outlined' : 'default'}
        className={cn(tone === 'danger' && 'border-destructive/30')}
      >
        <CardContent className="flex flex-col gap-4">
          <SectionHeading
            title={title}
            action={action}
            size="card"
            className="border-b border-border pb-4"
          />
          {description ? <p className="text-body-sm text-ink-secondary">{description}</p> : null}
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * An icon-led row that goes somewhere — the hub's way into the four surfaces
 * that keep a route of their own.
 *
 * The `label` is the link's visible text *and* its accessible name: the e2e
 * suite navigates by `getByRole('link', { name: 'Apparaten beheren' })`, and an
 * `aria-label` that disagreed with the text would also trip axe's
 * label-in-name rule. Full-bleed inside the section card via the negative
 * margin, so the hover tint reaches the card's edges.
 *
 * That promise is what the `description` has to work around. Rendered as plain
 * text inside the anchor it becomes part of the name-from-content computation,
 * and the accessible name silently turns into "Apparaten beheren Koppel een
 * tablet…" — which breaks the exact-name locators above and, worse, makes every
 * row announce a sentence where a destination was asked for. So it is
 * `aria-hidden` where it is *drawn* and repeated once, screen-reader-only,
 * outside the anchor as the link's `aria-describedby` target: same pixels, name
 * is the label alone, description still reaches anyone who wants it. The
 * `sr-only` twin is absolutely positioned, so it adds no row to the card's flex
 * column and no gap.
 */
export function SettingsNavRow({
  href,
  icon,
  label,
  description,
  bordered = false,
}: {
  href: string;
  icon: IconName;
  label: string;
  description?: string;
  /** A rule above the row when it follows other content in the same card. */
  bordered?: boolean;
}) {
  // Derived from the destination rather than `useId`: this is a server
  // component, and the href is already unique among the rows of a settings card.
  const descriptionId = description
    ? `settings-nav-${href.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}-description`
    : undefined;

  return (
    <>
      <Link
        href={href}
        data-slot="settings-nav-row"
        aria-describedby={descriptionId}
        className={cn(
          'group/row -mx-4 flex min-h-12 items-center gap-4 px-4 py-3 transition-colors duration-200 ease-brand hover:bg-surface-container',
          bordered && '-mt-4 border-t border-border pt-4'
        )}
      >
        <SettingsIconTile icon={icon} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-body text-body font-semibold text-ink">{label}</span>
          {description ? (
            <span aria-hidden className="text-body-sm text-ink-secondary">
              {description}
            </span>
          ) : null}
        </span>
        <Icon
          name="chevron_right"
          size="md"
          className="text-ink-muted transition-transform duration-200 ease-brand group-hover/row:translate-x-0.5"
        />
      </Link>
      {description ? (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      ) : null}
    </>
  );
}
