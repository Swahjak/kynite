import 'server-only';
import { z } from 'zod';
import { MCP_TIMERS_READ, MCP_TIMERS_WRITE, hasAllScopes } from '@/server/mcp-auth';
import { can, type Principal } from '@/modules/family';
import {
  EXTEND_PRESET_MINUTES,
  MAX_DURATION_SECONDS,
  extendTimer,
  getTimer,
  isTimerIcon,
  listRecentTimers,
  listRunningTimers,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  type ExtendTimerInput,
  type PauseTimerInput,
  type ResumeTimerInput,
  type StartTimerInput,
  type StopTimerInput,
  type Timer,
} from '@/modules/timers';
import { ok, toolError, type McpToolServer } from './shared';

/**
 * The timers domain's MCP tools (MCP-parity M2) — the countdowns on the wall
 * (ad hoc, or started from a routine step's prescription).
 *
 * Same discipline as `./routines.ts` and `./tasks.ts`: every write goes
 * through `modules/timers/write.ts`, never through a Server Action, and each
 * mutating tool re-checks `can()` itself before calling the seam —
 * deliberately redundant with the seam's own check.
 */

const SCOPE_READ = 'insufficientScope: requires kynite:timers.read';
const SCOPE_WRITE = 'insufficientScope: requires kynite:timers.write';

/** A timer as an MCP client sees it: no `familyId`, no idempotency key. */
function timerView(row: Timer) {
  return {
    id: row.id,
    memberId: row.memberId,
    routineId: row.routineId,
    routineStepId: row.routineStepId,
    label: row.label,
    durationSeconds: row.durationSeconds,
    startedAt: row.startedAt,
    stoppedAt: row.stoppedAt,
    pausedAt: row.pausedAt,
    pausedSeconds: row.pausedSeconds,
    icon: row.icon,
    warningLeadSeconds: row.warningLeadSeconds,
  };
}

export function registerTimersTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  const canControl = (memberId?: string | null) =>
    can(principal, 'timer:control', { familyId: principal.familyId, memberId: memberId ?? null });

  server.registerTool(
    'list_timers',
    {
      title: 'List timers',
      description:
        'This family’s timers: everything currently running, plus a short recent history (running or not).',
      inputSchema: z.object({
        recentLimit: z.number().int().min(1).max(50).default(10).describe('History length.'),
      }),
    },
    async ({ recentLimit }) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_READ])) return toolError(SCOPE_READ);

      const [running, recent] = await Promise.all([
        listRunningTimers(principal.familyId),
        listRecentTimers(principal.familyId, recentLimit),
      ]);

      return ok({ running: running.map(timerView), recent: recent.map(timerView) });
    }
  );

  server.registerTool(
    'get_timer',
    {
      title: 'Get one timer',
      description: 'One timer. Unknown or other-family ids return notFound.',
      inputSchema: z.object({ timerId: z.uuid() }),
    },
    async ({ timerId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_READ])) return toolError(SCOPE_READ);

      const row = await getTimer(principal.familyId, timerId);
      if (!row) return toolError('timerNotFound');

      return ok(timerView(row));
    }
  );

  server.registerTool(
    'start_timer',
    {
      title: 'Start a timer',
      description:
        'Start a countdown — ad hoc (label + duration), or from a routine step by id (its prescribed title, duration and owner win).',
      inputSchema: z.object({
        label: z.string().max(120).optional(),
        durationSeconds: z.number().int().min(1).max(MAX_DURATION_SECONDS).optional(),
        memberId: z.uuid().optional().describe('Whose timer this is. Omit for the whole family.'),
        routineStepId: z.uuid().optional(),
        warningLeadSeconds: z.number().int().min(0).max(MAX_DURATION_SECONDS).nullable().optional(),
        clientId: z
          .string()
          .min(8)
          .max(200)
          .optional()
          .describe('Idempotency key. Reuse the same value when retrying the same start.'),
        icon: z.string().refine(isTimerIcon).optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_WRITE])) return toolError(SCOPE_WRITE);
      // Cheap early rejection against the caller-supplied subject; the seam
      // re-authorizes against the step's real owner when one is resolved.
      if (!canControl(input.memberId)) return toolError('forbidden');

      const result = await startTimer(principal, input as StartTimerInput);
      if (result.status === 'error') return toolError(result.error);
      return ok({ timerId: result.timerId, replayed: result.replayed });
    }
  );

  server.registerTool(
    'stop_timer',
    {
      title: 'Stop a timer',
      description: 'Stop a running timer. Idempotent: stopping twice is not an error.',
      inputSchema: z.object({ timerId: z.uuid() }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canControl()) return toolError('forbidden');

      const result = await stopTimer(principal, input as StopTimerInput);
      if (result.status === 'error') return toolError(result.error);
      return ok({ stopped: true });
    }
  );

  server.registerTool(
    'pause_timer',
    {
      title: 'Pause a timer',
      description: 'Freeze a running timer’s countdown.',
      inputSchema: z.object({ timerId: z.uuid() }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canControl()) return toolError('forbidden');

      const result = await pauseTimer(principal, input as PauseTimerInput);
      if (result.status === 'error') return toolError(result.error);
      return ok({ paused: true });
    }
  );

  server.registerTool(
    'resume_timer',
    {
      title: 'Resume a timer',
      description: 'Unfreeze a paused timer.',
      inputSchema: z.object({ timerId: z.uuid() }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canControl()) return toolError('forbidden');

      const result = await resumeTimer(principal, input as ResumeTimerInput);
      if (result.status === 'error') return toolError(result.error);
      return ok({ resumed: true });
    }
  );

  server.registerTool(
    'extend_timer',
    {
      title: 'Give a timer longer',
      description: `Add one of the fixed presets (${EXTEND_PRESET_MINUTES.join(', ')} minutes) to a running timer's duration, capped at the maximum.`,
      inputSchema: z.object({
        timerId: z.uuid(),
        minutes: z
          .number()
          .int()
          .refine((value) => (EXTEND_PRESET_MINUTES as readonly number[]).includes(value)),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TIMERS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canControl()) return toolError('forbidden');

      const result = await extendTimer(principal, input as ExtendTimerInput);
      if (result.status === 'error') return toolError(result.error);
      return ok({ status: result.status, durationSeconds: result.durationSeconds });
    }
  );
}
