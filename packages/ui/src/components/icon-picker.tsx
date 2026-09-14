'use client';

import { cn } from '../lib/utils';
import { Icon } from './icon';
import type { IconName } from './icon-codepoints';

/**
 * A grid of 48px icon tiles — the routine, step and task editors' shared
 * "pick a glyph" control (M5 of the 2026-09-14 taken-board-routines-page
 * plan). One component so all three pickers look and behave the same, and so
 * a change to the selection treatment lands in one place.
 *
 * Built on a native `role="radiogroup"` of `<input type="radio">`s sharing
 * `name`, exactly like the routine dialog's icon picker this replaces — that
 * is what makes it keyboard navigable for free (arrow keys move the browser's
 * own radio-group selection) without reimplementing roving `tabIndex`.
 *
 * Labels are structural, never looked up here: `labelFor` and `ariaLabel`
 * arrive as props so a caller can supply translated strings — the package
 * boundary rule (`packages/ui/.oxlintrc.json`) bars `next-intl` from this
 * file.
 */
export type IconPickerProps = {
  /** The closed set of icons this picker offers, in display order. */
  icons: readonly IconName[];
  value: IconName;
  onChange: (icon: IconName) => void;
  /** Shared `name` for the underlying radio inputs. */
  name: string;
  /** Accessible name for the `radiogroup` itself. */
  ariaLabel: string;
  /** Accessible name for one option, e.g. "Tanden poetsen icon". */
  labelFor: (icon: IconName) => string;
  /**
   * The selected tile's tint, e.g. `ROUTINE_ICON_TILE[icon]`. Unselected
   * tiles are always the neutral surface — colour is a selection cue, not a
   * catalogue of every option's colour at once.
   */
  tileClassFor: (icon: IconName) => string;
  className?: string;
  /** Test id prefix; one option renders `${testIdPrefix}-${icon}`. */
  testIdPrefix?: string;
};

export function IconPicker({
  icons,
  value,
  onChange,
  name,
  ariaLabel,
  labelFor,
  tileClassFor,
  className,
  testIdPrefix,
}: IconPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {icons.map((option) => {
        const selected = option === value;
        return (
          <label
            key={option}
            data-testid={testIdPrefix ? `${testIdPrefix}-${option}` : undefined}
            data-selected={selected ? 'true' : 'false'}
            // Squircles, not circles (`Routines.dc.html` r378-385): 48px at
            // radius 12 selected, with the indigo edge; 40px neutral
            // otherwise. The size *is* the selection cue — a ring alone
            // reads as focus.
            className={cn(
              'flex cursor-pointer items-center justify-center transition-all',
              selected
                ? cn('size-12 rounded-xl border-2 border-primary', tileClassFor(option))
                : 'size-10 rounded-lg bg-surface-container text-ink-muted hover:text-ink-secondary'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <Icon name={option} size="sm" label={labelFor(option)} />
          </label>
        );
      })}
    </div>
  );
}
