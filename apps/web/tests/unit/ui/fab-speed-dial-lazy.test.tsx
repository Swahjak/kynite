import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import {
  FAB_SLOT_ID,
  FabSpeedDial,
  useFabSpeedDialAction,
  type FabSpeedDialAction,
} from '@kynite/ui';

/**
 * Regression coverage for the `/today` SSR crash: `TypeError: Cannot
 * destructure property 'onClick' of 'a.render.props' as it is undefined`.
 *
 * A page (Server Component) hands `FabSpeedDial` a finished client-component
 * element as an action's `render` — across that Server→Client boundary,
 * React Flight may deliver the element as a *lazy reference*
 * (`$$typeof: react.lazy`, no `.props` until React itself resolves it)
 * rather than a plain element `cloneElement` can introspect. `fab.tsx` must
 * detect that (`action.render.props === undefined`) and fall back to handing
 * the chrome down through `useFabSpeedDialAction()` instead of cloning.
 *
 * `makeLazyElement` builds the same `{ $$typeof, _payload, _init }` shape
 * React's own child reconciler resolves for a lazy child — real enough for
 * both React (it mounts the wrapped element) and our `.props` check (there is
 * none on the wrapper) without needing an actual Flight round-trip.
 */
function makeLazyElement(element: ReactElement): ReactElement {
  return {
    $$typeof: Symbol.for('react.lazy'),
    _payload: { value: element },
    _init: (payload: { value: ReactElement }) => payload.value,
  } as unknown as ReactElement;
}

/** Stand-in for `AddEventFabAction`/`TaskComposerFabAction`/`TimerStartFabAction`. */
function LazyTrigger() {
  const slot = useFabSpeedDialAction();

  return (
    <button
      type="button"
      className={slot?.className}
      style={slot?.style}
      onClick={slot?.onClick}
      data-testid={slot?.['data-testid']}
    >
      {slot?.children}
    </button>
  );
}

describe('FabSpeedDial — action.render across the RSC boundary', () => {
  beforeEach(() => {
    // `FabSpeedDial` portals into the shell's `FabSlot` by id (`SlotPortal`) —
    // without this node in the DOM it silently renders nothing at all.
    const slot = document.createElement('div');
    slot.id = FAB_SLOT_ID;
    document.body.appendChild(slot);
  });

  it('mounts a lazy-reference render without throwing, via the context fallback', () => {
    const actions: FabSpeedDialAction[] = [
      { id: 'lazy', icon: 'add', label: 'Nieuw event', render: makeLazyElement(<LazyTrigger />) },
    ];

    expect(() =>
      render(<FabSpeedDial label="Toevoegen" actions={actions} defaultOpen />)
    ).not.toThrow();

    expect(screen.getByTestId('fab-action-lazy')).toBeInTheDocument();
    expect(screen.getByText('Nieuw event')).toBeInTheDocument();
  });

  it('still clones an ordinary element with readable props (regression)', () => {
    const actions: FabSpeedDialAction[] = [
      { id: 'plain', icon: 'add', label: 'Taak erbij', render: <button type="button" /> },
    ];

    render(<FabSpeedDial label="Toevoegen" actions={actions} defaultOpen />);

    expect(screen.getByTestId('fab-action-plain')).toBeInTheDocument();
    expect(screen.getByText('Taak erbij')).toBeInTheDocument();
  });
});
