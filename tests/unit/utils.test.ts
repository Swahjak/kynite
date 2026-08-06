import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    const enabled = false;
    expect(cn('a', enabled && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind utilities, last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-green-500')).toBe('text-green-500');
  });

  it('supports conditional object and array syntax', () => {
    expect(cn(['a', { b: true, c: false }])).toBe('a b');
  });
});
