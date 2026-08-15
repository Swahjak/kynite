import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, Icon, ICON_CODEPOINTS } from '@kynite/ui';

describe('Icon', () => {
  it('renders the glyph codepoint, not the icon name', () => {
    const { container } = render(<Icon name="calendar_month" />);
    const icon = container.querySelector('[data-slot="icon"]');

    // The ligature form cannot survive subsetting (scripts/subset-icons.mjs),
    // so the element's text is the PUA character the subset font carries.
    expect(icon?.textContent).toBe(ICON_CODEPOINTS.calendar_month);
    expect(icon?.textContent).not.toBe('calendar_month');
    expect(icon).toHaveClass('material-symbols-outlined');
  });

  it('maps every icon to a private-use codepoint', () => {
    for (const [name, glyph] of Object.entries(ICON_CODEPOINTS)) {
      const codepoint = glyph.codePointAt(0)!;
      // Material Symbols lives in the BMP private-use area.
      expect(codepoint, `${name} is outside the private-use area`).toBeGreaterThanOrEqual(0xe000);
      expect(codepoint, `${name} is outside the private-use area`).toBeLessThanOrEqual(0xf8ff);
    }
  });

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<Icon name="add" />);

    // Also why the codepoint must not leak to a screen reader: a decorative
    // icon announcing a private-use character is worse than announcing nothing.
    expect(container.querySelector('[data-slot="icon"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('exposes an accessible name when labelled', () => {
    render(<Icon name="star" label="Ster verdiend" />);

    const icon = screen.getByRole('img', { name: 'Ster verdiend' });
    expect(icon).not.toHaveAttribute('aria-hidden');
  });

  it('applies the filled variation only when asked', () => {
    const { container, rerender } = render(<Icon name="star" />);
    expect(container.querySelector('[data-slot="icon"]')).not.toHaveClass('icon-filled');

    rerender(<Icon name="star" filled />);
    expect(container.querySelector('[data-slot="icon"]')).toHaveClass('icon-filled');
  });

  it('sizes from the brand icon scale', () => {
    const { container } = render(<Icon name="timer" size="2xl" />);

    expect(container.querySelector('[data-slot="icon"]')).toHaveStyle({ fontSize: '40px' });
  });

  it('carries the ligature name on data-icon-name, leaving data-icon for layout', () => {
    const { container } = render(<Icon name="calendar_month" />);
    const icon = container.querySelector('[data-slot="icon"]');

    expect(icon).toHaveAttribute('data-icon-name', 'calendar_month');
    // Not `data-icon`: Button/Badge/TabsTrigger match that attribute to decide
    // icon-side padding, so a name sitting there would never match and the
    // padding rules would silently never fire.
    expect(icon).not.toHaveAttribute('data-icon');
  });

  it('signals its side so a primitive can tighten the padding', () => {
    const { container, rerender } = render(<Icon name="add" inline="start" />);
    expect(container.querySelector('[data-slot="icon"]')).toHaveAttribute(
      'data-icon',
      'inline-start'
    );

    rerender(<Icon name="add" inline="end" />);
    expect(container.querySelector('[data-slot="icon"]')).toHaveAttribute(
      'data-icon',
      'inline-end'
    );
  });

  it('works inside a Button, where the padding selectors live', () => {
    render(
      <Button>
        <Icon name="add" inline="start" />
        Nieuw
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Nieuw' });
    // The `has-data-[icon=inline-start]` selector can only match a descendant
    // carrying that exact value — this is the wiring M02 deferred.
    expect(button.querySelector('[data-icon="inline-start"]')).not.toBeNull();
    expect(button.className).toContain('has-data-[icon=inline-start]');
  });
});

describe('Button', () => {
  it('renders the hub size with the 48px target classes', () => {
    render(<Button size="hub">Ik ben klaar</Button>);

    const button = screen.getByRole('button', { name: 'Ik ben klaar' });
    expect(button).toHaveAttribute('data-size', 'hub');
    expect(button.className).toContain('h-12');
    expect(button.className).toContain('min-w-12');
  });

  it('keeps the brand press convention on every variant', () => {
    render(<Button variant="gold">Beloning</Button>);

    expect(screen.getByRole('button', { name: 'Beloning' }).className).toContain('active:scale-95');
  });
});
