import { db } from '../client';
import { segments } from '../schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { Segment, NewSegment } from '../schema/segments';

export class SegmentRepository {
  async createBatch(taskId: string, segmentData: Omit<NewSegment, 'taskId'>[]): Promise<void> {
    const values = segmentData.map(s => ({
      ...s,
      taskId,
    }));
    
    await db.insert(segments).values(values);
  }

  async updateStatus(
    taskId: string,
    segmentIndex: number,
    status: Segment['status'],
    errorMessage?: string
  ): Promise<void> {
    const updates: Partial<Segment> = { status };
    
    if (status === 'completed') {
      updates.downloadedAt = Math.floor(Date.now() / 1000);
    }
    
    if (errorMessage) {
      updates.errorMessage = errorMessage;
      updates.retryCount = sql`${segments.retryCount} + 1`;
    }
    
    await db.update(segments)
      .set(updates)
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.segmentIndex, segmentIndex)
      ));
  }

  async getByTask(taskId: string): Promise<Segment[]> {
    return db.select()
      .from(segments)
      .where(eq(segments.taskId, taskId))
      .orderBy(segments.segmentIndex);
  }

  async getPendingByTask(taskId: string): Promise<Segment[]> {
    return db.select()
      .from(segments)
      .where(and(
        eq(segments.taskId, taskId),
        inArray(segments.status, ['pending', 'downloading'])
      ))
      .orderBy(segments.segmentIndex);
  }

  async getFailedByTask(taskId: string): Promise<Segment[]> {
    return db.select()
      .from(segments)
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.status, 'error')
      ))
      .orderBy(segments.segmentIndex);
  }

  async getProgress(taskId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
  }> {
    const result = await db.select({
      status: segments.status,
      count: sql<number>`count(*)`,
    })
    .from(segments)
    .where(eq(segments.taskId, taskId))
    .groupBy(segments.status);
    
    const progress = {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
    };
    
    for (const row of result) {
      progress.total += row.count;
      switch (row.status) {
        case 'completed':
          progress.completed = row.count;
          break;
        case 'error':
          progress.failed = row.count;
          break;
        case 'pending':
        case 'downloading':
          progress.pending += row.count;
          break;
      }
    }
    
    return progress;
  }

  async markCompleted(taskId: string, segmentIndex: number, tempPath: string): Promise<void> {
    await db.update(segments)
      .set({
        status: 'completed',
        tempPath,
        downloadedAt: Math.floor(Date.now() / 1000),
      })
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.segmentIndex, segmentIndex)
      ));
  }

  async markFailed(
    taskId: string,
    segmentIndex: number,
    errorMessage: string
  ): Promise<void> {
    await db.update(segments)
      .set({
        status: 'error',
        errorMessage,
        retryCount: sql`${segments.retryCount} + 1`,
      })
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.segmentIndex, segmentIndex)
      ));
  }

  async resetFailed(taskId: string): Promise<void> {
    await db.update(segments)
      .set({
        status: 'pending',
        errorMessage: null,
      })
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.status, 'error')
      ));
  }

  async cleanup(taskId: string): Promise<void> {
    await db.delete(segments)
      .where(eq(segments.taskId, taskId));
  }

  async getNextPending(taskId: string): Promise<Segment | null> {
    const result = await db.select()
      .from(segments)
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.status, 'pending')
      ))
      .orderBy(segments.segmentIndex)
      .limit(1);
    
    if (result[0]) {
      // Mark as downloading
      await this.updateStatus(taskId, result[0].segmentIndex, 'downloading');
    }
    
    return result[0] ?? null;
  }
}