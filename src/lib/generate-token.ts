// src/lib/generate-token.ts

import { randomBytes } from "crypto";

export function generateInviteToken(): string {
  return randomBytes(16).toString("hex"); // 32 character hex string
}

export function getInviteUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/join/${token}`;
}
