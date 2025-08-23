import { db } from '../client';
import { history } from '../schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import type { HistoryEntry, NewHistoryEntry } from '../schema/history';

export class HistoryRepository {
  async logEvent(entry: NewHistoryEntry): Promise<void> {
    await db.insert(history).values(entry);
  }

  async logTaskEvent(
    taskId: string,
    event: string,
    details?: any
  ): Promise<void> {
    await this.logEvent({
      taskId,
      event: event as any,
      details: details ? JSON.stringify(details) : null,
    });
  }

  async getTaskHistory(taskId: string): Promise<HistoryEntry[]> {
    return db.select()
      .from(history)
      .where(eq(history.taskId, taskId))
      .orderBy(history.createdAt);
  }

  async getRecentEvents(limit = 100): Promise<HistoryEntry[]> {
    return db.select()
      .from(history)
      .orderBy(desc(history.createdAt))
      .limit(limit);
  }

  async getEventsByType(
    event: string,
    limit = 100
  ): Promise<HistoryEntry[]> {
    return db.select()
      .from(history)
      .where(eq(history.event, event as any))
      .orderBy(desc(history.createdAt))
      .limit(limit);
  }

  async getEventsInRange(
    startTime: number,
    endTime: number
  ): Promise<HistoryEntry[]> {
    return db.select()
      .from(history)
      .where(and(
        gte(history.createdAt, new Date(startTime * 1000)),
        gte(new Date(endTime * 1000), history.createdAt)
      ))
      .orderBy(history.createdAt);
  }

  async cleanup(daysOld = 90): Promise<number> {
    const cutoff = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
    
    const result = await db.delete(history)
      .where(gte(cutoff, history.createdAt));
    
    return result.changes;
  }

  // Helper methods for common events
  async logCreated(taskId: string, url: string): Promise<void> {
    await this.logTaskEvent(taskId, 'created', { url });
  }

  async logStarted(taskId: string): Promise<void> {
    await this.logTaskEvent(taskId, 'started');
  }

  async logPaused(taskId: string): Promise<void> {
    await this.logTaskEvent(taskId, 'paused');
  }

  async logResumed(taskId: string): Promise<void> {
    await this.logTaskEvent(taskId, 'resumed');
  }

  async logCompleted(taskId: string, details?: any): Promise<void> {
    await this.logTaskEvent(taskId, 'completed', details);
  }

  async logFailed(taskId: string, error: any): Promise<void> {
    await this.logTaskEvent(taskId, 'failed', error);
  }

  async logCanceled(taskId: string): Promise<void> {
    await this.logTaskEvent(taskId, 'canceled');
  }

  async logProgress(taskId: string, progress: any): Promise<void> {
    await this.logTaskEvent(taskId, 'progress', progress);
  }

  async logError(taskId: string, error: any): Promise<void> {
    await this.logTaskEvent(taskId, 'error', error);
  }
}