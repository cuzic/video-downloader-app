import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const detections = sqliteTable('detections', {
  id: text('id').primaryKey(), // dedupKey
  url: text('url').notNull(),
  mediaType: text('media_type', {
    enum: ['hls', 'dash', 'file'],
  }).notNull(),
  pageUrl: text('page_url'),
  pageTitle: text('page_title'),
  thumbnailUrl: text('thumbnail_url'),
  durationSec: real('duration_sec'),
  fileSizeBytes: integer('file_size_bytes'),
  variants: text('variants'), // JSON string (VideoVariant[])
  headers: text('headers'), // JSON string
  skipReason: text('skip_reason', {
    enum: ['drm', '403', 'cors', 'mime-mismatch', 'widevine-hint', 'live'],
  }),
  detectedAt: integer('detected_at')
    .notNull()
    .default(sql`(unixepoch())`),
  lastSeenAt: integer('last_seen_at')
    .notNull()
    .default(sql`(unixepoch())`),
  downloadCount: integer('download_count').notNull().default(0),
  autoDelete: integer('auto_delete').notNull().default(0), // 0/1 as boolean
});

export type Detection = typeof detections.$inferSelect;
export type NewDetection = typeof detections.$inferInsert;
