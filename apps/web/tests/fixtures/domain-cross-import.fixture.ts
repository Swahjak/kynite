// Fixture: a slice `domain/` module may reach another slice's `domain/` (pure,
// framework-free code — a barrel would drag client components into it) but
// nothing else. Excluded from `pnpm lint` and from `tsconfig.json` because the
// imports below intentionally do not resolve.
import { parseRule } from '@/modules/calendar/domain/rrule';
import { toDateKey } from '@/modules/calendar/domain/zone';
import { getFamily } from '@/modules/family/queries';
import { member } from '@/modules/family/schema';

export const crossImports = [parseRule, toDateKey, getFamily, member];
