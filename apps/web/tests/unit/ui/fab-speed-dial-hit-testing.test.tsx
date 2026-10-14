import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FAB_SLOT_ID, FabSpeedDial, type FabSpeedDialAction } from '@kynite/ui';

const actions: FabSpeedDialAction[] = [
  { id: 'one', icon: 'add', label: 'Taak erbij', render: <button type="button" /> },
];

/**
 * A closed speed dial keeps its action stack in layout (for the unfold
 * transition). That stack must not take pointer events: on a phone it sat
 * above the FAB and swallowed taps on whatever was underneath.
 *
 * jsdom has no layout/hit-testing, so this asserts the classes that produce it:
 * the dial root is `pointer-events-none` (only the trigger takes taps back) and
 * the action list only becomes hit-testable while open.
 */
describe('FabSpeedDial — hit-testing', () => {
  beforeEach(() => {
    const slot = document.createElement('div');
    slot.id = FAB_SLOT_ID;
    document.body.appendChild(slot);
  });

  it('closed: root and action list are not hit-testable, actions are inert', () => {
    render(<FabSpeedDial label="Toevoegen" actions={actions} />);

    const root = document.querySelector('[data-slot="fab-speed-dial"]')!;
    const list = document.querySelector('[data-slot="fab-speed-dial-actions"]')!;

    expect(root).toHaveClass('pointer-events-none');
    expect(list).not.toHaveClass('pointer-events-auto');
    expect(list).toHaveAttribute('inert');
    expect(screen.getByTestId('fab-action-one')).toHaveClass('pointer-events-none');
    expect(screen.getByRole('button', { name: 'Toevoegen' })).toHaveClass('pointer-events-auto');
  });

  it('open: the action list takes pointer events again', () => {
    render(<FabSpeedDial label="Toevoegen" actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toevoegen' }));

    const list = document.querySelector('[data-slot="fab-speed-dial-actions"]')!;
    expect(list).toHaveClass('pointer-events-auto');
    expect(list).not.toHaveAttribute('inert');
    expect(screen.getByTestId('fab-action-one')).not.toHaveClass('pointer-events-none');
  });
});
