import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./schema";
import { familyMembers } from "./schema";
import { eq } from "drizzle-orm";

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
    customSession(async ({ user, session }) => {
      // Query user's family membership
      const membership = await db
        .select({
          familyId: familyMembers.familyId,
          role: familyMembers.role,
          displayName: familyMembers.displayName,
          memberId: familyMembers.id,
        })
        .from(familyMembers)
        .where(eq(familyMembers.userId, user.id))
        .limit(1);

      const member = membership[0];
      const isDevice = (user as { type?: string }).type === "device";

      return {
        user,
        session: {
          ...session,
          familyId: member?.familyId ?? null,
          memberId: member?.memberId ?? null,
          memberRole: member?.role ?? null,
          isDevice,
          deviceName: isDevice ? member?.displayName : null,
        },
      };
    }),
  ],

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
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute cache
    },
  },

  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [process.env.BETTER_AUTH_URL],
});

export type Auth = typeof auth;
