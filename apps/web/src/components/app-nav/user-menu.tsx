'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from '@base-ui/react/menu';
import { clearUserCachesWithin } from '@/components/offline';
import { cn } from '@kynite/ui';

/**
 * The signed-in member, at the bottom of the nav — and the sign-out behind it.
 *
 * M21: the shell's glass header is gone (it carried a clock, the calendar's
 * view pill, this avatar and a bare "Uitloggen" button for a row of pixels on
 * every page). The avatar was the only part of it that belongs to the *shell*
 * rather than to a page, so it moved to the foot of the rail — where every
 * product with a sidebar puts it, and where it costs no vertical space at all.
 *
 * `signOut` arrives as a prop rather than an import: this is a client
 * component under `components/`, and the Server Action lives in the family
 * slice, whose barrel is server-only. The layout already holds both, so it
 * hands the action down (Next serialises it as a reference, not as code).
 *
 * The cache wipe is the one the old header's `SignOutButton` ran, moved here
 * with it (M11 review blocker 1): the session is not the only copy of the
 * household on the device — the service worker holds rendered pages keyed by
 * URL alone and IndexedDB holds the mirrored board, so a shared tablet would
 * otherwise show the next person the previous one's `/today`. It runs *first*, in the browser
 * where those APIs live, and the action only follows once it has finished.
 */
export type UserMenuLabels = {
  /** The trigger's and the popup's accessible name. */
  account: string;
  signOut: string;
};

export type UserMenuUser = {
  name: string;
  /** A rendered `<MemberAvatar>` — the shell resolves the member row. */
  avatar: ReactNode;
};

function useSignOut(signOut: () => Promise<void>) {
  const [pending, setPending] = useState(false);

  return {
    pending,
    run: () => {
      if (pending) return;
      setPending(true);
      void (async () => {
        await clearUserCachesWithin();
        await signOut();
      })();
    },
  };
}

/** Same 64px tile geometry as `AppRail`'s links, so the foot of the rail lines up. */
const triggerClass =
  'flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 text-ink-secondary transition-all duration-200 ease-brand outline-none select-none hover:bg-surface-container-high hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 data-popup-open:bg-surface-container-high data-popup-open:text-ink';

/** Shared with the sheet rows below: 44px minimum, per `docs/design/README.md`. */
const itemClass =
  'flex min-h-11 cursor-default items-center gap-3 rounded-xl px-3 py-2 font-display text-body-sm font-semibold text-ink transition-colors duration-200 ease-brand outline-none select-none data-highlighted:bg-surface-container-high data-disabled:opacity-50';

/**
 * Rail variant: avatar tile pinned to the bottom, menu opening *upward*.
 *
 * `side="top"` rather than the `side="right"` a left rail would suggest: the
 * trigger sits on the bottom edge, so a menu growing sideways from it reads as
 * belonging to whatever tile happens to be beside it, while one growing up out
 * of the avatar is unambiguously the avatar's.
 */
export function UserMenu({
  user,
  labels,
  signOut,
}: {
  user: UserMenuUser;
  labels: UserMenuLabels;
  signOut: () => Promise<void>;
}) {
  const { pending, run } = useSignOut(signOut);

  return (
    <Menu.Root>
      <Menu.Trigger
        className={triggerClass}
        aria-label={`${user.name} — ${labels.account}`}
        data-testid="user-menu-trigger"
      >
        {user.avatar}
        <span className="label-overline w-full truncate text-center">{user.name}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={8} className="isolate z-50">
          {/* Same surface tokens as `SelectContent` and `FieldPicker` — one popup look. */}
          <Menu.Popup
            aria-label={labels.account}
            data-testid="user-menu"
            className="origin-(--transform-origin) min-w-56 rounded-2xl bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="flex items-center gap-3 px-3 py-2">
              {user.avatar}
              <span className="min-w-0 truncate font-display text-body-sm font-bold text-ink">
                {user.name}
              </span>
            </div>
            <div className="my-1 h-px bg-border" role="none" />
            <Menu.Item
              className={itemClass}
              disabled={pending}
              onClick={run}
              data-testid="sign-out"
            >
              {labels.signOut}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * Phone variant: the same account block, at the bottom of the "More" sheet.
 *
 * The bottom bar has five thumb-sized tabs at 390px and a sixth would shrink
 * every label past legibility, so the account does not become a tab — it sits
 * at the foot of the sheet those tabs already open, which is the same "bottom
 * of the menu" the rail puts it at. No nested popup either: a menu inside a
 * sheet is two dismiss layers over one action, so the sign-out is a plain
 * button in the sheet's own list.
 */
export function UserMenuSheetSection({
  user,
  labels,
  signOut,
  className,
}: {
  user: UserMenuUser;
  labels: UserMenuLabels;
  signOut: () => Promise<void>;
  className?: string;
}) {
  const { pending, run } = useSignOut(signOut);

  return (
    <div className={cn('mt-2 border-t border-border pt-3', className)} data-testid="user-menu">
      <div className="flex items-center gap-3 px-3 py-2">
        {user.avatar}
        <span className="min-w-0 truncate font-display text-body-sm font-bold text-ink">
          {user.name}
        </span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={cn(itemClass, 'w-full hover:bg-surface-container-high disabled:opacity-50')}
        data-testid="sign-out"
      >
        {labels.signOut}
      </button>
    </div>
  );
}
