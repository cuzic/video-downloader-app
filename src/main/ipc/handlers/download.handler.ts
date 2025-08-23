import { IpcMainInvokeEvent } from 'electron';
import { TaskRepository } from '../../db/repositories/task.repository';
import type { DownloadSpec, DownloadTaskDTO } from '@/shared/types';

const taskRepo = new TaskRepository();

export const downloadHandlers = [
  {
    channel: 'app:download:start',
    handler: async (_event: IpcMainInvokeEvent, spec: DownloadSpec): Promise<{ id: string }> => {
      const id = await taskRepo.create(spec);
      // TODO: Start actual download process
      return { id };
    },
  },
  {
    channel: 'app:download:pause',
    handler: async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      await taskRepo.pause(taskId);
      // TODO: Pause actual download
    },
  },
  {
    channel: 'app:download:resume',
    handler: async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      await taskRepo.resume(taskId);
      // TODO: Resume actual download
    },
  },
  {
    channel: 'app:download:cancel',
    handler: async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      await taskRepo.cancel(taskId);
      // TODO: Cancel actual download
    },
  },
  {
    channel: 'app:download:retry',
    handler: async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      await taskRepo.retry(taskId);
      // TODO: Restart download
    },
  },
  {
    channel: 'app:download:list',
    handler: async (_event: IpcMainInvokeEvent): Promise<DownloadTaskDTO[]> => {
      const tasks = await taskRepo.getAll();
      // Convert to DTOs
      return tasks.map(task => ({
        id: task.id,
        spec: {
          url: task.url,
          type: task.mediaType as any,
          filename: task.filename || undefined,
          saveDir: task.saveDir,
          headers: task.headers ? JSON.parse(task.headers) : undefined,
          variant: task.variant ? JSON.parse(task.variant) : undefined,
          retry: undefined, // TODO: Parse from task
          priority: task.priority,
          qualityRule: task.qualityRule ? JSON.parse(task.qualityRule) : undefined,
          metadata: task.metadata ? JSON.parse(task.metadata) : undefined,
        },
        status: task.status as any,
        progress: {
          percent: task.percent || undefined,
          downloadedBytes: task.downloadedBytes,
          totalBytes: task.totalBytes || undefined,
          speedBps: task.speedBps || undefined,
          etaMs: task.etaMs || undefined,
        },
        error: task.errorCode ? {
          code: task.errorCode,
          message: task.errorMessage || '',
          details: task.errorDetails ? JSON.parse(task.errorDetails) : undefined,
          retryable: true,
          attempt: task.retryCount,
        } : undefined,
        createdAt: new Date(task.createdAt * 1000).toISOString(),
        startedAt: task.startedAt ? new Date(task.startedAt * 1000).toISOString() : undefined,
        pausedAt: task.pausedAt ? new Date(task.pausedAt * 1000).toISOString() : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt * 1000).toISOString() : undefined,
        outputPath: task.outputPath || undefined,
      }));
    },
  },
  {
    channel: 'app:download:get',
    handler: async (_event: IpcMainInvokeEvent, taskId: string): Promise<DownloadTaskDTO | null> => {
      const task = await taskRepo.getById(taskId);
      if (!task) return null;
      
      // Convert to DTO
      return {
        id: task.id,
        spec: {
          url: task.url,
          type: task.mediaType as any,
          filename: task.filename || undefined,
          saveDir: task.saveDir,
          headers: task.headers ? JSON.parse(task.headers) : undefined,
          variant: task.variant ? JSON.parse(task.variant) : undefined,
          retry: undefined,
          priority: task.priority,
          qualityRule: task.qualityRule ? JSON.parse(task.qualityRule) : undefined,
          metadata: task.metadata ? JSON.parse(task.metadata) : undefined,
        },
        status: task.status as any,
        progress: {
          percent: task.percent || undefined,
          downloadedBytes: task.downloadedBytes,
          totalBytes: task.totalBytes || undefined,
          speedBps: task.speedBps || undefined,
          etaMs: task.etaMs || undefined,
        },
        error: task.errorCode ? {
          code: task.errorCode,
          message: task.errorMessage || '',
          details: task.errorDetails ? JSON.parse(task.errorDetails) : undefined,
          retryable: true,
          attempt: task.retryCount,
        } : undefined,
        createdAt: new Date(task.createdAt * 1000).toISOString(),
        startedAt: task.startedAt ? new Date(task.startedAt * 1000).toISOString() : undefined,
        pausedAt: task.pausedAt ? new Date(task.pausedAt * 1000).toISOString() : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt * 1000).toISOString() : undefined,
        outputPath: task.outputPath || undefined,
      };
    },
  },
];