import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase } from '../../../test/db-setup';
import {
  TaskRepository,
  SettingsRepository,
  DetectionRepository,
  HistoryRepository,
  SegmentRepository,
  StatisticsRepository,
  AuditLogRepository,
} from '../repositories';

// Mock electron app
(global as unknown as any).app = {
  getPath: (name: string) => {
    if (name === 'downloads') return '/tmp/downloads';
    if (name === 'userData') return '/tmp/userData';
    return '/tmp';
  },
};

let testDb: any;

// Initialize test database schema
beforeEach(async () => {
  await setupTestDatabase();
  const { testDb: db } = getTestDatabase();
  testDb = db;

  // Clear all data before each test
  testDb.exec(`
    DELETE FROM audit_logs;
    DELETE FROM segments;
    DELETE FROM history;
    DELETE FROM detections;
    DELETE FROM settings;
    DELETE FROM statistics_domains;
    DELETE FROM statistics_media_types;
    DELETE FROM statistics;
    DELETE FROM tasks;
  `);
});

afterAll(async () => {
  await teardownTestDatabase();
});

describe('TaskRepository', () => {
  const taskRepo = new TaskRepository('/tmp/downloads');

  it('should create a task', async () => {
    const spec = {
      url: 'https://example.com/video.m3u8',
      type: 'hls' as const,
      filename: 'test-video.mp4',
      saveDir: '/tmp/downloads',
    };

    const taskId = await taskRepo.create(spec);
    expect(taskId).toBeDefined();
    expect(typeof taskId).toBe('string');
  });

  it('should get task by id', async () => {
    const spec = {
      url: 'https://example.com/video2.m3u8',
      type: 'hls' as const,
      saveDir: '/tmp/downloads',
    };

    const taskId = await taskRepo.create(spec);
    const task = await taskRepo.getById(taskId);

    expect(task).toBeDefined();
    expect(task?.id).toBe(taskId);
    expect(task?.url).toBe(spec.url);
  });

  it('should update task status', async () => {
    const spec = {
      url: 'https://example.com/video3.m3u8',
      type: 'hls' as const,
      saveDir: '/tmp/downloads',
    };

    const taskId = await taskRepo.create(spec);
    await taskRepo.updateStatus(taskId, 'running');

    const task = await taskRepo.getById(taskId);
    expect(task?.status).toBe('running');
  });

  it('should update progress', async () => {
    const spec = {
      url: 'https://example.com/video4.m3u8',
      type: 'hls' as const,
      saveDir: '/tmp/downloads',
    };

    const taskId = await taskRepo.create(spec);
    await taskRepo.updateProgress(taskId, {
      downloadedBytes: 1000,
      totalBytes: 10000,
      speedBps: 100000,
      percent: 10,
      etaMs: 90000,
    });

    const task = await taskRepo.getById(taskId);
    expect(task?.downloadedBytes).toBe(1000);
    expect(task?.percent).toBe(10);
  });
});

describe('SettingsRepository', () => {
  const settingsRepo = new SettingsRepository();

  it('should set and get a setting', async () => {
    await settingsRepo.set('test.key', 'test-value');
    const value = await settingsRepo.get<string>('test.key');
    expect(value).toBe('test-value');
  });

  it('should handle JSON values', async () => {
    const complexValue = { foo: 'bar', count: 42, enabled: true };
    await settingsRepo.set('test.complex', complexValue);
    const retrieved = await settingsRepo.get('test.complex');
    expect(retrieved).toEqual(complexValue);
  });

  it('should update existing settings', async () => {
    await settingsRepo.set('test.update', 'initial');
    await settingsRepo.set('test.update', 'updated');
    const value = await settingsRepo.get('test.update');
    expect(value).toBe('updated');
  });

  it('should get all settings', async () => {
    await settingsRepo.set('app.theme', 'dark');
    await settingsRepo.set('app.language', 'en');

    const all = await settingsRepo.getAll();
    expect(all['app.theme']).toBe('dark');
    expect(all['app.language']).toBe('en');
  });
});

describe('DetectionRepository', () => {
  const detectionRepo = new DetectionRepository();

  it('should create a detection', async () => {
    const detection = {
      id: 'test-detection-1',
      url: 'https://example.com/stream.m3u8',
      mediaType: 'hls' as const,
      pageUrl: 'https://example.com/page',
      pageTitle: 'Test Page',
    };

    const id = await detectionRepo.create(detection);
    expect(id).toBe(detection.id);
  });

  it('should upsert detection', async () => {
    const detection = {
      id: 'test-detection-2',
      url: 'https://example.com/stream2.m3u8',
      mediaType: 'hls' as const,
      downloadCount: 0,
    };

    await detectionRepo.upsert(detection);
    await detectionRepo.incrementDownloadCount(detection.id);

    const retrieved = await detectionRepo.getById(detection.id);
    expect(retrieved?.downloadCount).toBe(1);
  });

  it('should mark for deletion', async () => {
    const detection = {
      id: 'test-detection-3',
      url: 'https://example.com/stream3.m3u8',
      mediaType: 'dash' as const,
    };

    await detectionRepo.create(detection);
    await detectionRepo.markForDeletion(detection.id);

    const retrieved = await detectionRepo.getById(detection.id);
    expect(retrieved?.autoDelete).toBe(1);
  });
});

describe('HistoryRepository', () => {
  const historyRepo = new HistoryRepository();
  const taskRepo = new TaskRepository('/tmp/downloads');

  it('should log events', async () => {
    // Create a task first
    const taskId = await taskRepo.create({
      url: 'https://test.com/video.m3u8',
      type: 'hls',
      saveDir: '/tmp/downloads',
    });

    await historyRepo.logTaskEvent(taskId, 'created', { url: 'test.com' });
    await historyRepo.logTaskEvent(taskId, 'started');
    await historyRepo.logTaskEvent(taskId, 'completed');

    const history = await historyRepo.getTaskHistory(taskId);
    expect(history.length).toBe(3);
    expect(history[0]?.event).toBe('created');
  });

  it('should log specific event types', async () => {
    // Create a task first
    const taskId = await taskRepo.create({
      url: 'https://example.com/video.m3u8',
      type: 'hls',
      saveDir: '/tmp/downloads',
    });

    await historyRepo.logCreated(taskId, 'https://example.com');
    await historyRepo.logStarted(taskId);
    await historyRepo.logCompleted(taskId, { duration: 1000 });

    const events = await historyRepo.getEventsByType('completed', 10);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('SegmentRepository', () => {
  const segmentRepo = new SegmentRepository();
  const taskRepo = new TaskRepository('/tmp/downloads');
  let testTaskId: string;

  beforeEach(async () => {
    // Create a test task using repository
    testTaskId = await taskRepo.create({
      url: 'https://example.com/video.m3u8',
      type: 'hls',
      saveDir: '/tmp/downloads',
    });
  });

  it('should create segments batch', async () => {
    const segments = [
      { segmentIndex: 0, url: 'https://example.com/seg0.ts' },
      { segmentIndex: 1, url: 'https://example.com/seg1.ts' },
      { segmentIndex: 2, url: 'https://example.com/seg2.ts' },
    ];

    await segmentRepo.createBatch(testTaskId, segments);
    const retrieved = await segmentRepo.getByTask(testTaskId);
    expect(retrieved.length).toBe(3);
  });

  it('should track segment progress', async () => {
    const segments = [{ segmentIndex: 0, url: 'https://example.com/seg0.ts' }];

    await segmentRepo.createBatch(testTaskId, segments);
    await segmentRepo.markCompleted(testTaskId, 0, '/tmp/seg0.ts');

    const progress = await segmentRepo.getProgress(testTaskId);
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(1);
  });
});

describe('StatisticsRepository', () => {
  const statsRepo = new StatisticsRepository();

  it.skip('should record download statistics', async () => {
    // TODO: Fix SQLite boolean binding issues
    await statsRepo.recordDownload(
      'example.com',
      'hls',
      1000000,
      10000,
      100000,
      true,
      false,
      false
    );

    const daily = await statsRepo.getDaily();
    expect(daily).toBeDefined();
    expect(daily?.totalDownloads).toBe(1);
    expect(daily?.completedCount).toBe(1);
  });

  it.skip('should aggregate statistics', async () => {
    // TODO: Fix SQLite boolean binding issues
    await statsRepo.recordDownload('site1.com', 'hls', 1000, 100, 10000, true, false, false);
    await statsRepo.recordDownload('site2.com', 'dash', 2000, 200, 10000, true, false, false);
    await statsRepo.recordDownload('site1.com', 'file', 3000, 300, 10000, false, true, false);

    const summary = await statsRepo.getSummary(30);
    expect(summary.totalDownloads).toBe(3);
    expect(summary.completedCount).toBe(2);
    expect(summary.errorCount).toBe(1);
  });
});

describe('AuditLogRepository', () => {
  const auditRepo = new AuditLogRepository();

  it('should log different levels', async () => {
    await auditRepo.debug('test', 'debug-event', 'Debug message');
    await auditRepo.info('test', 'info-event', 'Info message');
    await auditRepo.warn('test', 'warn-event', 'Warning message');
    await auditRepo.error('test', 'error-event', new Error('Test error'));

    const logs = await auditRepo.getRecent(10);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should search logs with filters', async () => {
    await auditRepo.logDownloadEvent('task-123', 'started');
    await auditRepo.logSecurityEvent('suspicious', 'Suspicious activity detected');

    const downloadLogs = await auditRepo.search({ category: 'download' });
    const securityLogs = await auditRepo.search({ category: 'security' });

    expect(downloadLogs.length).toBeGreaterThan(0);
    expect(securityLogs.length).toBeGreaterThan(0);
  });
});
