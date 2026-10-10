import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
export const inventory = sqliteTable('inventory', {id: integer('id').primaryKey(), version:integer('version').notNull(), payload:text('payload').notNull()});
