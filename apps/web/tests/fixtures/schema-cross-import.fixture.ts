// Fixture: a slice `schema.ts` may reach another slice's `schema` (a foreign
// key needs the table object) but nothing else. Excluded from `pnpm lint` and
// from `tsconfig.json` because the imports below intentionally do not resolve.
import { family } from '@/modules/family/schema';
import { calendar } from '@/modules/google/schema';
import { getFamily } from '@/modules/family/queries';
import { awardStars } from '@/modules/rewards/domain/award';

export const crossImports = [family, calendar, getFamily, awardStars];
