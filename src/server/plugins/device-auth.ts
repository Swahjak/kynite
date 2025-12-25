import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { APIError, type BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import {
  consumePairingCode,
  DEVICE_SESSION_EXPIRY_DAYS,
} from "../services/device-service";
import { db } from "../db";
import { users, familyMembers } from "../schema";
import { createId } from "@paralleldrive/cuid2";

const completePairingSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

/**
 * Device authentication plugin for better-auth
 * Handles device pairing via 6-digit codes and creates long-lived sessions
 */
export const deviceAuth = (): BetterAuthPlugin => {
  return {
    id: "device-auth",
    endpoints: {
      completePairing: createAuthEndpoint(
        "/device/pair/complete",
        {
          method: "POST",
          body: completePairingSchema,
          metadata: {
            openapi: {
              description: "Complete device pairing with a 6-digit code",
              responses: {
                200: {
                  description: "Device paired successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          deviceName: { type: "string" },
                          message: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          const { code } = ctx.body;

          // Validate and consume the pairing code
          const pairingCode = await consumePairingCode(code);

          if (!pairingCode) {
            throw new APIError("BAD_REQUEST", {
              message: "Invalid or expired pairing code",
            });
          }

          // Create device user
          const userId = createId();
          const memberId = createId();
          const email = `device-${userId}@internal.local`;

          await db.insert(users).values({
            id: userId,
            name: pairingCode.deviceName,
            email,
            emailVerified: true,
            type: "device",
          });

          // Create family membership
          await db.insert(familyMembers).values({
            id: memberId,
            familyId: pairingCode.familyId,
            userId,
            role: "device",
            displayName: pairingCode.deviceName,
          });

          // Create session using better-auth's internal adapter
          // This handles all the session token generation and storage
          const session = await ctx.context.internalAdapter.createSession(
            userId,
            false, // dontRememberMe
            {
              expiresAt: new Date(
                Date.now() + DEVICE_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
              ),
            }
          );

          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create session",
            });
          }

          // Fetch the user for the session cookie
          const user = await ctx.context.internalAdapter.findUserById(userId);

          if (!user) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to retrieve user",
            });
          }

          // Set session cookie using better-auth's method
          // This sets both session_token and session_data cookies
          await setSessionCookie(ctx, {
            session,
            user,
          });

          return ctx.json({
            deviceName: pairingCode.deviceName,
            message: "Device paired successfully",
          });
        }
      ),
    },
  };
};
