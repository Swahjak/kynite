import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';

/** better-auth catch-all handler (docs/architecture.md §2 route map). */
export const { GET, POST } = toNextJsHandler((request: Request) => getAuth().handler(request));
