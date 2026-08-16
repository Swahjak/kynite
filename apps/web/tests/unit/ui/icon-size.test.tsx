import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_SIZES } from '@kynite/ui';

/**
 * The `Icon` size ramp is a public API of the design system, so its steps are
 * asserted rather than assumed.
 *
 * `xs+` is the 16px step: the design sheets ask for a 16px glyph in 44 places
 * (the Dagoverzicht disclosure chevron among them,
 * `docs/design/claude-design/Vandaag.dc.html`:378), which the ramp had no way
 * to express — the app rounded up to `sm` (18) and Storybook rounded down to
 * `xs` (14) for the same glyph. It is named `xs+` and not `2xs` because
 * `Avatar`/`MemberFace` already use `2xs` for a step *below* `xs`; 16 sits
 * *above* `xs` (14) here, so the two ramps would have contradicted each other.
 */

describe('Icon size ramp', () => {
  it('renders the 16px xs+ step at 16px square', () => {
    render(<Icon name="expand_more" size="xs+" label="chevron" />);

    const icon = screen.getByRole('img', { name: 'chevron' });

    expect(icon.style.fontSize).toBe('16px');
    expect(icon.style.width).toBe('16px');
    expect(icon.style.height).toBe('16px');
  });

  it('keeps every pre-existing step at its current pixel value', () => {
    expect(ICON_SIZES).toMatchObject({
      xs: 14,
      'xs+': 16,
      sm: 18,
      md: 24,
      lg: 28,
      xl: 32,
      '2xl': 40,
    });
  });
});
