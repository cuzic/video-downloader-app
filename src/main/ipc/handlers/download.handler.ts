import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { TaskRepository } from '../../db/repositories/task.repository';
import type { DownloadSpec, DownloadTaskDTO, DownloadTask } from '@/shared/types';
import type { DownloadStartResponse, DownloadListResponse } from '@/shared/types/ipc.types';
import { DOWNLOAD_CHANNELS } from '@/shared/constants/channels';
import { wrapHandler, validateRequired } from '../utils/error-handler';
import { ProgressReporter, broadcast } from '../utils/performance';
import { RepositoryFactory } from '../../db/repositories';

const taskRepo = RepositoryFactory.createTaskRepository();

export const downloadHandlers = [
  {
    channel: DOWNLOAD_CHANNELS.START,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, spec: DownloadSpec): Promise<DownloadStartResponse> => {
      validateRequired({ spec }, ['spec']);
      const id = await taskRepo.create(spec);
      
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
      await taskRepo.pause(taskId);
      
      // Emit pause event
      broadcast(DOWNLOAD_CHANNELS.ON_PAUSED, { taskId });
      
      // TODO: Pause actual download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.RESUME,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await taskRepo.resume(taskId);
      
      // Emit resume event
      broadcast(DOWNLOAD_CHANNELS.ON_RESUMED, { taskId });
      
      // TODO: Resume actual download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.CANCEL,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await taskRepo.cancel(taskId);
      
      // Emit cancel event
      broadcast(DOWNLOAD_CHANNELS.ON_CANCELED, { taskId });
      
      // TODO: Cancel actual download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.RETRY,
    handler: wrapHandler(async (_event: IpcMainInvokeEvent, taskId: string): Promise<void> => {
      validateRequired({ taskId }, ['taskId']);
      await taskRepo.retry(taskId);
      
      // Emit start event
      broadcast(DOWNLOAD_CHANNELS.ON_STARTED, { taskId });
      
      // TODO: Restart download
    }),
  },
  {
    channel: DOWNLOAD_CHANNELS.LIST_TASKS,
    handler: async (_event: IpcMainInvokeEvent): Promise<DownloadTaskDTO[]> => {
      const tasks = await taskRepo.getAll();
      // Convert to DTOs
      return tasks.map(task => ({
        id: task.id,
        spec: {
          url: task.url,
          type: task.mediaType as any,
          filename: task.filename || undefined,
          saveDir: task.saveDir || undefined,
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
      const task = await taskRepo.getById(taskId);
      if (!task) return null;
      
      // Convert to DTO
      return {
        id: task.id,
        spec: {
          url: task.url,
          type: task.mediaType as any,
          filename: task.filename || undefined,
          saveDir: task.saveDir || undefined,
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
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt ? task.startedAt.toISOString() : undefined,
        pausedAt: task.pausedAt ? task.pausedAt.toISOString() : undefined,
        completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
      };
    },
  },
];