import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Icon } from './icon';

describe('Icon', () => {
  it('renders the ligature name as its text content', () => {
    const { container } = render(<Icon name="calendar_month" />);
    const icon = container.querySelector('[data-slot="icon"]');

    expect(icon).toHaveTextContent('calendar_month');
    expect(icon).toHaveClass('material-symbols-outlined');
  });

  it('is hidden from assistive tech when decorative', () => {
    const { container } = render(<Icon name="add" />);

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
