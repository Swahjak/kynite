// Fixture: proves the module-boundary ESLint rule fires.
// Excluded from `pnpm lint` (eslint.config.mjs ignores) and from `tsconfig.json`
// because the imports below intentionally do not resolve.
import { listEvents } from '@/modules/calendar/queries';
import { awardStars } from '@/modules/rewards/domain/award';

export const deepImports = [listEvents, awardStars];
