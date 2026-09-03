import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * better-auth owned tables (docs/architecture.md §7): `user`, `session`,
 * `account`, `verification`. Column *names* are ours (snake_case); the drizzle
 * property names must stay exactly better-auth's field names, because the
 * drizzle adapter addresses columns by field name.
 *
 * The only Kynite additions are the two `session` columns declared as
 * `session.additionalFields` in `src/server/auth.ts`: `activeFamilyId` and
 * `memberId`. They are deliberately *not* foreign keys — better-auth's adapter
 * writes them, and the family slice owns the referenced rows; a FK here would
 * make an auth-table write fail on a family-slice concern.
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    // Kynite session scope — read straight off the (cached) session cookie.
    activeFamilyId: uuid('active_family_id'),
    memberId: uuid('member_id'),
  },
  (table) => [index('session_user_id_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    // better-auth 1.7: the identity namespace an `accountId` is scoped to.
    // Replaces the old bare-`accountId` uniqueness with `(issuer,
    // accountId)`, so an id issued by one provider can never collide with one
    // issued by another. There is no config knob for this (see the comment
    // above `account.encryptOAuthTokens` in `src/server/auth.ts` — 1.7.2 has
    // no `identityStrategy` option despite the upgrade guide's prose);
    // resolution is unconditional in better-auth's source. Existing rows are
    // backfilled by the drizzle migration that adds this column — see its
    // header for the exact mapping.
    issuer: text('issuer').notNull(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_issuer_account_id_uidx').on(table.issuer, table.accountId),
  ]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export type UserRow = typeof user.$inferSelect;
export type SessionRow = typeof session.$inferSelect;
