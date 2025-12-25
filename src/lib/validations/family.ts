// src/lib/validations/family.ts

import { z } from "zod";
import { AVATAR_COLORS, FAMILY_MEMBER_ROLES } from "@/types/family";

export const createFamilySchema = z.object({
  name: z
    .string()
    .min(1, "Family name is required")
    .max(50, "Family name must be 50 characters or less"),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

export const updateFamilySchema = z.object({
  name: z
    .string()
    .min(1, "Family name is required")
    .max(50, "Family name must be 50 characters or less"),
});

export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;

export const updateMemberSchema = z.object({
  displayName: z
    .string()
    .max(50, "Display name must be 50 characters or less")
    .optional()
    .nullable(),
  avatarColor: z
    .enum(AVATAR_COLORS as [string, ...string[]])
    .optional()
    .nullable(),
  avatarSvg: z
    .string()
    .max(20000, "Avatar SVG must be smaller than 20KB")
    .optional()
    .nullable(),
  role: z.enum(FAMILY_MEMBER_ROLES as [string, ...string[]]).optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(100).optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const createChildSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  avatarColor: z.enum(AVATAR_COLORS as [string, ...string[]]),
});

export type CreateChildInput = z.infer<typeof createChildSchema>;
