import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import Database from 'better-sqlite3';
import {
  TaskRepository,
  SettingsRepository,
  DetectionRepository,
  HistoryRepository,
  SegmentRepository,
  StatisticsRepository,
  AuditLogRepository,
} from '../repositories';

// Create in-memory database for testing
const sqlite = new Database(':memory:');

// Mock electron app
(global as any).app = {
  getPath: (name: string) => {
    if (name === 'downloads') return '/tmp/downloads';
    if (name === 'userData') return '/tmp/userData';
    return '/tmp';
  },
};

// Initialize test database schema
beforeEach(async () => {
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      media_type TEXT NOT NULL,
      filename TEXT,
      save_dir TEXT,
      file_size INTEGER,
      status TEXT DEFAULT 'queued',
      progress REAL DEFAULT 0,
      percent REAL DEFAULT 0,
      speed_bps INTEGER,
      downloaded_bytes INTEGER DEFAULT 0,
      total_bytes INTEGER,
      eta_ms INTEGER,
      error TEXT,
      error_code TEXT,
      error_message TEXT,
      error_details TEXT,
      retry_count INTEGER DEFAULT 0,
      headers TEXT,
      variant TEXT,
      quality_rule TEXT,
      priority INTEGER DEFAULT 0,
      metadata TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      started_at INTEGER,
      paused_at INTEGER,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT,
      description TEXT,
      updated_at INTEGER DEFAULT (unixepoch()),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS detections (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      media_type TEXT NOT NULL,
      page_url TEXT,
      page_title TEXT,
      thumbnail_url TEXT,
      duration_sec REAL,
      file_size_bytes INTEGER,
      variants TEXT,
      headers TEXT,
      skip_reason TEXT,
      detected_at INTEGER DEFAULT (unixepoch()),
      last_seen_at INTEGER DEFAULT (unixepoch()),
      download_count INTEGER DEFAULT 0,
      auto_delete INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT,
      event TEXT NOT NULL,
      details TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL,
      url TEXT NOT NULL,
      duration_sec REAL,
      size_bytes INTEGER,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      temp_path TEXT,
      error_message TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      downloaded_at INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, segment_index)
    );

    CREATE TABLE IF NOT EXISTS statistics (
      date TEXT PRIMARY KEY,
      total_downloads INTEGER DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      canceled_count INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      total_time_ms INTEGER DEFAULT 0,
      average_speed_bps REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS statistics_domains (
      date TEXT NOT NULL,
      domain TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0,
      PRIMARY KEY (date, domain),
      FOREIGN KEY (date) REFERENCES statistics(date) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS statistics_media_types (
      date TEXT NOT NULL,
      media_type TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      bytes INTEGER DEFAULT 0,
      PRIMARY KEY (date, media_type),
      FOREIGN KEY (date) REFERENCES statistics(date) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER DEFAULT (unixepoch()),
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      event TEXT NOT NULL,
      message TEXT,
      task_id TEXT,
      user_id TEXT,
      context TEXT,
      error_code TEXT,
      error_stack TEXT
    );
  `);
});

afterAll(() => {
  sqlite.close();
});

describe('TaskRepository', () => {
  const taskRepo = new TaskRepository();

  it('should create a task', async () => {
    const spec = {
      url: 'https://example.com/video.m3u8',
      type: 'hls' as const,
      filename: 'test-video.mp4',
    };

    const taskId = await taskRepo.create(spec);
    expect(taskId).toBeDefined();
    expect(typeof taskId).toBe('string');
  });

  it('should get task by id', async () => {
    const spec = {
      url: 'https://example.com/video2.m3u8',
      type: 'hls' as const,
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

  it('should log events', async () => {
    await historyRepo.logTaskEvent('task-1', 'created', { url: 'test.com' });
    await historyRepo.logTaskEvent('task-1', 'started');
    await historyRepo.logTaskEvent('task-1', 'completed');
    
    const history = await historyRepo.getTaskHistory('task-1');
    expect(history.length).toBe(3);
    expect(history[0]?.event).toBe('created');
  });

  it('should log specific event types', async () => {
    await historyRepo.logCreated('task-2', 'https://example.com');
    await historyRepo.logStarted('task-2');
    await historyRepo.logCompleted('task-2', { duration: 1000 });
    
    const events = await historyRepo.getEventsByType('completed', 10);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('SegmentRepository', () => {
  const segmentRepo = new SegmentRepository();

  beforeEach(async () => {
    // Create a test task
    sqlite.exec(`
      INSERT INTO tasks (id, url, media_type) 
      VALUES ('test-task-1', 'https://example.com/video.m3u8', 'hls')
    `);
  });

  it('should create segments batch', async () => {
    const segments = [
      { segmentIndex: 0, url: 'https://example.com/seg0.ts' },
      { segmentIndex: 1, url: 'https://example.com/seg1.ts' },
      { segmentIndex: 2, url: 'https://example.com/seg2.ts' },
    ];

    await segmentRepo.createBatch('test-task-1', segments);
    const retrieved = await segmentRepo.getByTask('test-task-1');
    expect(retrieved.length).toBe(3);
  });

  it('should track segment progress', async () => {
    const segments = [
      { segmentIndex: 0, url: 'https://example.com/seg0.ts' },
    ];

    await segmentRepo.createBatch('test-task-1', segments);
    await segmentRepo.markCompleted('test-task-1', 0, '/tmp/seg0.ts');
    
    const progress = await segmentRepo.getProgress('test-task-1');
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(1);
  });
});

describe('StatisticsRepository', () => {
  const statsRepo = new StatisticsRepository();

  it('should record download statistics', async () => {
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

  it('should aggregate statistics', async () => {
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