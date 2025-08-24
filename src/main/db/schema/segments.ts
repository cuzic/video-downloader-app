import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { tasks } from './tasks';

export const segments = sqliteTable(
  'segments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),

    // Segment information
    segmentIndex: integer('segment_index').notNull(),
    url: text('url').notNull(),
    durationSec: real('duration_sec'),
    sizeBytes: integer('size_bytes'),

    // Status
    status: text('status', {
      enum: ['pending', 'downloading', 'completed', 'error'],
    })
      .notNull()
      .default('pending'),
    retryCount: integer('retry_count').notNull().default(0),

    // File information
    tempPath: text('temp_path'),
    errorMessage: text('error_message'),

    // Timestamps
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    downloadedAt: integer('downloaded_at'),
  },
  (table) => {
    return {
      taskSegmentUnique: primaryKey({ columns: [table.taskId, table.segmentIndex] }),
    };
  }
);

export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
