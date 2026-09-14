import 'server-only';
import { z } from 'zod';
import { MCP_ROUTINES_READ, MCP_ROUTINES_WRITE, hasAllScopes } from '@/server/mcp-auth';
import { can, type Principal } from '@/modules/family';
import {
  MAX_GRACE_DAYS,
  ROUTINE_ICONS,
  SCHEDULE_KINDS,
  WEEKDAYS,
  completeStep,
  createRoutine,
  deleteRoutine,
  getRoutine,
  listRoutines,
  listSteps,
  setRoutineActive,
  setRoutineReward,
  undoCompletion,
  updateRoutine,
  type CompleteStepInput,
  type Routine,
  type RoutineInput,
  type RoutineStep,
  type RoutineWriteResult,
} from '@/modules/routines';
import { ok, toolError, type McpToolServer } from './shared';

/**
 * The routines domain's MCP tools (MCP-parity M1) — the whole of what the
 * parent's routine management screen can do, plus the child's single tap.
 *
 * Every write goes through `modules/routines/write.ts`, never through a Server
 * Action: the seams take an explicit `Principal` and re-check `can()`
 * themselves, so a bearer token reaches exactly the authorization a session
 * cookie does. The `can()` calls below are the *tool* layer's own check — they
 * turn a refusal into a readable MCP error instead of the seam's bare
 * `forbidden`, and they are deliberately redundant with the seam's, which is
 * what keeps a future caller that forgets one from mattering.
 */

const SCOPE_READ = 'insufficientScope: requires kynite:routines.read';
const SCOPE_WRITE = 'insufficientScope: requires kynite:routines.write';

/**
 * A routine as an MCP client sees it: no `familyId` (the token already names
 * one family and cannot address another), no internal timestamps beyond what
 * a client can act on.
 */
function routineView(row: Routine) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    ownerMemberId: row.ownerMemberId,
    schedule: row.schedule,
    starsPerCompletion: row.starsPerCompletion,
    rewardEnabled: row.rewardEnabled,
    faded: row.fadedAt !== null,
    active: row.active,
  };
}

function stepView(step: RoutineStep) {
  return {
    id: step.id,
    title: step.title,
    icon: step.icon,
    timerSeconds: step.timerSeconds,
    sortOrder: step.sortOrder,
  };
}

/** The shared tail of every routine write: seam result → tool result. */
function settle(result: RoutineWriteResult) {
  if (!result.ok) return toolError(result.error);
  return ok({ routineId: result.routineId });
}

/** The routine body `create_routine` and `update_routine` both accept. */
const routineBodySchema = {
  title: z.string().min(1).max(120).describe('What the routine is called on the board.'),
  icon: z.enum(ROUTINE_ICONS).describe('Which icon the routine shows on the board.'),
  ownerMemberId: z.uuid().describe('The member whose board this routine appears on.'),
  scheduleKind: z
    .enum(SCHEDULE_KINDS)
    .describe('"recurring" reads `weekdays`; "once" reads `onceDate`.'),
  weekdays: z
    .array(z.enum(WEEKDAYS))
    .default([])
    .describe('Weekdays a recurring routine is due on. Empty for a one-off.'),
  onceDate: z
    .string()
    .default('')
    .describe('YYYY-MM-DD in the family’s zone, for a one-off routine. Empty when recurring.'),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .describe('HH:MM — which part of the day the routine sorts into.'),
  graceDays: z
    .number()
    .int()
    .min(0)
    .max(MAX_GRACE_DAYS)
    .default(0)
    .describe('How many days after the due day the routine can still be ticked off.'),
  /**
   * Capped at 5 here, not at the seam's 20: the app's own routine editor still
   * allows the wider range, but an LLM host inflating the rate is exactly the
   * failure this layer exists to prevent. Optional with a default of 1 so the
   * common case needs no decision at all.
   */
  starsPerCompletion: z
    .number()
    .int()
    .min(0)
    .max(5)
    .default(1)
    .describe(
      'Stars paid PER COMPLETED STEP, not per routine — 5 steps at 3 pays 15. Default 1, rarely 2; 0 for a routine the child already enjoys.'
    ),
  rewardEnabled: z
    .boolean()
    .default(true)
    .describe(
      'False graduates the routine: it keeps working but stops paying stars. Propose this once a child sustains the routine unaided.'
    ),
  active: z.boolean().default(true).describe('False pauses the routine without deleting it.'),
  steps: z
    .array(
      z.object({
        id: z
          .union([z.uuid(), z.literal('')])
          .default('')
          .describe('Existing step id when updating; "" creates a new step.'),
        title: z.string().min(1).max(120),
        timerSeconds: z
          .number()
          .int()
          .min(5)
          .max(7200)
          .nullable()
          .default(null)
          .describe('Optional per-step timer in seconds; null is untimed.'),
        icon: z
          .enum(ROUTINE_ICONS)
          .nullable()
          .default(null)
          .describe(
            'Which icon this step shows. Null suggests one from the title automatically — set it only to override that.'
          ),
      })
    )
    .min(1)
    .max(20)
    .describe('The steps, in the order they appear. Order is the array order.'),
};

export function registerRoutinesTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  const canWrite = () => can(principal, 'routine:write', { familyId: principal.familyId });

  server.registerTool(
    'list_routines',
    {
      title: 'List routines',
      description:
        'List this family’s routines with their steps, optionally narrowed to one member or to the active ones. Step counts matter: payout is `starsPerCompletion` × steps completed.',
      inputSchema: z.object({
        ownerMemberId: z.uuid().optional().describe('Only routines on this member’s board.'),
        activeOnly: z.boolean().optional().describe('Skip paused routines.'),
      }),
    },
    async ({ ownerMemberId, activeOnly }) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_READ])) return toolError(SCOPE_READ);

      const routines = await listRoutines(principal.familyId, { ownerMemberId, activeOnly });
      return ok(routines.map((row) => ({ ...routineView(row), steps: row.steps.map(stepView) })));
    }
  );

  server.registerTool(
    'get_routine',
    {
      title: 'Get one routine',
      description: 'One routine and its steps. Unknown or other-family ids return notFound.',
      inputSchema: z.object({ routineId: z.uuid() }),
    },
    async ({ routineId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_READ])) return toolError(SCOPE_READ);

      const row = await getRoutine(principal.familyId, routineId);
      if (!row) return toolError('routineNotFound');

      const steps = await listSteps(row.id);
      return ok({ ...routineView(row), steps: steps.map(stepView) });
    }
  );

  server.registerTool(
    'create_routine',
    {
      title: 'Create a routine',
      description:
        'Create a routine on a member’s board; its steps are what a child ticks off. `starsPerCompletion` is paid PER STEP — default 1, and 0 for anything the child already enjoys; ask the parent before setting a higher rate.',
      inputSchema: z.object(routineBodySchema),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      return settle(await createRoutine(principal, input as RoutineInput));
    }
  );

  server.registerTool(
    'update_routine',
    {
      title: 'Update a routine',
      description:
        'Replace a routine’s whole body, steps included — steps are matched by id, so omit an id to add a step and leave a step out to delete it. Adding steps raises the routine’s payout (stars are per step), so re-check the rate before you raise it.',
      inputSchema: z.object({ routineId: z.uuid(), ...routineBodySchema }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      return settle(await updateRoutine(principal, input as RoutineInput & { routineId: string }));
    }
  );

  server.registerTool(
    'delete_routine',
    {
      title: 'Delete a routine',
      description:
        'Delete a routine and its steps. Prefer `set_routine_active` to pause or `set_routine_reward` to graduate — deleting takes the routine’s history with it, and a child should never experience a routine vanishing as a punishment.',
      inputSchema: z.object({ routineId: z.uuid() }),
    },
    async ({ routineId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      return settle(await deleteRoutine(principal, { routineId }));
    }
  );

  server.registerTool(
    'set_routine_active',
    {
      title: 'Pause or resume a routine',
      description:
        'Switch a routine off (it stops appearing on the child’s board) or back on; takes the target state, not a toggle. Nothing is deleted and no star is ever withdrawn.',
      inputSchema: z.object({ routineId: z.uuid(), active: z.boolean() }),
    },
    async ({ routineId, active }) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      return settle(await setRoutineActive(principal, { routineId, active }));
    }
  );

  server.registerTool(
    'set_routine_reward',
    {
      title: 'Graduate a routine (or un-graduate it)',
      description:
        'Turn star payout off for one routine — the fade path, and the intended end state for every routine a child sustains unaided. The routine keeps working and keeps celebrating; only its payout stops, and every star already earned stays.',
      inputSchema: z.object({ routineId: z.uuid(), rewardEnabled: z.boolean() }),
    },
    async ({ routineId, rewardEnabled }) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      return settle(await setRoutineReward(principal, { routineId, rewardEnabled }));
    }
  );

  server.registerTool(
    'complete_step',
    {
      title: 'Tick off a routine step',
      description:
        'Mark one step done for one member on one date; idempotent by `clientId`, so a replay never pays twice. Reply with specific praise for what the child actually did first, and mention the star second.',
      inputSchema: z.object({
        routineId: z.uuid(),
        routineStepId: z.uuid(),
        memberId: z.uuid().describe('Whose completion this is.'),
        occurrenceDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe('The day the routine was due, YYYY-MM-DD in the family’s zone.'),
        clientId: z
          .string()
          .min(8)
          .max(200)
          .describe('Idempotency key. Reuse the same value when retrying the same tick.'),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      // Scoped against the *subject* member, not the family: a share-grade
      // principal is confined to the children its grant names.
      if (
        !can(principal, 'completion:write', {
          familyId: principal.familyId,
          memberId: input.memberId,
        })
      ) {
        return toolError('forbidden');
      }

      const result = await completeStep(principal, {
        ...input,
        source: 'mobile',
      } as CompleteStepInput);
      if (result.status === 'error') return toolError(result.error);
      if (result.status !== 'done') return toolError('unexpectedState');
      return ok({ completed: true, stars: result.stars, replayed: result.replayed });
    }
  );

  server.registerTool(
    'undo_completion',
    {
      title: 'Take a completion back',
      description:
        'Undo a tick, addressed by the `clientId` it was made with; undoing twice is harmless. The star is not withdrawn — the ledger is append-only — so never tell a child an undo cost them anything.',
      inputSchema: z.object({ clientId: z.string().min(8).max(200) }),
    },
    async ({ clientId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_ROUTINES_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'completion:write', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await undoCompletion(principal, { clientId });
      if (result.status === 'error') return toolError(result.error);
      if (result.status !== 'undone') return toolError('unexpectedState');
      return ok({ undone: true, memberId: result.memberId });
    }
  );
}
