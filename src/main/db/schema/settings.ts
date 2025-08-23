import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),  // JSON string
  type: text('type', {
    enum: ['string', 'number', 'boolean', 'object', 'array', 'null']
  }),
  description: text('description'),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`),
  updatedBy: text('updated_by').default('system'),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;