import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { downloadHandlers } from '../download.handler';
import { DOWNLOAD_CHANNELS } from '@/shared/constants/channels';
import type { DownloadSpec } from '@/shared/types';

// Mock the repository factory
vi.mock('../../../db/repositories', () => ({
  RepositoryFactory: {
    createTaskRepository: vi.fn(() => ({
      create: vi.fn().mockResolvedValue('test-task-id'),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    })),
    createAuditLogRepository: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      logDownloadEvent: vi.fn(),
    })),
  },
  // Default repository instances
  auditLogRepo: {
    error: vi.fn(),
    info: vi.fn(),
    logDownloadEvent: vi.fn(),
  },
}));

// Mock the broadcast utility
vi.mock('../../utils/performance', () => ({
  broadcast: vi.fn(),
}));

describe('Download Handlers', () => {
  let mockEvent: IpcMainInvokeEvent;

  beforeEach(() => {
    mockEvent = {
      sender: {
        send: vi.fn(),
      },
    } as unknown as IpcMainInvokeEvent;

    vi.clearAllMocks();
  });

  describe('START handler', () => {
    const startHandler = downloadHandlers.find((h) => h.channel === DOWNLOAD_CHANNELS.START);
    if (!startHandler) throw new Error('START handler not found');

    it('should start a new download', async () => {
      const spec: DownloadSpec = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        filename: 'video.mp4',
        saveDir: '/downloads',
      };

      const result = await startHandler.handler(mockEvent, spec as any);

      expect(result).toEqual({ id: 'test-task-id' });
    });

    it('should validate required spec parameter', async () => {
      await expect(startHandler.handler(mockEvent, undefined as any)).rejects.toThrow(
        'spec is required'
      );
    });
  });

  describe('PAUSE handler', () => {
    const pauseHandler = downloadHandlers.find((h) => h.channel === DOWNLOAD_CHANNELS.PAUSE);
    if (!pauseHandler) throw new Error('PAUSE handler not found');

    it('should pause a download', async () => {
      await pauseHandler.handler(mockEvent, 'test-task-id' as any);

      const { broadcast } = await import('../../utils/performance');
      expect(broadcast).toHaveBeenCalledWith(DOWNLOAD_CHANNELS.ON_PAUSED, {
        taskId: 'test-task-id',
      });
    });

    it('should validate taskId parameter', async () => {
      await expect(pauseHandler.handler(mockEvent, undefined as any)).rejects.toThrow(
        'taskId is required'
      );
    });
  });

  describe('RESUME handler', () => {
    const resumeHandler = downloadHandlers.find((h) => h.channel === DOWNLOAD_CHANNELS.RESUME);
    if (!resumeHandler) throw new Error('RESUME handler not found');

    it('should resume a download', async () => {
      await resumeHandler.handler(mockEvent, 'test-task-id' as any);

      const { broadcast } = await import('../../utils/performance');
      expect(broadcast).toHaveBeenCalledWith(DOWNLOAD_CHANNELS.ON_RESUMED, {
        taskId: 'test-task-id',
      });
    });
  });

  describe('CANCEL handler', () => {
    const cancelHandler = downloadHandlers.find((h) => h.channel === DOWNLOAD_CHANNELS.CANCEL);
    if (!cancelHandler) throw new Error('CANCEL handler not found');

    it('should cancel a download', async () => {
      await cancelHandler.handler(mockEvent, 'test-task-id' as any);

      const { broadcast } = await import('../../utils/performance');
      expect(broadcast).toHaveBeenCalledWith(DOWNLOAD_CHANNELS.ON_CANCELED, {
        taskId: 'test-task-id',
      });
    });
  });

  describe('LIST_TASKS handler', () => {
    const listHandler = downloadHandlers.find((h) => h.channel === DOWNLOAD_CHANNELS.LIST_TASKS);
    if (!listHandler) throw new Error('LIST_TASKS handler not found');

    it('should return empty array when no tasks', async () => {
      const result = await listHandler.handler(mockEvent, undefined as any);
      expect(result).toEqual([]);
    });
  });
});
