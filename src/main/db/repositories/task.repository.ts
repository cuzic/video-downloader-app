import { db } from '../client';
import { tasks } from '../schema';
import { eq, inArray, desc, and, sql } from 'drizzle-orm';
import type { Task } from '../schema/tasks';
import type { DownloadSpec, DownloadProgress } from '@/shared/types';
import { validateDownloadSpec } from '../validation';
import { AuditLogRepository } from './audit-log.repository';

export class TaskCreateError extends Error {
  constructor(
    message: string,
    public cause?: any
  ) {
    super(message);
    this.name = 'TaskCreateError';
  }
}

export class TaskUpdateError extends Error {
  constructor(
    message: string,
    public cause?: any
  ) {
    super(message);
    this.name = 'TaskUpdateError';
  }
}

export class TaskRepository {
  private defaultSaveDir?: string;
  private auditLogRepo: AuditLogRepository;

  constructor(defaultSaveDir?: string) {
    this.defaultSaveDir = defaultSaveDir;
    this.auditLogRepo = new AuditLogRepository();
  }

  async create(spec: DownloadSpec): Promise<string> {
    try {
      // Validate input
      const validatedSpec = validateDownloadSpec(spec);
      const id = crypto.randomUUID();

      // Use provided default or spec's saveDir
      let saveDir = validatedSpec.saveDir;
      if (!saveDir) {
        if (this.defaultSaveDir) {
          saveDir = this.defaultSaveDir;
        } else {
          // Only import electron if absolutely necessary
          const { app } = await import('electron');
          saveDir = app.getPath('downloads');
        }
      }

      await db.insert(tasks).values({
        id,
        url: validatedSpec.url,
        mediaType: validatedSpec.type,
        filename: validatedSpec.filename ?? null,
        saveDir,
        headers: validatedSpec.headers ? JSON.stringify(validatedSpec.headers) : null,
        variant: validatedSpec.variant ? JSON.stringify(validatedSpec.variant) : null,
        qualityRule: validatedSpec.qualityRule ? JSON.stringify(validatedSpec.qualityRule) : null,
        metadata: validatedSpec.metadata ? JSON.stringify(validatedSpec.metadata) : null,
        priority: validatedSpec.priority ?? 0,
      });

      await this.auditLogRepo.logDownloadEvent(id, 'task_created', { url: validatedSpec.url });
      return id;
    } catch (error) {
      await this.auditLogRepo.error('task', 'creation_failed', error, spec);
      throw new TaskCreateError('Failed to create task', error);
    }
  }

  async updateProgress(taskId: string, progress: DownloadProgress): Promise<void> {
    try {
      await db
        .update(tasks)
        .set({
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
          speedBps: progress.speedBps,
          percent: progress.percent,
          etaMs: progress.etaMs,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    } catch (error) {
      await this.auditLogRepo.error('task', 'progress_update_failed', error, { taskId, progress });
      throw new TaskUpdateError('Failed to update task progress', error);
    }
  }

  async updateStatus(
    taskId: string,
    status: Task['status'],
    error?: { code: string; message: string; details?: any }
  ): Promise<void> {
    const updates: Partial<Task> = {
      status,
      updatedAt: new Date(),
    };

    // Update timestamps based on status
    const now = new Date();
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
    const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

    return result[0] ?? null;
  }

  async listActive(): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(inArray(tasks.status, ['running', 'paused', 'queued']))
      .orderBy(desc(tasks.priority), tasks.createdAt);
  }

  async getNextQueued(): Promise<Task | null> {
    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, 'queued'))
      .orderBy(desc(tasks.priority), tasks.createdAt)
      .limit(1);

    return result[0] ?? null;
  }

  async getAll(limit = 100, offset = 0): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(limit).offset(offset);
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
    await db
      .update(tasks)
      .set({
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        errorDetails: null,
        retryCount: sql`${tasks.retryCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  }

  async cleanup(daysOld: number = 30): Promise<number> {
    const cutoff = Math.floor(Date.now() / 1000) - daysOld * 24 * 60 * 60;

    const result = await db
      .delete(tasks)
      .where(and(eq(tasks.status, 'completed'), sql`${tasks.completedAt} < ${cutoff}`));

    return result.changes;
  }
}
