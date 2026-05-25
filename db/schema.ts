/**
 * Better Auth schema for Drizzle ORM (PostgreSQL / Neon)
 *
 * Generated from Better Auth core + admin plugin requirements.
 * Re-run `npx @better-auth/cli@latest generate --output db/schema.ts` if
 * plugins change (requires DATABASE_URL in .env).
 *
 * Admin plugin additions to `user`:
 *   - role        (text, default 'user')
 *   - banned      (boolean, default false)
 *   - banReason   (text, nullable)
 *   - banExpires  (timestamp, nullable)
 */

import {
  boolean,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// user
// ---------------------------------------------------------------------------
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  // admin plugin fields
  role: text('role').default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
})

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // admin plugin field
  impersonatedBy: text('impersonated_by'),
})

// ---------------------------------------------------------------------------
// account
// ---------------------------------------------------------------------------
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})
