import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Tasks table schema for storing download tasks
 */
export const tasks = sqliteTable('tasks', {
  // Primary key
  id: text('id').primaryKey(),
  
  // URL and media information
  url: text('url').notNull(),
  mediaType: text('media_type', { 
    enum: ['hls', 'dash', 'file'] 
  }).notNull(),
  
  // File information
  filename: text('filename'),
  saveDir: text('save_dir'),
  fileSize: integer('file_size'),
  
  // Task status
  status: text('status', {
    enum: ['queued', 'running', 'paused', 'completed', 'failed', 'canceled', 'error']
  }).notNull().default('queued'),
  
  // Progress tracking
  progress: real('progress').default(0),
  percent: real('percent').default(0),
  speedBps: integer('speed_bps'),
  downloadedBytes: integer('downloaded_bytes').default(0),
  totalBytes: integer('total_bytes'),
  etaMs: integer('eta_ms'),
  
  // Error handling
  error: text('error'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  errorDetails: text('error_details'),
  retryCount: integer('retry_count').notNull().default(0),
  
  // Request configuration
  headers: text('headers'),
  variant: text('variant'),
  qualityRule: text('quality_rule'),
  
  // Task priority
  priority: integer('priority').notNull().default(0),
  
  // Metadata storage (JSON)
  metadata: text('metadata', { mode: 'json' }),
  
  // Timestamps (stored as UNIX timestamps in seconds)
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  pausedAt: integer('paused_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Type exports for TypeScript
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;