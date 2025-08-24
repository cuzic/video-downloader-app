import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const statistics = sqliteTable('statistics', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  totalDownloads: integer('total_downloads').notNull().default(0),
  completedCount: integer('completed_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  canceledCount: integer('canceled_count').notNull().default(0),
  totalBytes: integer('total_bytes').notNull().default(0),
  totalTimeMs: integer('total_time_ms').notNull().default(0),
  averageSpeedBps: real('average_speed_bps').notNull().default(0),
});

export const statisticsDomains = sqliteTable(
  'statistics_domains',
  {
    date: text('date')
      .notNull()
      .references(() => statistics.date, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    count: integer('count').notNull().default(0),
    bytes: integer('bytes').notNull().default(0),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.date, table.domain] }),
    };
  }
);

export const statisticsMediaTypes = sqliteTable(
  'statistics_media_types',
  {
    date: text('date')
      .notNull()
      .references(() => statistics.date, { onDelete: 'cascade' }),
    mediaType: text('media_type', {
      enum: ['hls', 'dash', 'file'],
    }).notNull(),
    count: integer('count').notNull().default(0),
    bytes: integer('bytes').notNull().default(0),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.date, table.mediaType] }),
    };
  }
);

export type Statistics = typeof statistics.$inferSelect;
export type NewStatistics = typeof statistics.$inferInsert;
export type StatisticsDomain = typeof statisticsDomains.$inferSelect;
export type StatisticsMediaType = typeof statisticsMediaTypes.$inferSelect;
