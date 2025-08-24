import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { tasks } from './tasks';

/**
 * History table schema for storing download history and events
 */
export const history = sqliteTable('history', {
  // Auto-incrementing primary key
  id: integer('id').primaryKey({ autoIncrement: true }),

  // Foreign key to tasks table
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),

  // Event type
  event: text('event', {
    enum: [
      'created',
      'started',
      'paused',
      'resumed',
      'completed',
      'failed',
      'canceled',
      'progress',
      'error',
    ],
  }).notNull(),

  // Event details (JSON)
  details: text('details', { mode: 'json' }),

  // Timestamp
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Type exports for TypeScript
export type HistoryEntry = typeof history.$inferSelect;
export type NewHistoryEntry = typeof history.$inferInsert;
