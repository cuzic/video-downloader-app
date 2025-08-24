import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { downloadHandlers } from '../handlers/download.handler';
import { settingsHandlers } from '../handlers/settings.handler';
import { systemHandlers } from '../handlers/system.handler';
import { RepositoryFactory } from '../../db/repositories';
import type { DownloadSpec } from '@/shared/types';
import type { IpcHandler } from '../types';

// Mock Electron modules - uses centralized mock
vi.mock('electron');

// Mock repositories
vi.mock('../../db/repositories', () => ({
  RepositoryFactory: {
    createTaskRepository: vi.fn(),
    createSettingsRepository: vi.fn(),
    createDetectionRepository: vi.fn(),
    createAuditLogRepository: vi.fn(),
  },
  auditLogRepo: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

// Helper to extract handler with proper typing
function getHandler(
  handlers: Array<{ channel: string; handler: IpcHandler<any[], any> }>,
  channel: string
): IpcHandler<any[], any> {
  const handler = handlers.find((h) => h.channel === channel)?.handler;
  if (!handler) throw new Error(`Handler not found for channel: ${channel}`);
  return handler;
}

describe('Download Handlers', () => {
  let mockTaskRepo: {
    create: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };
  let mockEvent: IpcMainInvokeEvent;

  beforeEach(() => {
    mockTaskRepo = {
      create: vi.fn().mockResolvedValue('task-123'),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    };

    (RepositoryFactory.createTaskRepository as any).mockReturnValue(mockTaskRepo);
    mockEvent = {} as IpcMainInvokeEvent;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('START handler', () => {
    it('should create a new download task', async () => {
      const spec: DownloadSpec = {
        url: 'https://example.com/video.mp4',
        type: 'file' as any,
        saveDir: '/downloads',
      };

      const handler = getHandler(downloadHandlers, 'app:download:start');
      const result = await handler(mockEvent, spec);

      expect(mockTaskRepo.create).toHaveBeenCalledWith(spec);
      expect(result).toEqual({ id: 'task-123' });
    });

    it('should validate required fields', async () => {
      const handler = getHandler(downloadHandlers, 'app:download:start');

      await expect(handler(mockEvent, null)).rejects.toThrow();
    });
  });

  describe('PAUSE handler', () => {
    it('should pause a download task', async () => {
      const taskId = 'task-123';
      const handler = getHandler(downloadHandlers, 'app:download:pause');

      await handler(mockEvent, taskId);

      expect(mockTaskRepo.pause).toHaveBeenCalledWith(taskId);
    });

    it('should validate task ID', async () => {
      const handler = getHandler(downloadHandlers, 'app:download:pause');

      await expect(handler(mockEvent, null)).rejects.toThrow();
    });
  });

  describe('LIST_TASKS handler', () => {
    it('should return all tasks as DTOs', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          url: 'https://example.com/file1.mp4',
          mediaType: 'video',
          saveDir: '/downloads',
          status: 'downloading',
          downloadedBytes: 1024,
          createdAt: Date.now() / 1000,
          priority: 5,
        },
      ];

      mockTaskRepo.getAll.mockResolvedValue(mockTasks);

      const handler = getHandler(downloadHandlers, 'app:download:list');
      const result = await handler(mockEvent);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'task-1',
        spec: {
          url: 'https://example.com/file1.mp4',
          type: 'video',
          saveDir: '/downloads',
        },
        status: 'downloading',
      });
    });
  });
});

describe('Settings Handlers', () => {
  let mockSettingsRepo: any;
  let mockEvent: IpcMainInvokeEvent;

  beforeEach(() => {
    mockSettingsRepo = {
      get: vi.fn(),
      set: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    };

    (RepositoryFactory.createSettingsRepository as any).mockReturnValue(mockSettingsRepo);
    mockEvent = {} as IpcMainInvokeEvent;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET handler', () => {
    it('should get a setting value', async () => {
      mockSettingsRepo.get.mockResolvedValue({ key: 'theme', value: 'dark' });

      const handler = getHandler(settingsHandlers, 'app:settings:get');
      const result = await handler(mockEvent, 'theme');

      expect(mockSettingsRepo.get).toHaveBeenCalledWith('theme');
      expect(result).toBe('dark');
    });

    it('should return undefined for non-existent setting', async () => {
      mockSettingsRepo.get.mockResolvedValue(null);

      const handler = getHandler(settingsHandlers, 'app:settings:get');
      const result = await handler(mockEvent, 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('SET handler', () => {
    it('should set a setting value', async () => {
      const handler = getHandler(settingsHandlers, 'app:settings:set');
      await handler(mockEvent, 'theme', 'light');

      expect(mockSettingsRepo.set).toHaveBeenCalledWith('theme', 'light');
    });

    it('should validate required fields', async () => {
      const handler = getHandler(settingsHandlers, 'app:settings:set');

      await expect(handler(mockEvent, null, 'value')).rejects.toThrow();
    });
  });

  describe('GET_ALL handler', () => {
    it('should return all settings as AppSettings object', async () => {
      mockSettingsRepo.getAll.mockResolvedValue([
        { key: 'theme', value: 'dark' },
        { key: 'language', value: 'en' },
        { key: 'autoStart', value: true },
      ]);

      const handler = getHandler(settingsHandlers, 'app:settings:getAll');
      const result = await handler(mockEvent);

      expect(result).toEqual({
        theme: 'dark',
        language: 'en',
        autoStart: true,
      });
    });
  });

  describe('INITIALIZE handler', () => {
    it('should initialize default settings', async () => {
      mockSettingsRepo.get.mockResolvedValue(null);

      const handler = getHandler(settingsHandlers, 'app:settings:initialize');
      await handler(mockEvent);

      // Check that default settings were created
      expect(mockSettingsRepo.set).toHaveBeenCalledWith('theme', 'system');
      expect(mockSettingsRepo.set).toHaveBeenCalledWith('language', 'en');
      expect(mockSettingsRepo.set).toHaveBeenCalledWith('autoStart', false);
    });

    it('should not overwrite existing settings', async () => {
      mockSettingsRepo.get.mockResolvedValue({ key: 'theme', value: 'dark' });

      const handler = getHandler(settingsHandlers, 'app:settings:initialize');
      await handler(mockEvent);

      // Theme should not be set since it already exists
      expect(mockSettingsRepo.set).not.toHaveBeenCalledWith('theme', expect.anything());
    });
  });
});

describe('System Handlers', () => {
  let mockEvent: IpcMainInvokeEvent;
  let mockFs: any;

  beforeEach(() => {
    mockEvent = {
      sender: {
        getOwnerBrowserWindow: vi.fn().mockReturnValue({}),
      },
    } as any;

    mockFs = require('fs');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET_PATH handler', () => {
    it('should return system paths', async () => {
      const handler = getHandler(systemHandlers, 'app:system:getPath');

      const result = await handler(mockEvent, 'downloads');

      expect(result).toBe('/mock/path/downloads');
    });

    it('should validate path name', async () => {
      const handler = getHandler(systemHandlers, 'app:system:getPath');

      await expect(handler(mockEvent, 'invalid' as any)).rejects.toThrow();
    });
  });

  describe('GET_VERSION handler', () => {
    it('should return app version', async () => {
      const handler = getHandler(systemHandlers, 'app:system:getVersion');

      const result = await handler(mockEvent);

      expect(result).toBe('1.0.0');
    });
  });

  describe('CHECK_FILE_EXISTS handler', () => {
    it('should check if file exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const handler = getHandler(systemHandlers, 'app:system:checkFileExists');
      const result = await handler(mockEvent, '/path/to/file.txt');

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const handler = getHandler(systemHandlers, 'app:system:checkFileExists');
      const result = await handler(mockEvent, '/nonexistent/file.txt');

      expect(result).toBe(false);
    });
  });

  describe('GET_FILE_INFO handler', () => {
    it('should return file information', async () => {
      const mockStats = {
        size: 1024,
        isDirectory: () => false,
        isFile: () => true,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats);

      const handler = getHandler(systemHandlers, 'app:system:getFileInfo');
      const result = await handler(mockEvent, '/path/to/file.txt');

      expect(result).toMatchObject({
        exists: true,
        size: 1024,
        isDirectory: false,
        isFile: true,
      });
    });

    it('should return exists: false for non-existent file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const handler = getHandler(systemHandlers, 'app:system:getFileInfo');
      const result = await handler(mockEvent, '/nonexistent/file.txt');

      expect(result).toEqual({ exists: false });
    });
  });
});
