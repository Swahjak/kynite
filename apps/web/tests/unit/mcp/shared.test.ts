import { describe, expect, it } from 'vitest';
import { ok, toolError } from '@/app/api/mcp/tools/shared';

/**
 * The two result shapes every `/api/mcp` tool returns. Small, but load-bearing:
 * `isError` is what tells an MCP client "this call was refused" as opposed to
 * "this call succeeded and the answer happens to mention an error", and every
 * refusal in the tool layer is spelled this way rather than by throwing.
 */
describe('ok', () => {
  it('carries the payload as a single JSON text block and is not an error', () => {
    const result = ok({ routineId: 'r1' });

    expect(result).toEqual({ content: [{ type: 'text', text: '{"routineId":"r1"}' }] });
    expect('isError' in result).toBe(false);
  });
});

describe('toolError', () => {
  it('flags the result and puts the message under `error`', () => {
    const result = toolError('forbidden');

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({ error: 'forbidden' });
  });
});
