/**
 * Test stand-in for the `server-only` package.
 *
 * `server-only` resolves to a module that *throws* outside a React Server
 * Component graph, which is exactly what makes it useful in `src/` — and
 * exactly what stops Vitest from importing a query or store module at all.
 * Aliasing it to this empty module in `vitest.config.ts` keeps the guard real
 * in the application build while letting the integration suite exercise the
 * modules it protects.
 */
export {};
