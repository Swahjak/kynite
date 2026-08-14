'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { MemberFace } from '@/components/kynite';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { createTaskAction, toggleTaskAction } from '../actions';
import type { TodayTask } from '../page-data';

/**
 * The Takenlijst on `/today` — the household's open list, and the one control
 * that adds to it.
 *
 * This is deliberately the *lightest* writing surface in the product. A task
 * was briefly modelled as a one-off routine, and authoring one meant a dialog
 * with steps, a star reward, a grace window and a mandatory date. The feedback
 * was exact: that is too heavy an interface for "hond uitlaten", and not every
 * task has a day at all. So adding one here is a text field and, if you want
 * it, a person — nothing else, inline on the card, one Enter away.
 *
 * **A ticked task does not disappear.** It stays where it is, struck through,
 * until the day rolls over (`listTodayTasks` keeps everything completed since
 * local midnight). A row that vanishes under the finger that tapped it takes
 * its own undo with it and reads as a deletion rather than an achievement — the
 * same rule the routine board follows for a finished one-off.
 *
 * The tick is optimistic and the transition's `pending` is deliberately not
 * rendered: the write is a single boolean and the person has already seen the
 * result. `useOptimistic` carries the flip through the `router.refresh()` that
 * follows, and the server's own render then takes over.
 */

/** The picker's value for "nobody in particular" — `<Select>` has no null. */
const UNASSIGNED = 'none';

export type TaskListProps = {
  tasks: TodayTask[];
  /** The roster the assignee picker offers — names only; it is a picker. */
  members: { id: string; displayName: string }[];
  /** Gates authoring: the quick-add form and (once it exists) delete. */
  canWrite: boolean;
  /**
   * Gates the tick itself (`task:complete`). Deliberately separate from
   * `canWrite`: a child or a paired hub device may finish a task without
   * ever being allowed to invent or remove one.
   */
  canComplete: boolean;
  /** The heading and the accessible name of the list. */
  title: string;
  /** `MEMBER_COLOR_CLASSES[color].surface` per member id, resolved server-side. */
  memberSurface: Record<string, string>;
};

export function TaskList({
  tasks,
  members,
  canWrite,
  canComplete,
  title,
  memberSurface,
}: TaskListProps) {
  const t = useTranslations('today');
  const router = useRouter();

  const [optimistic, setOptimistic] = useOptimistic<
    ReadonlyMap<string, boolean>,
    { id: string; done: boolean }
  >(new Map<string, boolean>(), (previous, next) => new Map(previous).set(next.id, next.done));
  const [, startTransition] = useTransition();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [assignee, setAssignee] = useState<string>(UNASSIGNED);

  const toggle = (taskItem: TodayTask, done: boolean) => {
    startTransition(async () => {
      setOptimistic({ id: taskItem.id, done });
      await toggleTaskAction({ taskId: taskItem.id, completed: done });
      router.refresh();
    });
  };

  const submit = () => {
    const title_ = draft.trim();
    if (title_.length === 0) return;

    setDraft('');
    startTransition(async () => {
      await createTaskAction({
        title: title_,
        assigneeMemberId: assignee === UNASSIGNED ? null : assignee,
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card data-testid="today-tasklist" className="gap-3 p-5">
        <h3 className="text-overline text-ink-muted uppercase">{title}</h3>

        {tasks.length === 0 && !adding ? (
          <p className="py-2 text-body-sm text-ink-secondary">{t('tasks.empty')}</p>
        ) : (
          <ul className="flex flex-col">
            {tasks.map((item, index) => {
              const done = optimistic.get(item.id) ?? item.done;
              const surface = item.assignee ? memberSurface[item.assignee.memberId] : undefined;

              return (
                <li
                  key={item.id}
                  data-testid="today-task"
                  data-state={done ? 'done' : 'open'}
                  className={cn(
                    'flex items-center gap-2.5 py-2',
                    index < tasks.length - 1 && 'border-b border-line-subtle'
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={done}
                    aria-label={t(done ? 'tasks.undo' : 'tasks.complete', { title: item.title })}
                    disabled={!canComplete}
                    onClick={() => toggle(item, !done)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none"
                  >
                    <Icon
                      name={done ? 'check_circle' : 'radio_button_unchecked'}
                      filled={done}
                      size="md"
                      className={done ? 'text-success' : 'text-line'}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-body-sm',
                        done && 'text-ink-muted line-through decoration-line'
                      )}
                    >
                      {item.title}
                    </span>
                    {/* A date only when it is *news*: an overdue task is the one
                        case where the day it was for changes what the row
                        means. Everything else on this list is today's or
                        undated, and stamping those would be noise. */}
                    {item.overdue && !done ? (
                      <span className="shrink-0 rounded-4xl bg-destructive/10 px-2 py-0.5 text-caption text-destructive">
                        {t('tasks.overdue')}
                      </span>
                    ) : null}
                  </button>

                  {item.assignee ? (
                    <MemberFace
                      name={item.assignee.displayName}
                      avatarUrl={item.assignee.avatarUrl}
                      surfaceClass={surface}
                      size="xs"
                    />
                  ) : (
                    // Not an empty gap: an unassigned task is a *state* of the
                    // list ("nobody has picked this up"), and a hole where every
                    // other row has a face reads as a rendering fault.
                    <span
                      aria-label={t('tasks.unassigned')}
                      role="img"
                      className="flex size-6 shrink-0 items-center justify-center rounded-4xl bg-surface-container text-ink-muted"
                    >
                      <Icon name="person" size="xs" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {adding && canWrite ? (
          <form
            data-testid="today-task-add"
            className="flex flex-wrap items-center gap-2 pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('tasks.placeholder')}
              aria-label={t('tasks.placeholder')}
              className="min-w-40 flex-1"
            />
            <Select value={assignee} onValueChange={(value) => setAssignee(String(value))}>
              <SelectTrigger aria-label={t('tasks.assignee')} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t('tasks.unassigned')}</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={draft.trim().length === 0}>
              {t('tasks.save')}
            </Button>
          </form>
        ) : null}
      </Card>

      {/* The mockup's two quick actions. Both are white pills with brand text:
          one leaves the page, one opens the field above. */}
      <div className="flex flex-wrap gap-2.5">
        <Button
          variant="outline"
          className="flex-1 rounded-4xl border-primary/20 font-display font-bold text-primary"
          nativeButton={false}
          render={<Link href="/timers" />}
        >
          <Icon name="timer" size="sm" inline="start" />
          {t('tasks.startTimer')}
        </Button>

        <Button
          variant="outline"
          data-testid="today-task-add-toggle"
          disabled={!canWrite}
          onClick={() => setAdding((previous) => !previous)}
          className="flex-1 rounded-4xl border-primary/20 font-display font-bold text-primary"
        >
          <Icon name="add_task" size="sm" inline="start" />
          {t('tasks.add')}
        </Button>
      </div>
    </div>
  );
}
