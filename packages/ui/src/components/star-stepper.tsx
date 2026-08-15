'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Icon } from './icon';

/**
 * How many stars — the one number a parent sets by hand.
 *
 * The floor is a prop and its default is 0, and there is no mode, variant or
 * prop anywhere on this component that makes the value negative. That is the
 * economy rule stated as a type: a star that has been earned is a fact about
 * the past, so nothing in Kynite subtracts one, and the control that would do
 * it does not exist rather than existing and being disabled.
 *
 * The decrement is typeset (`−`, U+2212) rather than drawn: the 64 KB icon
 * subset has no `remove` glyph, and a minus is a character before it is an
 * icon. Its accessible name comes from `copy.decrease`, so nothing depends on
 * the character being read out.
 */
export function StarStepper({
  value,
  onValueChange,
  min = 0,
  max = 20,
  name,
  size = 'md',
  showStar = false,
  copy,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  value: number;
  onValueChange: (next: number) => void;
  min?: number;
  max?: number;
  /** When set, the value is posted with the surrounding form under this name. */
  name?: string;
  size?: 'md' | 'lg';
  /** Sets the star beside the number — the sheet does, the builder row does not. */
  showStar?: boolean;
  copy: { decrease: string; increase: string; value: string };
}) {
  const big = size === 'lg';

  return (
    <div
      data-slot="star-stepper"
      className={cn('flex items-center gap-2.5', big && 'justify-center gap-5', className)}
      {...props}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={copy.decrease}
        disabled={value <= min}
        onClick={() => onValueChange(Math.max(min, value - 1))}
        className={cn('rounded-full', big ? 'size-11' : 'size-8.5')}
      >
        <span aria-hidden>−</span>
      </Button>

      <span
        data-testid="star-stepper-value"
        aria-live="polite"
        aria-label={copy.value}
        className={cn(
          'flex items-center justify-center gap-2 font-display font-extrabold text-gold-ink',
          big ? 'text-display-md' : 'min-w-4.5 text-h3 text-ink'
        )}
      >
        {showStar ? <Icon name="star" filled size={big ? 'xl' : 'md'} /> : null}
        <span className="tnum">{value}</span>
      </span>

      <Button
        type="button"
        size="icon"
        aria-label={copy.increase}
        disabled={value >= max}
        onClick={() => onValueChange(Math.min(max, value + 1))}
        className={cn('rounded-full', big ? 'size-11' : 'size-8.5')}
      >
        <Icon name="add" size={big ? 'md' : 'sm'} />
      </Button>
    </div>
  );
}
