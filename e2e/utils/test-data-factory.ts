// e2e/utils/test-data-factory.ts
import { randomUUID } from "crypto";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

export interface TestSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface TestFamily {
  id: string;
  name: string;
}

export interface TestFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: "manager" | "participant" | "caregiver";
  displayName: string | null;
  avatarColor: string | null;
}

export interface TestFamilyInvite {
  id: string;
  familyId: string;
  token: string;
  createdById: string;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
}

export interface TestAccount {
  id: string;
  userId: string;
  providerId: string;
  accountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
}

export function createTestAccount(
  userId: string,
  overrides: Partial<Omit<TestAccount, "userId">> = {}
): TestAccount {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    userId,
    providerId: "google",
    accountId: overrides.accountId ?? `google-${randomUUID().slice(0, 12)}`,
    accessToken: overrides.accessToken ?? null,
    refreshToken: overrides.refreshToken ?? null,
    accessTokenExpiresAt: overrides.accessTokenExpiresAt ?? null,
  };
}

export interface TestGoogleCalendar {
  id: string;
  familyId: string;
  accountId: string;
  googleCalendarId: string;
  name: string;
  color: string | null;
  accessRole: string;
  syncEnabled: boolean;
  isPrivate: boolean;
}

export function createTestGoogleCalendar(
  familyId: string,
  accountId: string,
  overrides: Partial<Omit<TestGoogleCalendar, "familyId" | "accountId">> = {}
): TestGoogleCalendar {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    familyId,
    accountId,
    googleCalendarId:
      overrides.googleCalendarId ?? `cal-${randomUUID().slice(0, 12)}`,
    name: overrides.name ?? "Test Calendar",
    color: overrides.color ?? "#4285f4",
    accessRole: overrides.accessRole ?? "owner",
    syncEnabled: overrides.syncEnabled ?? true,
    isPrivate: overrides.isPrivate ?? false,
  };
}

export interface TestEvent {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string | null;
  googleCalendarId: string | null;
  googleEventId: string | null;
  syncStatus: string;
}

export function createTestEvent(
  familyId: string,
  overrides: Partial<Omit<TestEvent, "familyId">> = {}
): TestEvent {
  const id = overrides.id ?? randomUUID();
  const startTime = overrides.startTime ?? new Date();
  return {
    id,
    familyId,
    title: overrides.title ?? "Test Event",
    description: overrides.description ?? null,
    location: overrides.location ?? null,
    startTime,
    endTime:
      overrides.endTime ?? new Date(startTime.getTime() + 60 * 60 * 1000),
    allDay: overrides.allDay ?? false,
    color: overrides.color ?? "blue",
    googleCalendarId: overrides.googleCalendarId ?? null,
    googleEventId: overrides.googleEventId ?? null,
    syncStatus: overrides.syncStatus ?? "synced",
  };
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id || randomUUID();
  return {
    id,
    name: overrides.name ?? `Test User ${id.slice(0, 8)}`,
    email: overrides.email ?? `test-${id.slice(0, 8)}@example.com`,
    emailVerified: overrides.emailVerified ?? true,
    image: overrides.image ?? null,
  };
}

export function createTestSession(
  userId: string,
  overrides: Partial<TestSession> = {}
): TestSession {
  const id = overrides.id || randomUUID();
  return {
    id,
    userId,
    token: overrides.token ?? `test-session-${randomUUID()}`,
    expiresAt:
      overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

export function createTestFamily(
  overrides: Partial<TestFamily> = {}
): TestFamily {
  const id = overrides.id || randomUUID();
  return {
    id,
    name: overrides.name ?? `Test Family ${id.slice(0, 8)}`,
  };
}

export function createTestFamilyMember(
  familyId: string,
  userId: string,
  overrides: Partial<Omit<TestFamilyMember, "familyId" | "userId">> = {}
): TestFamilyMember {
  return {
    id: overrides.id || randomUUID(),
    familyId,
    userId,
    role: overrides.role ?? "participant",
    displayName: overrides.displayName ?? null,
    avatarColor: overrides.avatarColor ?? null,
  };
}

export function createTestFamilyInvite(
  familyId: string,
  createdById: string,
  overrides: Partial<Omit<TestFamilyInvite, "familyId" | "createdById">> = {}
): TestFamilyInvite {
  return {
    id: overrides.id || randomUUID(),
    familyId,
    createdById,
    token: overrides.token ?? `test-invite-${randomUUID().slice(0, 16)}`,
    expiresAt:
      overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxUses: overrides.maxUses ?? null,
    useCount: overrides.useCount ?? 0,
  };
}

export interface TestRewardChart {
  id: string;
  familyId: string;
  memberId: string;
  isActive: boolean;
}

export interface TestRewardChartTask {
  id: string;
  chartId: string;
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TestRewardChartGoal {
  id: string;
  chartId: string;
  title: string;
  emoji: string;
  starTarget: number;
  starsCurrent: number;
  status: string;
}

export function createTestRewardChart(
  familyId: string,
  memberId: string,
  overrides: Partial<Omit<TestRewardChart, "familyId" | "memberId">> = {}
): TestRewardChart {
  return {
    id: overrides.id ?? randomUUID(),
    familyId,
    memberId,
    isActive: overrides.isActive ?? true,
  };
}

export function createTestRewardChartTask(
  chartId: string,
  overrides: Partial<Omit<TestRewardChartTask, "chartId">> = {}
): TestRewardChartTask {
  return {
    id: overrides.id ?? randomUUID(),
    chartId,
    title: overrides.title ?? "Test Task",
    icon: overrides.icon ?? "star",
    iconColor: overrides.iconColor ?? "blue",
    starValue: overrides.starValue ?? 1,
    daysOfWeek: overrides.daysOfWeek ?? "[1,2,3,4,5]",
    sortOrder: overrides.sortOrder ?? 0,
    isActive: overrides.isActive ?? true,
  };
}

export function createTestRewardChartGoal(
  chartId: string,
  overrides: Partial<Omit<TestRewardChartGoal, "chartId">> = {}
): TestRewardChartGoal {
  return {
    id: overrides.id ?? randomUUID(),
    chartId,
    title: overrides.title ?? "Test Goal",
    emoji: overrides.emoji ?? "🎁",
    starTarget: overrides.starTarget ?? 10,
    starsCurrent: overrides.starsCurrent ?? 0,
    status: overrides.status ?? "active",
  };
}
