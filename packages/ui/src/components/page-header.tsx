import * as React from 'react';

import { cn } from '../lib/utils';
import { type IconName } from './icon-codepoints';
import { IconMedallion } from './icon-medallion';

/**
 * The header at the top of a route: an icon tile, the page title, an optional
 * subtitle, and right-aligned actions.
 *
 * `layout.md` § Header sets the shell's own title at Baloo 2 700 / 17px; this
 * is the *content* header one level in, which every screen in the system draws
 * as `headline-lg` (Baloo 2 700, 32px/40px, `-0.02em` — `text-h1` here).
 *
 * `surface="hub"` is the wall-display variant: no icon tile, display-scale
 * title, and a slot on the right for the clock.
 * `leading` renders before the icon/title, for something like a back link.
 * `meta` renders inline next to the title itself — chips or badges, never a
 * heading or a landmark — not stacked with the subtitle below it.
 */
export function PageHeader({
  icon,
  iconTint = 'brand',
  iconFilled = false,
  leading,
  title,
  subtitle,
  meta,
  action,
  surface = 'app',
  className,
  ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
  icon?: IconName;
  iconTint?: React.ComponentProps<typeof IconMedallion>['tint'];
  iconFilled?: boolean;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  /** Buttons, a clock, a dialog trigger — anything right-aligned. */
  action?: React.ReactNode;
  surface?: 'app' | 'hub';
}) {
  const hub = surface === 'hub';

  return (
    <header
      data-slot="page-header"
      data-surface-variant={surface}
      className={cn('flex flex-wrap items-start justify-between gap-4', className)}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        {icon && !hub ? (
          <IconMedallion
            icon={icon}
            filled={iconFilled}
            tint={iconTint}
            shape="squircle"
            size="xl"
            className="shadow-sm"
          />
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn('font-display font-bold text-ink', hub ? 'text-display-md' : 'text-h1')}
            >
              {title}
            </h1>
            {meta}
          </div>
          {subtitle ? (
            <p className={cn('text-ink-secondary', hub ? 'text-body-lg' : 'text-body-sm')}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
