'use client';

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';
import type { IconName } from './icon-codepoints';
import { FAB_SLOT_ID, SlotPortal } from './slot-portal';

/**
 * The floating action button — `docs/design/components.md` § `Button/FAB`:
 * `width:56px;height:56px;border-radius:9999px;background:#5d5fef;
 * color:#ffffff;box-shadow:0 4px 14px rgba(93,95,239,0.35);` with the icon at
 * `font-size:28px`.
 *
 * It steps up to 64px from `sm` — `motion.md`'s "64px on tablet vs. 48px
 * minimum" rule for a primary, high-frequency action. The glyph rotates 90° on
 * hover. The shell owns the *position* (`FabSlot`, rendered by
 * `(app)/layout.tsx` clear of the mobile bottom bar and the safe-area inset);
 * a page owns the *action* and renders `<Fab>` anywhere in its own tree.
 *
 * Exactly one `<Fab>` should be mounted at a time. Two pages cannot both be
 * mounted in the App Router, so that falls out of the routing rather than
 * needing to be enforced here.
 *
 * **Links come in through `render`.** Half the FABs in the app navigate rather
 * than act, and the element that navigates has to be `next/link` so the route
 * is prefetched and the locale prefix is right — neither of which the design
 * system may know about. So the *app* passes the element
 * (`render={<Link href="/events/new" />}`, see `apps/web`'s wrapper) and this
 * component clones it with the FAB's own class, label and glyph. Base UI's
 * primitives take the same prop under the same name, so a caller who has met
 * `AlertDialogClose render={<Button/>}` already knows this one.
 */
export type FabProps = {
  icon: IconName;
  /** Accessible name. Required — a FAB with no label is an unlabelled button. */
  label: string;
  className?: string;
  /** Element to render instead of the default `<button>` — e.g. a link. */
  render?: ReactElement<{ className?: string; 'aria-label'?: string; children?: unknown }>;
} & Omit<ComponentProps<'button'>, 'className'>;

const fabClass =
  'group/fab flex size-14 items-center justify-center rounded-4xl bg-primary text-primary-foreground shadow-brand-lg transition-all duration-200 ease-brand hover:bg-brand-hover active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:size-16';

const fabIconClass = 'transition-transform duration-200 ease-brand group-hover/fab:rotate-90';

export function Fab({ icon, label, className, render, ...props }: FabProps) {
  const content = <Icon name={icon} size="xl" className={fabIconClass} />;

  return (
    <SlotPortal id={FAB_SLOT_ID}>
      {render ? (
        cloneElement(render, {
          ...props,
          'aria-label': label,
          className: cn(fabClass, className),
          children: content,
        })
      ) : (
        <button
          type="button"
          {...props}
          aria-label={label}
          className={cn(fabClass, className)}
          data-slot="fab"
        >
          {content}
        </button>
      )}
    </SlotPortal>
  );
}

/* -------------------------------------------------------------------------- */
/* Speed dial — the FAB that expands into two or three actions                 */
/* -------------------------------------------------------------------------- */

/**
 * One action in a `FabSpeedDial`.
 *
 * `onClick` **or** `render` — an action either does something in place (open a
 * dialog, switch a tab) or navigates, and navigation has to be the app's own
 * link element for the same reason `Fab` takes one. Both may be given: a link
 * that also wants to run something on the way out. Whatever the action is, the
 * dial closes after it: an expanded dial over a dialog it just opened is the
 * single most common speed-dial bug.
 */
export type FabSpeedDialAction = {
  /** Stable identity — React key, and the `data-testid` suffix. */
  id: string;
  icon: IconName;
  /**
   * The visible chip label, and — because the chip is *inside* the control —
   * the action's whole accessible name. No `aria-label` needed or wanted.
   */
  label: string;
  onClick?: () => void;
  /** Element to render instead of the default `<button>` — e.g. a link. */
  render?: ReactElement<{
    className?: string;
    children?: unknown;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    style?: CSSProperties;
    tabIndex?: number;
    'aria-disabled'?: boolean;
    'data-testid'?: string;
  }>;
  /**
   * Applies to both branches. A `<button>` gets the real attribute; a `render`
   * element gets `aria-disabled`, `tabIndex={-1}` and a swallowed click,
   * because there is no such thing as a disabled anchor.
   */
  disabled?: boolean;
};

export type FabSpeedDialProps = {
  /** The resting glyph. Rotates 45° when open, which turns `add` into a close. */
  icon?: IconName;
  /** Accessible name of the trigger while closed. Required — see `FabProps`. */
  label: string;
  /** Accessible name of the trigger while open. */
  closeLabel?: string;
  /** Two or three, in the order they read upward from the FAB. */
  actions: FabSpeedDialAction[];
  /** Controlled open state. Omit for the uncontrolled component. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

const actionButtonClass =
  'group/action flex items-center gap-3 rounded-4xl text-left transition-[opacity,transform] duration-200 ease-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50';

const actionLabelClass =
  'rounded-4xl bg-surface px-3 py-1.5 text-body-sm font-medium text-ink-secondary shadow-md';

const actionIconClass =
  'flex size-12 shrink-0 items-center justify-center rounded-4xl bg-surface text-brand shadow-md transition-colors duration-200 ease-brand group-hover/action:bg-brand group-hover/action:text-primary-foreground group-active/action:scale-95 sm:size-14';

/**
 * The expandable FAB: one primary button that opens a column of labelled mini
 * actions above it.
 *
 * Same slot, same visual language as `Fab` — 56px stepping to 64px, indigo,
 * `--shadow-brand-lg` — so a surface can swap one for the other without the
 * corner moving. It is a *second* component rather than a mode of `Fab`
 * because the two have nothing in common below the class strings: this one
 * owns open state, a backdrop, Escape, focus return and a keyboard order, and
 * folding all of that into the one-action FAB would make every plain FAB in
 * the app pay for it.
 *
 * **The "exactly one FAB mounted" rule still holds**, and harder: `FAB_SLOT_ID`
 * is one id, so a `Fab` and a `FabSpeedDial` mounted together stack on top of
 * one another.
 *
 * Three deliberate details:
 *
 * - **The whole row is the control.** A mini-fab is 48px, which clears the
 *   touch minimum, but a wall display two metres away is aimed at with an arm,
 *   not a thumb — so the label chip is *inside* the button rather than beside
 *   it, and the row (chip + circle, ~200px) is the target. It also means the
 *   accessible name is the visible text, rather than an `aria-label` nobody can
 *   check against the chip next to it.
 * - **DOM order is trigger-first, `flex-col-reverse` puts it at the bottom.**
 *   So Tab runs trigger → first action → second action, matching the reading
 *   order upward from the FAB, with no `tabIndex` juggling.
 * - **Closed actions are `inert`.** They stay mounted so they can transition,
 *   and `inert` takes them out of the tab order and the accessibility tree
 *   while they are invisible — the thing `opacity-0` alone famously does not do.
 */
export function FabSpeedDial({
  icon = 'add',
  label,
  closeLabel = 'Close',
  actions,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
}: FabSpeedDialProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const close = useCallback(() => {
    setOpen(false);
    // The dial closed by Escape or by an outside tap has just removed what the
    // user was pointing at; without this the focus ring lands on `<body>`.
    triggerRef.current?.focus();
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return (
    <SlotPortal id={FAB_SLOT_ID}>
      {/* Two siblings, both direct children of `FabSlot` so both get its
          `pointer-events-auto`. The backdrop is only there to catch the
          outside tap — it is transparent, because a scrim over the page would
          make a three-item menu read as a modal. */}
      <div
        data-slot="fab-speed-dial-backdrop"
        aria-hidden="true"
        className={cn('fixed inset-0', open ? 'block' : 'hidden')}
        onClick={close}
      />
      <div
        data-slot="fab-speed-dial"
        data-state={open ? 'open' : 'closed'}
        className={cn('flex flex-col-reverse items-end gap-3', className)}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-label={open ? closeLabel : label}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
          className={fabClass}
          data-slot="fab"
        >
          <Icon
            name={icon}
            size="xl"
            className={cn(
              'transition-transform duration-200 ease-brand motion-reduce:transition-none',
              open ? 'rotate-45' : 'group-hover/fab:rotate-90'
            )}
          />
        </button>
        <div
          id={listId}
          inert={!open}
          className="flex flex-col-reverse items-end gap-3"
          data-slot="fab-speed-dial-actions"
        >
          {actions.map((action, index) => {
            const content = (
              <>
                <span className={actionLabelClass}>{action.label}</span>
                <span className={actionIconClass} aria-hidden="true">
                  <Icon name={action.icon} size="md" />
                </span>
              </>
            );

            const handleClick = () => {
              action.onClick?.();
              setOpen(false);
            };

            // Staggered from the FAB outward on open, and together on close —
            // a menu should unfold and snap shut, not unfold backwards.
            const style = { transitionDelay: open ? `${index * 40}ms` : '0ms' };
            const stateClass = open
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-2 opacity-0';

            if (action.render) {
              // The element the app handed us may carry its own behaviour and
              // its own inline style (`<Link onClick={track} style={…}>`).
              // Cloning *over* either of those silently drops it, so both
              // compose: the consumer's handler runs first, and this
              // component's `transitionDelay` wins only the key it owns.
              const { onClick: renderOnClick, style: renderStyle } = action.render.props;

              return cloneElement(action.render, {
                key: action.id,
                className: cn(
                  actionButtonClass,
                  stateClass,
                  action.disabled && 'pointer-events-none opacity-50'
                ),
                children: content,
                // A link has no `disabled`, so a disabled one is stated three
                // ways: `aria-disabled` for assistive tech, `tabIndex={-1}` to
                // take it out of the tab order, and the click swallowed —
                // `pointer-events-none` alone still leaves Enter working.
                onClick: (event: MouseEvent<HTMLElement>) => {
                  if (action.disabled) {
                    event.preventDefault();
                    return;
                  }
                  renderOnClick?.(event);
                  handleClick();
                },
                style: { ...renderStyle, ...style },
                'aria-disabled': action.disabled || undefined,
                tabIndex: action.disabled ? -1 : undefined,
                'data-testid': `fab-action-${action.id}`,
              });
            }

            return (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onClick={handleClick}
                style={style}
                className={cn(actionButtonClass, stateClass)}
                data-testid={`fab-action-${action.id}`}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </SlotPortal>
  );
}

/**
 * The shell-side half: an empty, fixed container in the corner the mockups put
 * the FAB in. `pointer-events-none` so an empty slot never eats a click on the
 * content beneath it; the FAB itself takes them back.
 */
export function FabSlot() {
  return (
    <div
      id={FAB_SLOT_ID}
      className="pb-safe pointer-events-none fixed right-4 bottom-20 z-40 flex justify-end sm:right-8 sm:bottom-8 [&>*]:pointer-events-auto"
    />
  );
}
