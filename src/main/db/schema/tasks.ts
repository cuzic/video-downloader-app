import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tasks = sqliteTable('tasks', {
  // Primary key
  id: text('id').primaryKey(),  // UUID v4
  
  // Basic information
  url: text('url').notNull(),
  mediaType: text('media_type', { 
    enum: ['hls', 'dash', 'file'] 
  }).notNull(),
  filename: text('filename'),
  saveDir: text('save_dir').notNull(),
  outputPath: text('output_path'),
  
  // Status
  status: text('status', { 
    enum: ['queued', 'running', 'paused', 'completed', 'error', 'canceled'] 
  }).notNull().default('queued'),
  priority: integer('priority').notNull().default(0),
  
  // Progress
  downloadedBytes: integer('downloaded_bytes').notNull().default(0),
  totalBytes: integer('total_bytes'),
  speedBps: real('speed_bps'),  // Bytes per second
  percent: real('percent'),      // 0-100
  etaMs: integer('eta_ms'),      // Estimated time in milliseconds
  
  // Error information
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  errorDetails: text('error_details'),  // JSON string
  retryCount: integer('retry_count').notNull().default(0),
  
  // Metadata
  pageUrl: text('page_url'),
  pageTitle: text('page_title'),
  thumbnailUrl: text('thumbnail_url'),
  durationSec: real('duration_sec'),
  headers: text('headers'),        // JSON string
  variant: text('variant'),        // JSON string (VideoVariant)
  qualityRule: text('quality_rule'), // JSON string (CustomQualityRule)
  metadata: text('metadata'),      // JSON string (arbitrary metadata)
  
  // Timestamps (UNIX seconds)
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`),
  startedAt: integer('started_at'),
  pausedAt: integer('paused_at'),
  completedAt: integer('completed_at'),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`),
});

// TypeScript type inference
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;