import { db } from '../client';
import { tasks } from '../schema';
import { eq, inArray, desc, and, sql } from 'drizzle-orm';
import type { Task, NewTask } from '../schema/tasks';
import type { DownloadSpec, DownloadProgress } from '@/shared/types';

export class TaskRepository {
  async create(spec: DownloadSpec): Promise<string> {
    const id = crypto.randomUUID();
    
    await db.insert(tasks).values({
      id,
      url: spec.url,
      mediaType: spec.type,
      filename: spec.filename,
      saveDir: spec.saveDir,
      headers: spec.headers ? JSON.stringify(spec.headers) : null,
      variant: spec.variant ? JSON.stringify(spec.variant) : null,
      qualityRule: spec.qualityRule ? JSON.stringify(spec.qualityRule) : null,
      metadata: spec.metadata ? JSON.stringify(spec.metadata) : null,
      priority: spec.priority ?? 0,
    });
    
    return id;
  }

  async updateProgress(taskId: string, progress: DownloadProgress): Promise<void> {
    await db.update(tasks)
      .set({
        downloadedBytes: progress.downloadedBytes,
        totalBytes: progress.totalBytes,
        speedBps: progress.speedBps,
        percent: progress.percent,
        etaMs: progress.etaMs,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(tasks.id, taskId));
  }

  async updateStatus(
    taskId: string, 
    status: Task['status'],
    error?: { code: string; message: string; details?: any }
  ): Promise<void> {
    const updates: Partial<Task> = { 
      status,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    // Update timestamps based on status
    const now = Math.floor(Date.now() / 1000);
    switch (status) {
      case 'running':
        updates.startedAt = now;
        break;
      case 'paused':
        updates.pausedAt = now;
        break;
      case 'completed':
        updates.completedAt = now;
        break;
      case 'error':
        if (error) {
          updates.errorCode = error.code;
          updates.errorMessage = error.message;
          updates.errorDetails = error.details ? JSON.stringify(error.details) : null;
        }
        break;
    }

    await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
  }

  async getById(taskId: string): Promise<Task | null> {
    const result = await db.select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    
    return result[0] ?? null;
  }

  async listActive(): Promise<Task[]> {
    return db.select()
      .from(tasks)
      .where(inArray(tasks.status, ['running', 'paused', 'queued']))
      .orderBy(desc(tasks.priority), tasks.createdAt);
  }

  async getNextQueued(): Promise<Task | null> {
    const result = await db.select()
      .from(tasks)
      .where(eq(tasks.status, 'queued'))
      .orderBy(desc(tasks.priority), tasks.createdAt)
      .limit(1);
    
    return result[0] ?? null;
  }

  async getAll(limit = 100, offset = 0): Promise<Task[]> {
    return db.select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async pause(taskId: string): Promise<void> {
    await this.updateStatus(taskId, 'paused');
  }

  async resume(taskId: string): Promise<void> {
    await this.updateStatus(taskId, 'queued');
  }

  async cancel(taskId: string): Promise<void> {
    await this.updateStatus(taskId, 'canceled');
  }

  async retry(taskId: string): Promise<void> {
    await db.update(tasks)
      .set({
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        errorDetails: null,
        retryCount: sql`${tasks.retryCount} + 1`,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(tasks.id, taskId));
  }

  async cleanup(daysOld: number = 30): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);
    
    const result = await db.delete(tasks)
      .where(and(
        eq(tasks.status, 'completed'),
        sql`${tasks.completedAt} < ${cutoff}`
      ));
    
    return result.changes;
  }
}