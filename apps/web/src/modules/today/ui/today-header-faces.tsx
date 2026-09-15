'use client';

import { Badge, Button, cn, FaceStack, MemberFace } from '@kynite/ui';
import { useTodayFilter } from '@/components/hub/today-filter-context';
import type { TimelineFace } from './today-timeline-filter';

export function TodayHeaderFaces({
  faces,
  everyoneLabel,
  familyLabel,
}: {
  faces: TimelineFace[];
  everyoneLabel: string;
  familyLabel: string;
}) {
  const filter = useTodayFilter();

  if (!filter) {
    return (
      <FaceStack faces={faces} size="default" label={familyLabel} className="space-x-0 gap-1.5" />
    );
  }

  const { selected, setSelected } = filter;

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        size="lg"
        className={cn(
          'cursor-pointer bg-card',
          selected === null ? 'border-ink font-bold text-ink' : 'text-ink-secondary'
        )}
        data-state={selected === null ? 'on' : 'off'}
        render={<button type="button" onClick={() => setSelected(null)} />}
      >
        {everyoneLabel}
      </Badge>

      {faces.map((face) => {
        const active = selected === face.id;
        return (
          <Button
            key={face.id}
            variant="ghost"
            size="icon-lg"
            aria-pressed={active}
            data-testid="today-timeline-filter-face"
            className={cn(
              'rounded-full p-0 transition-opacity',
              // 80% is the axe AA floor against the member baan tints; the
              // mockup's 45% fails contrast.
              active ? 'opacity-100 ring-2 ring-primary' : 'opacity-80 hover:opacity-90'
            )}
            onClick={() => setSelected(active ? null : face.id)}
          >
            <MemberFace
              name={face.name}
              avatarUrl={face.avatarUrl}
              surfaceClass={face.surfaceClass}
              size="default"
            />
          </Button>
        );
      })}
    </div>
  );
}
