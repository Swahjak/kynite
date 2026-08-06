// Fixture: proves the module-boundary ESLint rule also closes the *relative*
// escape hatch — a deep import written as `../../modules/<slice>/<file>` must
// fire exactly like the aliased form.
// Excluded from `pnpm lint` (eslint.config.mjs ignores) and from `tsconfig.json`
// because the imports below intentionally do not resolve.
import { listMembers } from '../../modules/family/queries';
import { expandRecurrence } from '../modules/calendar/domain/recurrence';

export const relativeDeepImports = [listMembers, expandRecurrence];
