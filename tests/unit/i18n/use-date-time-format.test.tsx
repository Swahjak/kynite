import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { FormattingLocaleProvider, useDateTimeFormat } from '@/components/formatting';

/**
 * `useDateTimeFormat()`'s whole reason to exist: the household's chosen
 * convention (`FormattingLocaleProvider`), not the UI locale next-intl's own
 * `useFormatter()` would resolve against — see the provider's doc comment for
 * why the two can't share a context.
 */

const instant = new Date('2026-08-14T17:05:00Z');

function Clock() {
  const formatDateTime = useDateTimeFormat();
  return (
    <span data-testid="clock">
      {formatDateTime(instant, { day: '2-digit', month: '2-digit', year: 'numeric' })}
    </span>
  );
}

function renderWithLocale(formattingLocale: 'nl-NL' | 'en-GB' | 'en-US') {
  return render(
    <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
      <FormattingLocaleProvider formattingLocale={formattingLocale}>
        <Clock />
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}

describe('useDateTimeFormat', () => {
  it('renders dd/mm/yyyy for en-GB even though the UI locale is bare en', () => {
    renderWithLocale('en-GB');
    expect(screen.getByTestId('clock')).toHaveTextContent('14/08/2026');
  });

  it('renders mm/dd/yyyy for en-US', () => {
    renderWithLocale('en-US');
    expect(screen.getByTestId('clock')).toHaveTextContent('08/14/2026');
  });

  it('renders dd-mm-yyyy for nl-NL', () => {
    renderWithLocale('nl-NL');
    expect(screen.getByTestId('clock')).toHaveTextContent('14-08-2026');
  });

  it('falls back to nl-NL with no provider in scope', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
        <Clock />
      </NextIntlClientProvider>
    );
    expect(screen.getByTestId('clock')).toHaveTextContent('14-08-2026');
  });
});
