import { describe, expect, it } from 'vitest';
import {
  columnProgress,
  daypartFromHour,
  partitionTasksByAssignee,
} from '@/modules/today/domain/routines-board';

describe('the daypart selected by default', () => {
  it('follows the wall clock in three bands: 00–12, 12–18, 18–24', () => {
    expect(daypartFromHour(0)).toBe('morning');
    expect(daypartFromHour(7)).toBe('morning');
    expect(daypartFromHour(11)).toBe('morning');
    expect(daypartFromHour(12)).toBe('afternoon');
    expect(daypartFromHour(17)).toBe('afternoon');
    expect(daypartFromHour(18)).toBe('evening');
    expect(daypartFromHour(23)).toBe('evening');
  });

  it('uses a different boundary than a routine’s own section', () => {
    // A routine due at 17:30 belongs to `sectionOf`'s "evening" band
    // (`modules/routines/domain/occurrence.ts`, boundary at 17:00), but the
    // clock reading 17:30 still defaults the tab to "afternoon" (boundary at
    // 18:00) — the two are deliberately different questions.
    expect(daypartFromHour(17)).toBe('afternoon');
  });
});

describe('a column’s progress', () => {
  it('counts done against total and rounds the percentage', () => {
    expect(columnProgress([{ done: true }, { done: true }, { done: false }])).toEqual({
      doneCount: 2,
      total: 3,
      percent: 67,
      celebrate: false,
    });
  });

  it('celebrates only once everything shown is done', () => {
    expect(columnProgress([{ done: true }, { done: true }])).toEqual({
      doneCount: 2,
      total: 2,
      percent: 100,
      celebrate: true,
    });
  });

  it('does not celebrate an empty column — 100% of nothing is not a finish', () => {
    expect(columnProgress([])).toEqual({ doneCount: 0, total: 0, percent: 0, celebrate: false });
  });
});

describe('splitting tasks into the pool and per-member buckets', () => {
  it('routes an unassigned task to the pool and an assigned one to its owner', () => {
    const tasks = [
      { id: 'a', assigneeMemberId: null },
      { id: 'b', assigneeMemberId: 'fien' },
      { id: 'c', assigneeMemberId: 'fien' },
      { id: 'd', assigneeMemberId: 'joep' },
    ];

    const { pool, byMember } = partitionTasksByAssignee(tasks);

    expect(pool.map((task) => task.id)).toEqual(['a']);
    expect(byMember.get('fien')?.map((task) => task.id)).toEqual(['b', 'c']);
    expect(byMember.get('joep')?.map((task) => task.id)).toEqual(['d']);
  });

  it('is empty on both sides for an empty list', () => {
    const { pool, byMember } = partitionTasksByAssignee([]);
    expect(pool).toEqual([]);
    expect(byMember.size).toBe(0);
  });
});
