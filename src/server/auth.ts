import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./schema";
import { familyMembers, users } from "./schema";
import { eq } from "drizzle-orm";
import { deviceAuth } from "./plugins/device-auth";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Generate with: openssl rand -base64 32"
  );
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error(
    "BETTER_AUTH_URL is not set. Use http://localhost:3000 for dev."
  );
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set. Google OAuth disabled."
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  plugins: [
    deviceAuth(),
    customSession(async ({ user, session }) => {
      // Query user's family membership for IDs (not cached, but not used for permissions)
      const membership = await db
        .select({
          familyId: familyMembers.familyId,
          memberId: familyMembers.id,
          displayName: familyMembers.displayName,
        })
        .from(familyMembers)
        .where(eq(familyMembers.userId, user.id))
        .limit(1);

      const member = membership[0];
      // isDevice and memberRole now come from session additionalFields (cookie cached)
      const sessionWithFields = session as {
        isDevice?: boolean;
        memberRole?: string;
      };
      const isDevice = sessionWithFields.isDevice ?? false;

      return {
        user,
        session: {
          ...session,
          familyId: member?.familyId ?? null,
          memberId: member?.memberId ?? null,
          memberRole: sessionWithFields.memberRole ?? null, // Use cached value
          isDevice, // Use cached value
          deviceName: isDevice ? member?.displayName : null,
        },
      };
    }),
  ],

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Get user to check if device
          const user = await db
            .select({ type: users.type })
            .from(users)
            .where(eq(users.id, session.userId))
            .limit(1);

          const isDevice = user[0]?.type === "device";

          // Get family membership for role
          const membership = await db
            .select({ role: familyMembers.role })
            .from(familyMembers)
            .where(eq(familyMembers.userId, session.userId))
            .limit(1);

          const memberRole = membership[0]?.role ?? null;

          return {
            data: {
              ...session,
              isDevice,
              memberRole,
            },
          };
        },
      },
    },
  },

  // Google OAuth provider for calendar access
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Request refresh tokens for server-side API access
      accessType: "offline",
      // Always show consent to ensure refresh token is returned
      prompt: "select_account consent",
      // Request calendar scope for 2-way sync (read/write events + calendar list)
      scope: [
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      ],
    },
  },

  // Enable account linking for multi-account support
  account: {
    accountLinking: {
      enabled: true,
      // Allow linking Google accounts with different emails
      allowDifferentEmails: true,
    },
    // Encrypt OAuth tokens before storing in database
    // Uses BETTER_AUTH_SECRET for encryption key
    encryptOAuthTokens: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh every 24 hours
    additionalFields: {
      isDevice: {
        type: "boolean",
        defaultValue: false,
      },
      memberRole: {
        type: "string",
        required: false,
      },
    },
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute cache
    },
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    },
  },

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [process.env.BETTER_AUTH_URL],
});

export type Auth = typeof auth;
