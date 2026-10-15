import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { FormattingLocaleProvider } from '@/components/formatting';
import { AmbientClock } from '@/components/hub';

/** The hub clock reads in the family's zone, whatever zone the process runs in. */
const instant = new Date('2026-03-11T07:45:00Z');

function renderClock(timeZone: string) {
  return render(
    <NextIntlClientProvider locale="nl" messages={{}} timeZone={timeZone}>
      <FormattingLocaleProvider formattingLocale="nl-NL">
        <AmbientClock now={instant} />
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}

describe('AmbientClock', () => {
  it('renders family-local time (Europe/Amsterdam 07:45Z -> 08:45)', () => {
    renderClock('Europe/Amsterdam');
    expect(screen.getByRole('time')).toHaveTextContent('08:45');
  });

  it('follows the family zone, not the process zone', () => {
    renderClock('America/New_York');
    expect(screen.getByRole('time')).toHaveTextContent('03:45');
  });
});
