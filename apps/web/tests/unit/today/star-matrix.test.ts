import { describe, expect, it } from 'vitest';
import { resolveStepIcon } from '@/modules/today/domain/star-matrix';

describe('resolveStepIcon', () => {
  it('keeps a step icon that the subset font actually carries', () => {
    expect(resolveStepIcon('brush', 'task_alt')).toBe('brush');
  });

  it('falls back for a null or unknown icon rather than rendering a blank', () => {
    expect(resolveStepIcon(null, 'wb_sunny')).toBe('wb_sunny');
    expect(resolveStepIcon('not_a_real_glyph', 'wb_sunny')).toBe('wb_sunny');
  });
});
