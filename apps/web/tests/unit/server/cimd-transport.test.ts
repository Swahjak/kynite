import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `@/server/cimd-transport` — our 1:1 port of `@better-auth/cimd/node`'s
 * `fetchClientMetadataResource`, fixed for the Node >=20 `autoSelectFamily`
 * dual-form `lookup` callback (see the file's doc comment for the upstream
 * bug). These tests cover the guard clauses that run before any real network
 * I/O, the SSRF DNS-answer gate (with `node:dns/promises` mocked), and the
 * dual-form callback itself in isolation.
 */

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
}));

const { fetchClientMetadataResource, pinnedLookup } = await import('@/server/cimd-transport');

beforeEach(() => {
  lookupMock.mockReset();
});

describe('fetchClientMetadataResource', () => {
  it('rejects a non-HTTPS URL', async () => {
    await expect(fetchClientMetadataResource('http://example.com/client-metadata')).rejects.toThrow(
      /HTTPS URL/
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a non-GET/HEAD method', async () => {
    await expect(
      fetchClientMetadataResource('https://example.com/client-metadata', { method: 'POST' })
    ).rejects.toThrow(/GET and HEAD/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects when DNS resolves to a private address', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    await expect(
      fetchClientMetadataResource('https://example.com/client-metadata')
    ).rejects.toThrow(/public-routable/);
    expect(lookupMock).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
  });

  it('rejects when any DNS answer is not public-routable, even if another is', async () => {
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);

    await expect(
      fetchClientMetadataResource('https://example.com/client-metadata')
    ).rejects.toThrow(/public-routable/);
  });

  it('rejects when DNS returns no addresses', async () => {
    lookupMock.mockResolvedValue([]);

    await expect(
      fetchClientMetadataResource('https://example.com/client-metadata')
    ).rejects.toThrow(/no DNS addresses/);
  });
});

describe('pinnedLookup (dual-form DNS lookup callback)', () => {
  const pinned = { address: '93.184.216.34', family: 4 };

  it('invokes the array form when options.all is set (Node >=20 autoSelectFamily)', () => {
    const callback = vi.fn();
    const lookupFn = pinnedLookup(pinned);

    lookupFn('example.com', { all: true }, callback);

    expect(callback).toHaveBeenCalledWith(null, [
      { address: pinned.address, family: pinned.family },
    ]);
  });

  it('invokes the legacy 3-arg form when options.all is not set', () => {
    const callback = vi.fn();
    const lookupFn = pinnedLookup(pinned);

    lookupFn('example.com', {}, callback);

    expect(callback).toHaveBeenCalledWith(null, pinned.address, pinned.family);
  });

  it('invokes the legacy 3-arg form when options is not an object (e.g. a caller passing null)', () => {
    const callback = vi.fn();
    const lookupFn = pinnedLookup(pinned);

    // Runtime-defensive case only: `LookupFunction`'s real type never passes
    // `null`, but Node's own call sites are not statically guaranteed here.
    lookupFn('example.com', null as never, callback);

    expect(callback).toHaveBeenCalledWith(null, pinned.address, pinned.family);
  });
});
