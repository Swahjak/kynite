'use client';

import { cn, Icon } from '@kynite/ui';
import { useTodayFilter } from './today-filter-context';

export function TodayPastToggle({ summary, label }: { summary: string; label: string }) {
  const filter = useTodayFilter();

  if (!filter) {
    return null;
  }

  const { pastOpen, setPastOpen } = filter;

  return (
    <button
      type="button"
      data-testid="today-past-toggle"
      aria-expanded={pastOpen}
      aria-label={label}
      onClick={() => setPastOpen((previous) => !previous)}
      className="flex min-w-0 items-center gap-1.5 rounded-lg text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Icon
        name="expand_more"
        size="xs+"
        className={cn('shrink-0 transition-transform', pastOpen && 'rotate-180')}
      />
      <span className="truncate text-caption">{summary}</span>
    </button>
  );
}
