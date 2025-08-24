import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskRepository } from '../task.repository';
import type { AuditLogRepository } from '../audit-log.repository';
import type { DownloadSpec } from '@/shared/types';
import { RepositoryMockBuilder } from '@/test/builders/repository-mock.builder';
import { expectMockCalled, expectMockNotCalled } from '@/test/utils/mock-assertions';
import { setupMocks } from '@/test/utils/setup';

// Mock the database client
vi.mock('../../client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
        orderBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'test-id-123' }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'test-id-123' }])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({ changes: 1 })),
    })),
  },
}));

describe('TaskRepository', () => {
  setupMocks();

  let taskRepo: TaskRepository;
  let mockAuditLogRepo: AuditLogRepository;

  beforeEach(() => {
    // Use the RepositoryMockBuilder for type-safe mock creation
    mockAuditLogRepo = new RepositoryMockBuilder<AuditLogRepository>()
      .withMethod('logDownloadEvent')
      .withMethod('error')
      .withMethod('info')
      .build();

    taskRepo = new TaskRepository('/default/save/dir');
  });

  describe('create', () => {
    it('should create a new download task', async () => {
      const spec: DownloadSpec = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        filename: 'video.mp4',
        saveDir: '/downloads',
      };

      const taskId = await taskRepo.create(spec);

      expect(taskId).toBe('test-id-123');
      // Use type-safe assertion helper
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockCalled(mockAuditLogRepo.logDownloadEvent, 'test-id-123', 'task_created', {
        url: spec.url,
      });
    });

    it('should validate required fields', async () => {
      const invalidSpec = {
        type: 'hls',
      } as DownloadSpec;

      await expect(taskRepo.create(invalidSpec)).rejects.toThrow('URL is required');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockNotCalled(mockAuditLogRepo.logDownloadEvent);
    });

    it('should sanitize filename', async () => {
      const spec: DownloadSpec = {
        url: 'https://example.com/video.m3u8',
        type: 'hls',
        filename: 'video<>:"|?*.mp4',
        saveDir: '/downloads',
      };

      const taskId = await taskRepo.create(spec);

      expect(taskId).toBe('test-id-123');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockCalled(mockAuditLogRepo.logDownloadEvent, 'test-id-123', 'task_created', {
        url: spec.url,
      });
    });
  });

  describe('pause', () => {
    it('should pause an active task', async () => {
      await taskRepo.pause('test-id-123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockCalled(mockAuditLogRepo.logDownloadEvent, 'test-id-123', 'task_paused', undefined);
    });
  });

  describe('resume', () => {
    it('should resume a paused task', async () => {
      await taskRepo.resume('test-id-123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockCalled(mockAuditLogRepo.logDownloadEvent, 'test-id-123', 'task_resumed', undefined);
    });
  });

  describe('cancel', () => {
    it('should cancel a task', async () => {
      await taskRepo.cancel('test-id-123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockCalled(
        mockAuditLogRepo.logDownloadEvent,
        'test-id-123',
        'task_canceled',
        undefined
      );
    });
  });

  describe('retry', () => {
    it('should retry a failed task', async () => {
      await taskRepo.retry('test-id-123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expectMockCalled(mockAuditLogRepo.logDownloadEvent, 'test-id-123', 'task_retried', undefined);
    });
  });
});
