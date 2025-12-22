// e2e/utils/db-seeder.ts
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../../src/server/schema";
import type {
  TestUser,
  TestSession,
  TestFamily,
  TestFamilyMember,
  TestFamilyInvite,
} from "./test-data-factory";

export class DbSeeder {
  private client: ReturnType<typeof postgres>;
  private db: ReturnType<typeof drizzle>;
  private insertedUserIds: string[] = [];
  private insertedFamilyIds: string[] = [];
  private insertedSessionIds: string[] = [];

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    this.client = postgres(connectionString);
    this.db = drizzle(this.client, { schema });
  }

  async seedUser(user: TestUser): Promise<void> {
    await this.db.insert(schema.users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.insertedUserIds.push(user.id);
  }

  async seedSession(session: TestSession): Promise<void> {
    await this.db.insert(schema.sessions).values({
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "Playwright Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.insertedSessionIds.push(session.id);
  }

  async seedFamily(family: TestFamily): Promise<void> {
    await this.db.insert(schema.families).values({
      id: family.id,
      name: family.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.insertedFamilyIds.push(family.id);
  }

  async seedFamilyMember(member: TestFamilyMember): Promise<void> {
    await this.db.insert(schema.familyMembers).values({
      id: member.id,
      familyId: member.familyId,
      userId: member.userId,
      role: member.role,
      displayName: member.displayName,
      avatarColor: member.avatarColor,
      createdAt: new Date(),
    });
  }

  async seedFamilyInvite(invite: TestFamilyInvite): Promise<void> {
    await this.db.insert(schema.familyInvites).values({
      id: invite.id,
      familyId: invite.familyId,
      token: invite.token,
      createdById: invite.createdById,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      useCount: invite.useCount,
      createdAt: new Date(),
    });
  }

  async cleanup(): Promise<void> {
    // Delete in reverse order to respect FK constraints
    // Sessions, familyMembers, familyInvites cascade from users/families
    for (const sessionId of this.insertedSessionIds) {
      await this.db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .catch(() => {});
    }

    for (const familyId of this.insertedFamilyIds) {
      await this.db
        .delete(schema.families)
        .where(eq(schema.families.id, familyId))
        .catch(() => {});
    }

    for (const userId of this.insertedUserIds) {
      await this.db
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .catch(() => {});
    }

    this.insertedUserIds = [];
    this.insertedFamilyIds = [];
    this.insertedSessionIds = [];
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
