import { describe, expect, it } from 'vitest';
import {
  completionRatio,
  moveStep,
  orderSteps,
  withSortOrder,
} from '@/modules/routines/domain/steps';
import { hasGraduated, starsFor } from '@/modules/routines/domain/stars';
import {
  PRAISE_KEYS,
  ROUTINE_DONE_KEYS,
  completionSeed,
  praiseKeyFor,
  routineDoneKeyFor,
} from '@/modules/routines/domain/praise';

const steps = [
  { id: 'c', sortOrder: 2, title: 'Pack bag' },
  { id: 'a', sortOrder: 0, title: 'Make bed' },
  { id: 'b', sortOrder: 1, title: 'Brush teeth' },
];

describe('step ordering', () => {
  it('orders by sortOrder', () => {
    expect(orderSteps(steps).map((step) => step.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties deterministically, so a reload never reshuffles a sequence', () => {
    const tied = [
      { id: 'z', sortOrder: 0 },
      { id: 'y', sortOrder: 0 },
    ];
    expect(orderSteps(tied).map((step) => step.id)).toEqual(['y', 'z']);
    expect(orderSteps([...tied].reverse()).map((step) => step.id)).toEqual(['y', 'z']);
  });

  it('does not mutate its input', () => {
    const original = [...steps];
    orderSteps(steps);
    expect(steps).toEqual(original);
  });

  it('renumbers densely from zero', () => {
    expect(withSortOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ]);
  });
});

describe('moving a step', () => {
  it('moves one place up and renumbers', () => {
    const moved = moveStep(steps, 'c', 'up');
    expect(moved.map((step) => [step.id, step.sortOrder])).toEqual([
      ['a', 0],
      ['c', 1],
      ['b', 2],
    ]);
  });

  it('moves one place down', () => {
    expect(moveStep(steps, 'a', 'down').map((step) => step.id)).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op off either end', () => {
    expect(moveStep(steps, 'a', 'up').map((step) => step.id)).toEqual(['a', 'b', 'c']);
    expect(moveStep(steps, 'c', 'down').map((step) => step.id)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op for a step that is not there', () => {
    expect(moveStep(steps, 'missing', 'up').map((step) => step.id)).toEqual(['a', 'b', 'c']);
  });

  it('survives repeated moves without gaps building up', () => {
    let current = orderSteps(steps);
    for (let round = 0; round < 5; round += 1) {
      current = moveStep(current, 'a', 'down');
      current = moveStep(current, 'a', 'up');
    }
    expect(current.map((step) => step.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe('progress', () => {
  it('is a bounded fraction', () => {
    expect(completionRatio(4, 1)).toBe(0.25);
    expect(completionRatio(0, 0)).toBe(0);
    expect(completionRatio(2, 5)).toBe(1);
  });
});

describe('stars for a completion', () => {
  const live = { starsPerCompletion: 2, rewardEnabled: true, fadedAt: null };

  it('pays what the routine says', () => {
    expect(starsFor(live)).toBe(2);
  });

  it('pays nothing once the routine has faded — and takes nothing away', () => {
    expect(starsFor({ ...live, rewardEnabled: false })).toBe(0);
    expect(starsFor({ ...live, fadedAt: new Date() })).toBe(0);
    expect(hasGraduated({ ...live, rewardEnabled: false })).toBe(true);
    expect(hasGraduated(live)).toBe(false);
  });

  it('never returns a negative amount, whatever the column says', () => {
    expect(starsFor({ ...live, starsPerCompletion: -5 })).toBe(0);
    expect(starsFor({ ...live, starsPerCompletion: Number.NaN })).toBe(0);
  });
});

describe('praise selection', () => {
  const seed = completionSeed({
    memberId: 'member-1',
    routineStepId: 'step-1',
    occurrenceDate: '2026-03-11',
  });

  it('is deterministic — the same completion always shows the same words', () => {
    expect(praiseKeyFor(seed)).toBe(praiseKeyFor(seed));
    expect(routineDoneKeyFor(seed)).toBe(routineDoneKeyFor(seed));
  });

  it('only ever returns a key the translations define', () => {
    expect(PRAISE_KEYS).toContain(praiseKeyFor(seed));
    expect(ROUTINE_DONE_KEYS).toContain(routineDoneKeyFor(seed));
  });

  it('spreads across the whole set rather than collapsing onto one line', () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, index) =>
        praiseKeyFor(
          completionSeed({
            memberId: 'member-1',
            routineStepId: `step-${index}`,
            occurrenceDate: '2026-03-11',
          })
        )
      )
    );
    expect(seen.size).toBe(PRAISE_KEYS.length);
  });

  it('gives different steps of the same routine different lines', () => {
    const first = completionSeed({
      memberId: 'm',
      routineStepId: 'step-a',
      occurrenceDate: '2026-03-11',
    });
    const second = completionSeed({
      memberId: 'm',
      routineStepId: 'step-b',
      occurrenceDate: '2026-03-11',
    });
    expect(first).not.toBe(second);
  });
});
