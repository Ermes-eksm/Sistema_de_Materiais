import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
export const inventory = sqliteTable('inventory', {id: integer('id').primaryKey(), version:integer('version').notNull(), payload:text('payload').notNull()});
export const operators = sqliteTable('operators', {
 id:text('id').primaryKey(), email:text('email').notNull().unique(), name:text('name').notNull(), passwordHash:text('password_hash').notNull(), salt:text('salt').notNull(), recoveryHash:text('recovery_hash').notNull(), createdAt:text('created_at').notNull()
});
export const sessions = sqliteTable('sessions', {tokenHash:text('token_hash').primaryKey(), userId:text('user_id').notNull(), expiresAt:integer('expires_at').notNull(), warehouse:text('warehouse').notNull().default('obra')});
export const authLimits = sqliteTable('auth_limits', {key:text('key').primaryKey(), attempts:integer('attempts').notNull(), expiresAt:integer('expires_at').notNull()});
