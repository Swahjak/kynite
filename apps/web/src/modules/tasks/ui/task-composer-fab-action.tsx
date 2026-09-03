'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { openTaskComposer } from './use-task-composer';

/**
 * "Taak erbij" as one action inside `modules/today`'s `TodayFab` (the FAB
 * speed dial) — the phone-only fourth action, since a device principal has no
 * `task:write` (§7) and the wall's dial stays at two.
 *
 * It lives in this slice for the same reason `AddEventFabAction` lives in the
 * calendar's: the thing it triggers is ours. `modules/today` may not import
 * `@/modules/tasks` from a client component — the barrel re-exports
 * `server-only` loaders, so pulling it into the browser graph fails the build,
 * and the deep import across a slice boundary is banned by
 * `eslint.config.mjs`. So the slice that owns the composer owns the trigger,
 * and the page hands the day panel a finished element sized to be one
 * `FabSpeedDialAction`'s `render` — `@kynite/ui`'s `FabSpeedDial` clones
 * whatever is passed there with its own `className`, `children`, `onClick`
 * (composed over whatever this element already carried) and a few ARIA/test
 * attributes, so this component forwards every one of those rather than
 * building its own trigger chrome.
 *
 * There is no dialog and no local `open` state to hold, unlike
 * `AddEventFabAction`: `openTaskComposer()` just flips the shared module store
 * `useTaskComposer()` reads (`use-task-composer.ts`) to `true`, and
 * `TaskList`'s own inline field — still mounted, still the same field the
 * removed pill used to open — reacts to that on its own. This used to be a
 * `<Button>` built for the wall board's own quick-action grid (`git log`:
 * `TaskComposerAction`, mounted nowhere — `task:write` was `deny` for every
 * principal that ever reached it). The grid is gone; the mechanism it was
 * built on is exactly what this action needed, so it moved here rather than
 * being invented twice.
 *
 * A principal without `task:write` gets no action resolved at all, rather
 * than one whose field would refuse to submit — the page's call, the same way
 * `AddEventFabAction`'s `canWrite` gate is the page's.
 */
export type TaskComposerFabActionProps = {
  // The props `FabSpeedDial` clones onto `action.render`.
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  style?: CSSProperties;
  'aria-disabled'?: boolean;
  tabIndex?: number;
  'data-testid'?: string;
};

export function TaskComposerFabAction({
  onClick,
  children,
  ...cloneProps
}: TaskComposerFabActionProps) {
  return (
    <button
      type="button"
      {...cloneProps}
      onClick={(event) => {
        onClick?.(event);
        openTaskComposer();
      }}
    >
      {children}
    </button>
  );
}
