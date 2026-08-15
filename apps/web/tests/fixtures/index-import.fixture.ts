// Fixture: the allowed shape — cross-module imports via the slice public index.
import { listEvents } from '@/modules/calendar';
import { awardStars } from '@/modules/rewards';

export const publicImports = [listEvents, awardStars];
