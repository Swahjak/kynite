import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { FormattingLocaleProvider } from '@/components/formatting';
import type { FormattingLocale } from '@/i18n/formatting-locale';
import messages from '../../../messages/nl.json';
import { DateField } from './date-field';
import { DateTimeField } from './date-time-field';
import { Field, FieldLabel } from './field';
import { TimeField } from './time-field';

/**
 * The contract these fields have to keep while replacing the native inputs:
 * what a parent *reads* follows the household's convention, and what the form
 * *submits* is the same ISO/24-hour value the Server Actions always got.
 */

function renderIn(locale: FormattingLocale, children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="nl" messages={messages} timeZone="Europe/Amsterdam">
      <FormattingLocaleProvider formattingLocale={locale}>
        <form data-testid="form">{children}</form>
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}

function submitted(name: string): string {
  const form = screen.getByTestId('form') as HTMLFormElement;
  return String(new FormData(form).get(name) ?? '');
}

describe('DateField', () => {
  it('shows the stored ISO value in the household’s convention', () => {
    renderIn('en-US', <DateField name="birthDate" defaultValue="2026-08-21" aria-label="d" />);
    expect(screen.getByLabelText('d')).toHaveValue('08/21/2026');
    expect(submitted('birthDate')).toBe('2026-08-21');
  });

  it('submits ISO whatever the parent typed, and normalises the text on blur', async () => {
    const user = userEvent.setup();
    renderIn('nl-NL', <DateField name="birthDate" aria-label="d" />);
    const input = screen.getByLabelText('d');

    await user.type(input, '1-8-82');
    expect(submitted('birthDate')).toBe('1982-08-01');

    await user.tab();
    expect(input).toHaveValue('01-08-1982');
  });

  it('keeps unreadable text in an error state and submits nothing', async () => {
    const user = userEvent.setup();
    renderIn('nl-NL', <DateField name="birthDate" defaultValue="2026-08-21" aria-label="d" />);
    const input = screen.getByLabelText('d');

    await user.clear(input);
    await user.type(input, '31-02-2026');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(submitted('birthDate')).toBe('');
    expect((input as HTMLInputElement).validity.customError).toBe(true);
  });

  it('flags a value outside its min bound rather than accepting it silently', async () => {
    const user = userEvent.setup();
    renderIn('nl-NL', <DateField name="onceDate" min="2026-08-01" aria-label="d" />);
    const input = screen.getByLabelText('d');

    await user.type(input, '21-07-2026');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect((input as HTMLInputElement).validity.customError).toBe(true);

    await user.clear(input);
    await user.type(input, '21-08-2026');
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});

describe('Field labelling', () => {
  it('is named by its `FieldLabel`, the way the native input it replaced was', () => {
    renderIn(
      'nl-NL',
      <Field>
        <FieldLabel>Geboortedatum</FieldLabel>
        <DateField name="birthDate" defaultValue="1982-03-14" />
      </Field>
    );

    // Base UI binds the label to the control registered inside `Field.Root`;
    // the hidden ISO input must not be the one it finds.
    expect(screen.getByLabelText('Geboortedatum')).toHaveValue('14-03-1982');
  });
});

describe('TimeField', () => {
  it('reads 24-hour in nl-NL and 12-hour in en-US from the same wire value', () => {
    const { unmount } = renderIn(
      'nl-NL',
      <TimeField name="timeOfDay" defaultValue="14:30" aria-label="t" />
    );
    expect(screen.getByLabelText('t')).toHaveValue('14:30');
    expect(submitted('timeOfDay')).toBe('14:30');
    unmount();

    renderIn('en-US', <TimeField name="timeOfDay" defaultValue="14:30" aria-label="t" />);
    expect(screen.getByLabelText('t')).toHaveValue('2:30 PM');
    expect(submitted('timeOfDay')).toBe('14:30');
  });

  it('submits 24-hour time from a 12-hour household’s typing', async () => {
    const user = userEvent.setup();
    renderIn('en-US', <TimeField name="timeOfDay" aria-label="t" />);
    const input = screen.getByLabelText('t');

    await user.type(input, '230pm');
    expect(submitted('timeOfDay')).toBe('14:30');

    await user.tab();
    expect(input).toHaveValue('2:30 PM');
  });

  it('accepts lenient digits and normalises them', async () => {
    const user = userEvent.setup();
    renderIn('nl-NL', <TimeField name="timeOfDay" aria-label="t" />);
    const input = screen.getByLabelText('t');

    await user.type(input, '930');
    await user.tab();
    expect(input).toHaveValue('09:30');
    expect(submitted('timeOfDay')).toBe('09:30');
  });
});

describe('DateTimeField', () => {
  it('submits one datetime-local value from its two halves', async () => {
    const user = userEvent.setup();
    renderIn(
      'nl-NL',
      <DateTimeField
        name="startsAt"
        defaultValue="2026-08-21T14:30"
        dateLabel="Datum"
        timeLabel="Tijd"
      />
    );

    expect(screen.getByLabelText('Datum')).toHaveValue('21-08-2026');
    expect(screen.getByLabelText('Tijd')).toHaveValue('14:30');
    expect(submitted('startsAt')).toBe('2026-08-21T14:30');

    await user.clear(screen.getByLabelText('Tijd'));
    await user.type(screen.getByLabelText('Tijd'), '1600');
    expect(submitted('startsAt')).toBe('2026-08-21T16:00');
  });

  it('submits nothing while one half is empty', async () => {
    const user = userEvent.setup();
    renderIn('nl-NL', <DateTimeField name="startsAt" dateLabel="Datum" timeLabel="Tijd" />);

    await user.type(screen.getByLabelText('Datum'), '21-08-2026');
    expect(submitted('startsAt')).toBe('');

    await user.type(screen.getByLabelText('Tijd'), '09:00');
    expect(submitted('startsAt')).toBe('2026-08-21T09:00');
  });
});
