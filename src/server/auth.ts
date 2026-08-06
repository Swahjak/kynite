import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import * as schema from '@/server/db/schema';
import { env } from '@/server/env';

/**
 * better-auth (docs/architecture.md §7).
 *
 * - Email/password today; Google OAuth with account linking lands in M05.
 * - Sessions are 30-day sliding, httpOnly / SameSite=Lax.
 * - `activeFamilyId` + `memberId` are session columns *and* live in the signed
 *   session-cookie cache, so authorization is a cookie read rather than a join
 *   on every request. They are populated by the `session.create.before` hook,
 *   which runs after the user (and, on sign-up, the family) exists.
 *   Trade-off: session revocation (sign-out elsewhere, a killed session row)
 *   can lag up to `cookieCache.maxAge` (300s) on *other* devices still
 *   presenting the cached cookie — the device that signs out clears its own
 *   cookie immediately. Role demotion is not subject to that lag: `member:manage`
 *   and every other capability check re-reads the member row from the database
 *   on each request rather than trusting a role baked into the cookie, so a
 *   demoted role takes effect on the very next request.
 *
 * Constructed lazily: `betterAuth()` reads `env` eagerly, and importing this
 * module must stay side-effect-free for `next build`.
 */
function createAuth() {
  const db = getDb();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Verification mail needs an outbound mailer (M10); until then a fresh
      // account is usable immediately.
      requireEmailVerification: false,
      /**
       * The sign-up action creates the family + owner member *between* the user
       * row and the session, so the first session cookie is already scoped.
       * Auto sign-in would issue that cookie too early, with a null scope.
       */
      autoSignIn: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
      additionalFields: {
        activeFamilyId: { type: 'string', required: false, input: false },
        memberId: { type: 'string', required: false, input: false },
      },
    },
    advanced: {
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    databaseHooks: {
      session: {
        create: {
          /**
           * Stamp the session with the family scope at creation time. On
           * sign-up the owner member already exists (the sign-up action creates
           * family + member before the session is issued), so the very first
           * cookie is correctly scoped.
           */
          before: async (session) => {
            const [scope] = await db
              .select({
                familyId: schema.member.familyId,
                memberId: schema.member.id,
              })
              .from(schema.member)
              .where(eq(schema.member.userId, session.userId))
              .orderBy(schema.member.sortOrder)
              .limit(1);

            if (!scope) return;

            return {
              data: {
                ...session,
                activeFamilyId: scope.familyId,
                memberId: scope.memberId,
              },
            };
          },
        },
      },
    },
    // Must stay last: it flushes better-auth's Set-Cookie headers into the
    // Next.js cookie store so Server Actions can sign users in.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getAuth(), prop) as unknown;
  },
});

export type Session = Auth['$Infer']['Session'];
