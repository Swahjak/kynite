/**
 * Public surface of the tasks slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * A task is the *light* half of "things this family has to get done": a title,
 * optionally a person, optionally a day. Routines own the heavy half — repeat
 * rules, steps, stars, grace — and neither slice knows about the other.
 *
 * Like the other slice barrels this re-exports the slice's client component
 * alongside `server-only` reads: fine for a route file, fatal for another
 * slice's server module. Anything that needs only the table takes it from
 * `@/server/db/schema`.
 */

export { task, type Task } from './schema';

export { getTask, listTodayTasks } from './queries';

export { actionFailure, idleState, type ActionState } from './action-state';

export {
  createTaskAction,
  deleteTaskAction,
  toggleTaskAction,
  type CreateTaskInput,
  type DeleteTaskInput,
  type ToggleTaskInput,
} from './actions';

export { loadTodayTasks, type TodayTask, type TodayTasksData } from './page-data';

export { TaskList, type TaskListProps } from './ui/task-list';
export { openTaskComposer, useTaskComposer } from './ui/use-task-composer';
export {
  TaskComposerFabAction,
  type TaskComposerFabActionProps,
} from './ui/task-composer-fab-action';
