// src/types/family.ts

export type FamilyMemberRole = "manager" | "participant" | "caregiver";

export type AvatarColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "teal";

export const AVATAR_COLORS: AvatarColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "pink",
  "teal",
];

export const FAMILY_MEMBER_ROLES: FamilyMemberRole[] = [
  "manager",
  "participant",
  "caregiver",
];

export interface FamilyMemberWithUser {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMemberRole;
  displayName: string | null;
  avatarColor: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}
