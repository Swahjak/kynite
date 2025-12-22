import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "",
});

// Export commonly used methods for convenience
export const { signIn, signOut, useSession } = authClient;

// Export the full client for advanced operations like linkSocial
export default authClient;
