'use client';

import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';
import { openTaskComposer } from './use-task-composer';

/**
 * "Taak erbij" as a tile in the board's quick-action grid.
 *
 * It lives in this slice for the same reason `NewEventAction` lives in the
 * calendar's: the thing it opens is ours. `modules/today` may not import
 * `@/modules/tasks` from a client component — the barrel re-exports
 * `server-only` loaders, so pulling it into the browser graph fails the build —
 * and the deep import across a slice boundary is banned by
 * `eslint.config.mjs`. So the slice that owns the composer owns the button,
 * and the board takes it as a node.
 *
 * A principal without `task:write` renders nothing rather than a tile whose
 * field would refuse to submit. On the wall that is every principal
 * (`task:write` is `deny` for a device, §7).
 */
export type TaskComposerActionProps = {
  canWrite?: boolean;
  className?: string;
};

export function TaskComposerAction({ canWrite = true, className }: TaskComposerActionProps) {
  const t = useTranslations('today');

  if (!canWrite) return null;

  return (
    <Button
      variant="outline"
      data-testid="today-action-task"
      className={className}
      onClick={() => openTaskComposer()}
    >
      <Icon name="add_task" size="md" className="text-brand" />
      {t('tasks.add')}
    </Button>
  );
}
