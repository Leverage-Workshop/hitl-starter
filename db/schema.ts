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
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import type { Action, FieldDef, Note, Source, Stat, Step } from '@/lib/contract'

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
// workflows
// ---------------------------------------------------------------------------
export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('idle'),
  defaultView: text('default_view').notNull().default('table'),
  confidenceFloor: real('confidence_floor'),
  itemSchema: jsonb('item_schema').$type<FieldDef[]>().notNull(),
  availableActions: jsonb('available_actions').$type<Action[]>().notNull(),
  stats: jsonb('stats').$type<Stat[]>().notNull(),
  steps: jsonb('steps').$type<Step[]>().notNull(),
  sources: jsonb('sources').$type<Source[]>().notNull(),
  /** Per-workflow secret for authenticating inbound webhook requests. */
  webhookSecret: text('webhook_secret'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// workflow_items
// ---------------------------------------------------------------------------
export const workflowItems = pgTable('workflow_items', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('normal'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  summary: text('summary').notNull(),
  fields: jsonb('fields').$type<Record<string, unknown>>().notNull(),
  sourceContent: text('source_content'),
  proposedOutput: text('proposed_output'),
  context: jsonb('context').$type<Note[]>().notNull(),
  /** Nullable per-item action override — inherits workflow availableActions when null. */
  actions: jsonb('actions').$type<Action[]>(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: text('decided_by').references(() => user.id, { onDelete: 'set null' }),
  /** trigger.dev run ID for the durable outbound dispatch task, if applicable. */
  outboundDispatchRunId: text('outbound_dispatch_run_id'),
  /** When the outbound dispatch was initiated. */
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
