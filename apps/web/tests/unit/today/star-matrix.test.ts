import { describe, expect, it } from 'vitest';
import {
  resolveStepIcon,
  starMatrixRows,
  type StarMatrixStep,
} from '@/modules/today/domain/star-matrix';

/**
 * The star matrix has to build its rows by *inference*, because the data model
 * gives it nothing to join on: a routine belongs to one child, so two children
 * brushing their teeth own two unrelated step rows. These tests pin the three
 * consequences that a reader of the grid would notice if they broke — a shared
 * title sharing a row, a unique title leaving a hole, and a title that repeats
 * for one child opening a second row rather than swallowing itself.
 */

let counter = 0;

function step(title: string, overrides: Partial<StarMatrixStep> = {}): StarMatrixStep {
  counter += 1;

  return {
    routineId: `routine-${counter}`,
    stepId: `step-${counter}`,
    title,
    icon: 'task_alt',
    occurrenceDate: '2026-08-14',
    done: false,
    clientId: `client-${counter}`,
    ...overrides,
  };
}

describe('starMatrixRows', () => {
  it('puts two children with the same step title on one row', () => {
    const mila = step('Tanden poetsen');
    const daan = step('Tanden poetsen');

    const rows = starMatrixRows([
      { memberId: 'mila', steps: [mila] },
      { memberId: 'daan', steps: [daan] },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].cells.get('mila')).toBe(mila);
    expect(rows[0].cells.get('daan')).toBe(daan);
  });

  it('matches titles case- and whitespace-insensitively', () => {
    const rows = starMatrixRows([
      { memberId: 'mila', steps: [step('Tanden poetsen')] },
      { memberId: 'daan', steps: [step('  tanden Poetsen ')] },
    ]);

    expect(rows).toHaveLength(1);
    // The first child's spelling is the one the row shows.
    expect(rows[0].title).toBe('Tanden poetsen');
  });

  it('keeps steps with different icons apart', () => {
    const rows = starMatrixRows([
      { memberId: 'mila', steps: [step('Opruimen', { icon: 'wb_sunny' })] },
      { memberId: 'daan', steps: [step('Opruimen', { icon: 'dark_mode' })] },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].cells.has('daan')).toBe(false);
    expect(rows[1].cells.has('mila')).toBe(false);
  });

  it('leaves a hole rather than a row per child when a step is not shared', () => {
    const rows = starMatrixRows([
      { memberId: 'mila', steps: [step('Aankleden'), step('Tas inpakken')] },
      { memberId: 'daan', steps: [step('Aankleden')] },
    ]);

    expect(rows.map((row) => row.title)).toEqual(['Aankleden', 'Tas inpakken']);
    expect(rows[1].cells.has('daan')).toBe(false);
  });

  it('opens a second row when one child repeats a title', () => {
    const morning = step('Tanden poetsen');
    const evening = step('Tanden poetsen');

    const rows = starMatrixRows([{ memberId: 'mila', steps: [morning, evening] }]);

    expect(rows).toHaveLength(2);
    expect(rows[0].cells.get('mila')).toBe(morning);
    expect(rows[1].cells.get('mila')).toBe(evening);
    expect(rows[0].key).not.toBe(rows[1].key);
  });

  it('orders rows by first appearance, following each child in board order', () => {
    const rows = starMatrixRows([
      { memberId: 'mila', steps: [step('Wakker worden'), step('Ontbijt')] },
      { memberId: 'daan', steps: [step('Ontbijt'), step('Tas inpakken')] },
    ]);

    expect(rows.map((row) => row.title)).toEqual(['Wakker worden', 'Ontbijt', 'Tas inpakken']);
  });

  it('has no rows for a family whose children have nothing due', () => {
    expect(starMatrixRows([{ memberId: 'mila', steps: [] }])).toEqual([]);
  });
});

describe('resolveStepIcon', () => {
  it('keeps a step icon that the subset font actually carries', () => {
    expect(resolveStepIcon('brush', 'task_alt')).toBe('brush');
  });

  it('falls back for a null or unknown icon rather than rendering a blank', () => {
    expect(resolveStepIcon(null, 'wb_sunny')).toBe('wb_sunny');
    expect(resolveStepIcon('not_a_real_glyph', 'wb_sunny')).toBe('wb_sunny');
  });
});
