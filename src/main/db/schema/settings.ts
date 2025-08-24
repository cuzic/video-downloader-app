import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Settings table schema for storing application settings
 */
export const settings = sqliteTable('settings', {
  // Primary key
  key: text('key').primaryKey(),

  // Setting value (can be JSON)
  value: text('value').notNull(),

  // Value type for validation
  type: text('type', {
    enum: ['string', 'number', 'boolean', 'array', 'object', 'null'],
  }),

  // Optional description
  description: text('description'),

  // Last update timestamp
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),

  // Who updated this setting
  updatedBy: text('updated_by'),
});

// Type exports for TypeScript
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
