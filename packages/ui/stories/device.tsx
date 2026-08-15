import type { ReactNode } from 'react';

import { Icon } from '../src/components/icon';
import type { IconName } from '../src/components/icon-codepoints';
import { MemberFace } from '../src/components/member-face';
import { cn } from '../src/lib/utils';
import { TODAY, TOM } from './family';

/**
 * The furniture the `Pages/*` stories put a screen inside.
 *
 * This is story scenery, not design system: a phone bezel and a wall-tablet
 * bezel are how the design sheets frame a screen so its *density* can be
 * judged, and density is the whole point of a page specimen. None of it is
 * exported from `@kynite/ui`, and it lives under `stories/` so its one-off
 * class strings stay out of the product's stylesheet (see `.storybook/main.ts`).
 *
 * The two shells — the hub rail and the phone tab bar — are the exception
 * worth naming. They *are* app chrome, drawn here rather than in the package
 * because the real ones are Next layouts that read the session and the pairing
 * state (`app/[locale]/(hub)/layout.tsx`). What the design system owns is
 * their shape, which `Pages/Page layout` already pins; this file reproduces it
 * so a page story can show its own navigation context.
 */

/** The sheet's `TABLET_MAC · 1194 × 834` caption above a frame. */
export function DeviceCaption({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-ink-muted">
      <Icon name={icon} size="sm" />
      <span className="label-overline">{children}</span>
    </div>
  );
}

/** The note the sheet sets under a screen — what the layout decided, and why. */
export function ScreenNote({ children, width }: { children: ReactNode; width: number }) {
  return (
    <p className="mt-3.5 text-body-sm leading-relaxed text-ink-secondary" style={{ width }}>
      {children}
    </p>
  );
}

/** Wall tablet, landscape: 1194 × 834, the size the hub is designed against. */
export function TabletFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex overflow-hidden rounded-3xl border border-line-subtle bg-background shadow-lg"
      style={{ width: 1194, height: 834 }}
    >
      {children}
    </div>
  );
}

/** Phone: 390 × 844. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[40px] border border-line-subtle bg-background shadow-lg"
      style={{ width: 390, height: 844 }}
    >
      {children}
    </div>
  );
}

/**
 * The page ground the sheets use: the screens float on a tone *darker* than
 * their own cream, so the bezel reads as an object in a room.
 */
export function DesignSheet({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-container-high p-10">
      <div className="mb-7">
        <h1 className="font-display text-display-md font-extrabold text-ink">{title}</h1>
        <p className="max-w-3xl text-body-sm text-ink-secondary">{intro}</p>
      </div>
      <div className="flex flex-wrap items-start gap-12">{children}</div>
    </div>
  );
}

export type NavKey = 'vandaag' | 'kalender' | 'routines' | 'sterren';

const NAV: readonly { key: NavKey; icon: IconName; label: string }[] = [
  { key: 'vandaag', icon: 'home', label: 'Vandaag' },
  { key: 'kalender', icon: 'calendar_month', label: 'Kalender' },
  { key: 'routines', icon: 'checklist', label: 'Routines' },
  { key: 'sterren', icon: 'star', label: 'Sterren' },
];

/**
 * The hub's 76px rail. Icons *with* words at every width: a wall display is
 * read by people who did not install the app, children included.
 */
export function HubRail({ current }: { current: NavKey }) {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="flex w-19 shrink-0 flex-col items-center gap-1.5 border-r border-line-subtle bg-surface-container-low py-4.5"
    >
      <span className="mb-3.5 flex size-9 items-center justify-center rounded-xl bg-primary font-display text-body font-extrabold text-primary-foreground">
        K
      </span>
      {NAV.map((item) => (
        <span
          key={item.key}
          aria-current={item.key === current ? 'page' : undefined}
          className={cn(
            'flex size-13 flex-col items-center justify-center gap-0.5 rounded-2xl',
            item.key === current ? 'bg-primary/10 text-brand' : 'text-ink-muted'
          )}
        >
          <Icon name={item.icon} size="md" filled={item.key === current} />
          <span className="font-display text-[9px] font-bold">{item.label}</span>
        </span>
      ))}
      <span className="flex-1" />
      <MemberFace name={TOM.name} avatarUrl={TOM.avatar} surfaceClass={TOM.surface} size="sm" />
    </nav>
  );
}

/** The phone's status bar. Only the clock — the carrier glyphs are not ours. */
export function PhoneStatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-6.5 pt-3 pb-1">
      <span className="tnum text-caption font-semibold text-ink">{TODAY.clock}</span>
      <span className="flex items-center gap-1.5 text-ink">
        <span className="h-2.5 w-1 rounded-xs bg-ink" />
        <span className="h-3 w-1 rounded-xs bg-ink" />
        <span className="h-3.5 w-1 rounded-xs bg-ink" />
      </span>
    </div>
  );
}

/** The phone's tab bar, glass over the scrolling content. */
export function PhoneTabBar({ current }: { current: NavKey }) {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="glass flex shrink-0 justify-around border-t border-line-subtle px-2 pt-2.5 pb-6.5"
    >
      {NAV.map((item) => (
        <span
          key={item.key}
          aria-current={item.key === current ? 'page' : undefined}
          className={cn(
            'flex h-12 w-15 flex-col items-center justify-center gap-0.5',
            item.key === current ? 'text-brand' : 'text-ink-muted'
          )}
        >
          <Icon name={item.icon} size="md" filled={item.key === current} />
          <span className="font-display text-[10px] font-bold">{item.label}</span>
        </span>
      ))}
    </nav>
  );
}

/**
 * The FAB, in a bezel.
 *
 * The real `Fab` portals into `FabSlot`, the shell's fixed corner container
 * (`components/slot-portal.tsx`) — and it cannot be used here for two
 * independent reasons: the slot is `position: fixed`, so it would sit in the
 * corner of the *browser* rather than of the phone, and `SlotPortal` reads the
 * container during render, so a slot mounted in the same commit is never
 * found. The geometry below is the component's own: 56px, pill, `shadow-brand-lg`.
 */
export function PhoneFab({ label = 'Nieuw item' }: { label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="absolute right-5 bottom-26 flex size-14 items-center justify-center rounded-4xl bg-primary text-primary-foreground shadow-brand-lg"
    >
      <Icon name="add" size="xl" />
    </button>
  );
}

/**
 * The drag affordance on a reorderable row.
 *
 * Six dots in CSS rather than Material's `drag_indicator`, because the icon
 * font is a hard-capped 64 KB subset (`apps/web/scripts/subset-icons.mjs`) and
 * a glyph that only ever appears in a story is not worth a kilobyte of a
 * kiosk's boot path. The shape is identical; the cost is not.
 */
export function GripHandle({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 grid-cols-2 gap-x-1 gap-y-0.5 text-line', className)}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className="size-1 rounded-full bg-current" />
      ))}
    </span>
  );
}

/** The section label the sheets set above a stack — 12px, bold, tracked out. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('label-overline block text-ink-muted', className)}>{children}</span>;
}
