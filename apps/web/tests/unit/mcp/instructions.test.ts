import { describe, expect, it } from 'vitest';
import { KYNITE_MCP_INSTRUCTIONS } from '@/app/api/mcp/tools/instructions';

/**
 * A regression guard, not a prose review.
 *
 * `instructions` is the one place the server states the star economy's rules
 * before a host picks a tool, and it is the kind of string that gets emptied or
 * trimmed to "Kynite family planner" by someone tidying up. These assertions
 * fail loudly if the load-bearing rules — per-step payout, the absolute
 * never-clauses, the calibration call — leave the text. Wording is free to
 * change; the rules are not.
 */
describe('KYNITE_MCP_INSTRUCTIONS', () => {
  it('is a substantial string', () => {
    expect(KYNITE_MCP_INSTRUCTIONS.trim().length).toBeGreaterThan(400);
  });

  it('states that stars pay per step', () => {
    expect(KYNITE_MCP_INSTRUCTIONS.toLowerCase()).toContain('per step');
  });

  it('carries the absolute prohibitions', () => {
    expect(KYNITE_MCP_INSTRUCTIONS.toLowerCase()).toContain('never');
    expect(KYNITE_MCP_INSTRUCTIONS.toLowerCase()).toContain('never remove stars');
  });

  it('points at the calibration call before pricing', () => {
    expect(KYNITE_MCP_INSTRUCTIONS).toContain('get_star_totals');
    expect(KYNITE_MCP_INSTRUCTIONS).toContain('avgPerDay');
  });

  it('names where ids come from', () => {
    expect(KYNITE_MCP_INSTRUCTIONS).toContain('list_members');
  });
});
