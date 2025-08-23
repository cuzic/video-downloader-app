import { db } from '../client';
import { auditLogs } from '../schema';
import { eq, desc, and, gte, lte, inArray, sql } from 'drizzle-orm';
import type { AuditLog, NewAuditLog } from '../schema/audit-logs';

export class AuditLogRepository {
  async log(
    level: AuditLog['level'],
    category: string,
    event: string,
    message?: string,
    context?: any,
    taskId?: string,
    userId?: string,
    error?: { code?: string; stack?: string }
  ): Promise<void> {
    const entry: NewAuditLog = {
      level,
      category,
      event,
      message,
      taskId,
      userId,
      context: context ? JSON.stringify(context) : undefined,
      errorCode: error?.code,
      errorStack: error?.stack,
    };
    
    await db.insert(auditLogs).values(entry);
  }

  // Convenience methods for different log levels
  async debug(category: string, event: string, message?: string, context?: any): Promise<void> {
    await this.log('debug', category, event, message, context);
  }

  async info(category: string, event: string, message?: string, context?: any, userId?: string): Promise<void> {
    await this.log('info', category, event, message, context, undefined, userId);
  }

  async warn(category: string, event: string, message?: string, context?: any): Promise<void> {
    await this.log('warn', category, event, message, context);
  }

  async error(
    category: string,
    event: string,
    error: Error | any,
    context?: any,
    taskId?: string
  ): Promise<void> {
    await this.log(
      'error',
      category,
      event,
      error.message || String(error),
      context,
      taskId,
      undefined,
      {
        code: error.code,
        stack: error.stack,
      }
    );
  }

  // Query methods
  async getRecent(limit = 100): Promise<AuditLog[]> {
    return db.select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async getByLevel(level: AuditLog['level'], limit = 100): Promise<AuditLog[]> {
    return db.select()
      .from(auditLogs)
      .where(eq(auditLogs.level, level))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async getByCategory(category: string, limit = 100): Promise<AuditLog[]> {
    return db.select()
      .from(auditLogs)
      .where(eq(auditLogs.category, category))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async getByTask(taskId: string): Promise<AuditLog[]> {
    return db.select()
      .from(auditLogs)
      .where(eq(auditLogs.taskId, taskId))
      .orderBy(auditLogs.timestamp);
  }

  async getErrors(limit = 100): Promise<AuditLog[]> {
    return db.select()
      .from(auditLogs)
      .where(eq(auditLogs.level, 'error'))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async getInRange(startTime: number, endTime: number): Promise<AuditLog[]> {
    return db.select()
      .from(auditLogs)
      .where(and(
        gte(auditLogs.timestamp, startTime),
        lte(auditLogs.timestamp, endTime)
      ))
      .orderBy(auditLogs.timestamp);
  }

  async search(
    filters: {
      level?: AuditLog['level'] | AuditLog['level'][];
      category?: string;
      event?: string;
      taskId?: string;
      userId?: string;
      startTime?: number;
      endTime?: number;
    },
    limit = 100
  ): Promise<AuditLog[]> {
    const conditions = [];
    
    if (filters.level) {
      if (Array.isArray(filters.level)) {
        conditions.push(inArray(auditLogs.level, filters.level));
      } else {
        conditions.push(eq(auditLogs.level, filters.level));
      }
    }
    
    if (filters.category) {
      conditions.push(eq(auditLogs.category, filters.category));
    }
    
    if (filters.event) {
      conditions.push(eq(auditLogs.event, filters.event));
    }
    
    if (filters.taskId) {
      conditions.push(eq(auditLogs.taskId, filters.taskId));
    }
    
    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    
    if (filters.startTime) {
      conditions.push(gte(auditLogs.timestamp, filters.startTime));
    }
    
    if (filters.endTime) {
      conditions.push(lte(auditLogs.timestamp, filters.endTime));
    }
    
    let query = db.select().from(auditLogs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async cleanup(daysOld = 30): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);
    
    // Keep error logs longer (90 days)
    const errorCutoff = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);
    
    // Delete logs that are:
    // - Non-error logs older than cutoff, OR
    // - Error logs older than errorCutoff
    const result = await db.delete(auditLogs)
      .where(
        sql`(${auditLogs.level} != 'error' AND ${auditLogs.timestamp} < ${cutoff})
            OR (${auditLogs.level} = 'error' AND ${auditLogs.timestamp} < ${errorCutoff})`
      );
    
    return result.changes;
  }

  // Helper to log download events
  async logDownloadEvent(
    taskId: string,
    event: string,
    details?: any
  ): Promise<void> {
    await this.log('info', 'download', event, undefined, details, taskId);
  }

  // Helper to log detection events
  async logDetectionEvent(
    event: string,
    url: string,
    details?: any
  ): Promise<void> {
    await this.info('detection', event, url, details);
  }

  // Helper to log security events
  async logSecurityEvent(
    event: string,
    message: string,
    details?: any
  ): Promise<void> {
    await this.warn('security', event, message, details);
  }

  // Helper to log settings changes
  async logSettingsChange(
    key: string,
    oldValue: any,
    newValue: any,
    userId?: string
  ): Promise<void> {
    await this.info('settings', 'changed', `Setting ${key} changed`, {
      key,
      oldValue,
      newValue,
    }, userId);
  }
}