import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

describe('Select', () => {
  it('shows the selected item label in the closed trigger, not the raw value', () => {
    render(
      <Select name="visibility" defaultValue="private">
        <SelectTrigger data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="family">Family</SelectItem>
          <SelectItem value="private">Private calendar</SelectItem>
        </SelectContent>
      </Select>
    );

    // Base UI's Select.Value falls back to serializeValue(value) — the raw
    // enum — unless it can resolve a label. Asserting the rendered label
    // (and not the enum) is the regression this test guards.
    expect(screen.getByTestId('trigger')).toHaveTextContent('Private calendar');
    expect(screen.getByTestId('trigger')).not.toHaveTextContent('private');
  });

  it('resolves the label for an empty-string sentinel value', () => {
    render(
      <Select name="ownerMemberId" defaultValue="">
        <SelectTrigger data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Everyone</SelectItem>
          <SelectItem value="member-1">Mila</SelectItem>
        </SelectContent>
      </Select>
    );

    // An empty string is falsy, so a naive `value || placeholder` fallback
    // would render nothing here — this is exactly the sentinel pattern used
    // by event-dialog.tsx's owner/calendar selects.
    expect(screen.getByTestId('trigger')).toHaveTextContent('Everyone');
  });

  it('derives labels from items rendered through .map(), not just literal JSX', () => {
    const options = [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
    ];

    render(
      <Select defaultValue="week">
        <SelectTrigger data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

    expect(screen.getByTestId('trigger')).toHaveTextContent('Week');
  });

  it('flattens non-string item children to their text content', () => {
    render(
      <Select defaultValue="starred">
        <SelectTrigger data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="starred">
            <span>Starred</span>
          </SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByTestId('trigger')).toHaveTextContent('Starred');
  });
});
