'use client';

import { MemberFace, cn } from '@kynite/ui';

/**
 * The "Wie" filter (`Taken en routines.dc.html`'s header): an "Iedereen" pill
 * plus one round hit zone per family member, multi-select, client state only
 * (no URL param — a filter chosen at the wall tablet is not a link anyone
 * else needs to share).
 *
 * Presentational and structural on purpose, like `RoutineCard`'s domain
 * props: it takes already-resolved `MemberFilterEntry`s (a colour class, not
 * a `MemberColor`) and plain translated strings rather than calling
 * `useTranslations` itself, so both the "Taken" board (M1+M2) and the
 * "Actieve routines" page (M3) can hand it their own member list without
 * this component knowing which slice either page lives in — the same reason
 * `MemberFace` itself takes a `surfaceClass` rather than a member row.
 *
 * Selection: an empty `selectedIds` means "everyone" — every face renders at
 * full opacity with no ring, and the "Iedereen" pill wears the selected
 * treatment. Once at least one id is selected, the "Iedereen" pill reverts to
 * its unselected look, selected faces get the 2px indigo ring, and the rest
 * dim to 45% opacity.
 */

export type MemberFilterEntry = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** `MEMBER_COLOR_CLASSES[color].surface` — resolved by the caller. */
  surfaceClass: string;
};

export function MemberFilter({
  members,
  selectedIds,
  onToggle,
  onClear,
  label,
  everyoneLabel,
  filterLabel,
  className,
}: {
  members: readonly MemberFilterEntry[];
  /** Empty = everyone shown, nobody explicitly selected. */
  selectedIds: ReadonlySet<string>;
  onToggle: (memberId: string) => void;
  onClear: () => void;
  /** "Wie" */
  label: string;
  /** "Iedereen" */
  everyoneLabel: string;
  /** Accessible name for one member's hit zone, e.g. "Filter op Fien". */
  filterLabel: (displayName: string) => string;
  className?: string;
}) {
  const allSelected = selectedIds.size === 0;

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="font-display text-overline font-bold tracking-wide text-ink-secondary uppercase">
        {label}
      </span>

      <button
        type="button"
        onClick={onClear}
        aria-pressed={allSelected}
        className="flex h-12 items-center rounded-4xl bg-transparent px-0 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span
          className={cn(
            'inline-flex h-8 items-center rounded-4xl px-3.5 font-display text-body-sm font-bold whitespace-nowrap',
            allSelected
              ? 'bg-surface-container-highest text-foreground'
              : 'border border-line-subtle bg-card text-ink-secondary'
          )}
        >
          {everyoneLabel}
        </span>
      </button>

      {members.map((member) => {
        const selected = !allSelected && selectedIds.has(member.id);
        const dimmed = !allSelected && !selected;

        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onToggle(member.id)}
            aria-pressed={selected}
            aria-label={filterLabel(member.displayName)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <MemberFace
              name={member.displayName}
              avatarUrl={member.avatarUrl}
              surfaceClass={member.surfaceClass}
              ringClass="ring-primary"
              ringed={selected}
              size="default"
              className={dimmed ? 'opacity-45' : undefined}
            />
          </button>
        );
      })}
    </div>
  );
}
