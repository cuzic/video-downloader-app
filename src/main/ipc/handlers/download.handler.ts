import type { IpcMainInvokeEvent } from 'electron';
import type { DownloadSpec, DownloadTaskDTO } from '@/shared/types';
import type { DownloadStartResponse } from '@/shared/types/ipc.types';
import { DOWNLOAD_CHANNELS } from '@/shared/constants/channels';
import { wrapHandler, validateRequired } from '../utils/error-handler';
import { broadcast } from '../utils/performance';
import { RepositoryFactory } from '../../db/repositories';
import type { TaskRepository } from '../../db/repositories/task.repository';

// Lazy initialization to avoid issues during testing
let taskRepo: TaskRepository | null = null;

function getTaskRepo(): TaskRepository {
  if (!taskRepo) {
    taskRepo = RepositoryFactory.createTaskRepository();
  }
  return taskRepo;
}

// Helper function for safe JSON parsing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJsonParse<T = any>(str: string | null | undefined): T | undefined {
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

export const downloadHandlers = [
  {
    channel: DOWNLOAD_CHANNELS.START,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, spec: DownloadSpec): Promise<DownloadStartResponse> => {
      validateRequired({ spec }, ['spec']);
      const id = await getTaskRepo().create(spec);
      
      // Emit start event
      broadcast(DOWNLOAD_CHANNELS.ON_STARTED, { taskId: id });
      
      // TODO: Start actual download process
      return { id };
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.PAUSE,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await getTaskRepo().pause(taskId);
      
      // Emit pause event
      broadcast(DOWNLOAD_CHANNELS.ON_PAUSED, { taskId });
      
      // TODO: Pause actual download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.RESUME,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await getTaskRepo().resume(taskId);
      
      // Emit resume event
      broadcast(DOWNLOAD_CHANNELS.ON_RESUMED, { taskId });
      
      // TODO: Resume actual download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.CANCEL,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await getTaskRepo().cancel(taskId);
      
      // Emit cancel event
      broadcast(DOWNLOAD_CHANNELS.ON_CANCELED, { taskId });
      
      // TODO: Cancel actual download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.RETRY,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await getTaskRepo().retry(taskId);
      
      // Emit start event
      broadcast(DOWNLOAD_CHANNELS.ON_STARTED, { taskId });
      
      // TODO: Restart download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.LIST_TASKS,
    handler: async (_event: IpcMainInvokeEvent): Promise<DownloadTaskDTO[]> => {
      const tasks = await getTaskRepo().getAll();
      // Convert to DTOs
      return tasks.map(task => ({
        id: task.id,
        spec: {
          url: task.url,
          type: task.mediaType as any,
          filename: task.filename || undefined,
          saveDir: task.saveDir || undefined,
          headers: safeJsonParse(task.headers),
          variant: safeJsonParse(task.variant),
          retry: undefined, // TODO: Parse from task
          priority: task.priority,
          qualityRule: safeJsonParse(task.qualityRule),
          metadata: task.metadata || undefined,
        },
        status: task.status as DownloadTaskDTO['status'],
        progress: {
          percent: task.percent || undefined,
          downloadedBytes: task.downloadedBytes || 0,
          totalBytes: task.totalBytes || undefined,
          speedBps: task.speedBps || undefined,
          etaMs: task.etaMs || undefined,
        },
        error: task.errorCode ? {
          code: task.errorCode,
          message: task.errorMessage || '',
          details: safeJsonParse(task.errorDetails),
          retryable: true,
          attempt: task.retryCount,
        } : undefined,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt ? task.startedAt.toISOString() : undefined,
        pausedAt: task.pausedAt ? task.pausedAt.toISOString() : undefined,
        completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
      }));
    },
  },
  {
    channel: 'app:download:get',
    handler: async (_event: IpcMainInvokeEvent, taskId: string): Promise<DownloadTaskDTO | null> => {
      const task = await getTaskRepo().getById(taskId);
      if (!task) return null;
      
      // Convert to DTO
      return {
        id: task.id,
        spec: {
          url: task.url,
          type: task.mediaType as any,
          filename: task.filename || undefined,
          saveDir: task.saveDir || undefined,
          headers: safeJsonParse(task.headers),
          variant: safeJsonParse(task.variant),
          retry: undefined,
          priority: task.priority,
          qualityRule: safeJsonParse(task.qualityRule),
          metadata: task.metadata || undefined,
        },
        status: task.status as DownloadTaskDTO['status'],
        progress: {
          percent: task.percent || undefined,
          downloadedBytes: task.downloadedBytes || 0,
          totalBytes: task.totalBytes || undefined,
          speedBps: task.speedBps || undefined,
          etaMs: task.etaMs || undefined,
        },
        error: task.errorCode ? {
          code: task.errorCode,
          message: task.errorMessage || '',
          details: safeJsonParse(task.errorDetails),
          retryable: true,
          attempt: task.retryCount,
        } : undefined,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt ? task.startedAt.toISOString() : undefined,
        pausedAt: task.pausedAt ? task.pausedAt.toISOString() : undefined,
        completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
      };
    },
  },
];