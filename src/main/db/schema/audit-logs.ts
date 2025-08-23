import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull().default(sql`(strftime('%s','now'))`),
  level: text('level', { 
    enum: ['debug', 'info', 'warn', 'error'] 
  }).notNull(),
  category: text('category').notNull(),  // 'download', 'detection', 'settings', 'security'
  event: text('event').notNull(),
  message: text('message'),
  taskId: text('task_id'),
  userId: text('user_id'),
  context: text('context'),  // JSON string
  errorCode: text('error_code'),
  errorStack: text('error_stack'),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;