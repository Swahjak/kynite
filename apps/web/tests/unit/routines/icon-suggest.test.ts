import { describe, expect, it } from 'vitest';
import { suggestIcon } from '@/modules/routines/domain/icon-suggest';

/**
 * `suggestIcon` (M5 of the 2026-09-14 taken-board-routines-page plan) — the
 * nl+en keyword fallback for a routine, step or task with no `icon` set.
 */
describe('suggestIcon', () => {
  it('matches Dutch keywords', () => {
    expect(suggestIcon('Tanden poetsen')).toBe('dentistry');
    expect(suggestIcon('Aankleden')).toBe('checkroom');
    expect(suggestIcon('Ontbijt maken')).toBe('restaurant');
    expect(suggestIcon('Tas inpakken')).toBe('backpack');
    expect(suggestIcon('Boodschappen doen')).toBe('shopping_cart');
    expect(suggestIcon('Was ophangen')).toBe('local_laundry_service');
    expect(suggestIcon('Vuilnis buiten zetten')).toBe('delete');
    expect(suggestIcon('Fietsen naar oma')).toBe('pedal_bike');
    expect(suggestIcon('Hond uitlaten')).toBe('pets');
    expect(suggestIcon('Naar bed')).toBe('crib');
  });

  it('matches English keywords', () => {
    expect(suggestIcon('Brush teeth')).toBe('dentistry');
    expect(suggestIcon('Get dressed')).toBe('checkroom');
    expect(suggestIcon('Eat breakfast')).toBe('restaurant');
    expect(suggestIcon('Pack backpack')).toBe('backpack');
    expect(suggestIcon('Go shopping')).toBe('shopping_cart');
    expect(suggestIcon('Do the laundry')).toBe('local_laundry_service');
    expect(suggestIcon('Take out the trash')).toBe('delete');
    expect(suggestIcon('Ride the bike')).toBe('pedal_bike');
    expect(suggestIcon('Walk the dog')).toBe('pets');
    expect(suggestIcon('Read a book')).toBe('menu_book');
  });

  it('is case-insensitive', () => {
    expect(suggestIcon('TANDEN POETSEN')).toBe('dentistry');
  });

  it('falls back to the default icon when nothing matches', () => {
    expect(suggestIcon('Huiswerk maken')).toBe('task_alt');
    expect(suggestIcon('')).toBe('task_alt');
  });

  it('matches on word boundaries, not bare substrings', () => {
    expect(suggestIcon('Fantasie spelen')).not.toBe('backpack');
    expect(suggestIcon('Bingo avond')).not.toBe('delete');
    expect(suggestIcon('Tas inpakken')).toBe('backpack');
    expect(suggestIcon('Tanden poetsen')).toBe('dentistry');
  });
});
