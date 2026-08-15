import * as React from 'react';

import type { IconName } from '@/components/ui/icon-codepoints';
import { cn } from '@/lib/utils';
import { IconMedallion } from './icon-medallion';

/**
 * The heading row above a section of a page: optional icon medallion, a title,
 * optional trailing content (a count, a total, an action button).
 *
 * `typography.md`: section headings are Baloo 2 700 at 24px (`text-h2`), card
 * headings at 16–18px (`text-h3`). `eyebrow` is the `label-caps` specimen —
 * "Baloo 2 700, 12px/16px, `0.05em`, uppercase".
 *
 * This replaces three verbatim copies of the same JSX (`QueueHeading` in the
 * rewards approval queue, `SectionHeading` in the timers board, and the inline
 * copy on the rewards page/store).
 */
export function SectionHeading({
  icon,
  iconTint = 'brand',
  iconFilled = false,
  title,
  eyebrow,
  description,
  action,
  level = 2,
  size = 'section',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  icon?: IconName;
  iconTint?: React.ComponentProps<typeof IconMedallion>['tint'];
  iconFilled?: boolean;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Heading level. The visual size is `size`, never the level. */
  level?: 2 | 3;
  size?: 'section' | 'card';
}) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div
      data-slot="section-heading"
      className={cn('flex items-center justify-between gap-3', className)}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <IconMedallion
            icon={icon}
            filled={iconFilled}
            tint={iconTint}
            shape="squircle"
            size={size === 'section' ? 'md' : 'sm'}
          />
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <span className="label-overline block text-ink-muted">{eyebrow}</span> : null}
          <Heading
            className={cn(
              'font-display font-bold text-ink',
              size === 'section' ? 'text-h2' : 'text-h3'
            )}
          >
            {title}
          </Heading>
          {description ? <p className="text-body-sm text-ink-secondary">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
