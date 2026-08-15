/**
 * TypeScript 6 rejects a side-effect import whose specifier has no type
 * declaration (`TS2882`), where TypeScript 5 silently allowed it. Vite resolves
 * `import './preview.css'` at build time, so the import is real — it just has
 * no types. This ambient declaration gives the compiler the shape it wants
 * without pulling in a CSS-modules plugin the package does not use.
 *
 * The app side of the workspace gets the same declaration for free from the
 * generated `apps/web/next-env.d.ts`.
 */
declare module '*.css';
