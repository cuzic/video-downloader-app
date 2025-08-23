# Video Downloader データベース仕様書（Drizzle ORM版）v2.0

> 本書は v1.1 の SQLite 仕様（UNIX 秒, JSON 検証, 統計の正規化 等）を **Drizzle ORM + better-sqlite3** 前提で実装できるように再編したものです。

* **DB**: SQLite 3.40+
* **ORM**: Drizzle ORM
* **Driver**: better-sqlite3 v9
* **Migrations**: drizzle-kit
* **Process**: Electron Main（Renderer からは IPC 経由）

---

## 0. ディレクトリ構成

```
apps/desktop/
  src/
    main/
      db/
        client.ts           # better-sqlite3 + drizzle 初期化
        schema/
          tasks.ts
          segments.ts
          settings.ts
          detections.ts
          namingRules.ts
          statistics.ts
          auditLogs.ts
          index.ts          # エクスポート集約
        repositories/
          task.repository.ts
          settings.repository.ts
          statistics.repository.ts
          detection.repository.ts
          segment.repository.ts
        maintenance/
          backup.ts
          integrity.ts
          cleanup.ts
        migrations/
          custom/           # 手動SQLマイグレーション
            001_add_constraints.sql
            002_add_views.sql
            003_add_triggers.sql
    ipc/
      handlers/
        download.handler.ts
        settings.handler.ts
  drizzle.config.ts
  drizzle/                  # 生成されたSQLマイグレーション
    0000_initial.sql
    meta/
  database/
    app.db
    backups/
```

---

## 1. セットアップ

### 1.1 依存関係

```bash
npm i drizzle-orm better-sqlite3
npm i -D drizzle-kit @types/better-sqlite3
```

### 1.2 drizzle.config.ts

```ts
import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './src/main/db/schema/index.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : path.join(process.cwd(), 'database', 'app.db')
  },
  strict: true,
  verbose: true,
} satisfies Config;
```

### 1.3 クライアント初期化（Main プロセス）

```ts
// src/main/db/client.ts
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import { app } from 'electron';
import * as schema from './schema';

// SQLite接続インスタンス
const dbPath = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.join(app.getPath('userData'), 'database', 'app.db');

export const sqlite = new Database(dbPath);

// Drizzle ORMインスタンス
export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });

// PRAGMA設定（起動時に一度だけ実行）
export function initializePragma(): void {
  sqlite.pragma('journal_mode = WAL');            // クラッシュ耐性
  sqlite.pragma('synchronous = NORMAL');          // パフォーマンスと安全性のバランス
  sqlite.pragma('foreign_keys = ON');             // 外部キー制約有効化
  sqlite.pragma('busy_timeout = 5000');           // ロックタイムアウト 5秒
  sqlite.pragma('cache_size = -10000');           // キャッシュサイズ 10MB
  sqlite.pragma('auto_vacuum = INCREMENTAL');     // 自動VACUUM
  sqlite.pragma('mmap_size = 30000000');          // メモリマップI/O 30MB
}

// アプリケーション起動時の初期化
export async function initializeDatabase(): Promise<void> {
  initializePragma();
  
  // カスタムマイグレーションの実行
  await runCustomMigrations();
}

// カスタムSQL実行（制約、ビュー、トリガー等）
async function runCustomMigrations(): Promise<void> {
  // JSON検証制約、生成列、ビュー、トリガーなどの追加
  // 詳細は section 2.4 参照
}
```

---

## 2. スキーマ定義（Drizzle）

### 2.1 タスクテーブル

```ts
// src/main/db/schema/tasks.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tasks = sqliteTable('tasks', {
  // 主キー
  id: text('id').primaryKey(),  // UUID v4
  
  // 基本情報
  url: text('url').notNull(),
  mediaType: text('media_type', { 
    enum: ['hls', 'dash', 'file'] 
  }).notNull(),
  filename: text('filename'),
  saveDir: text('save_dir').notNull(),
  outputPath: text('output_path'),
  
  // ステータス
  status: text('status', { 
    enum: ['queued', 'running', 'paused', 'completed', 'error', 'canceled'] 
  }).notNull().default('queued'),
  priority: integer('priority').notNull().default(0),
  
  // 進捗情報
  downloadedBytes: integer('downloaded_bytes').notNull().default(0),
  totalBytes: integer('total_bytes'),
  speedBps: real('speed_bps'),  // Bytes per second
  percent: real('percent'),      // 0-100
  etaMs: integer('eta_ms'),      // Estimated time in milliseconds
  
  // エラー情報
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  errorDetails: text('error_details'),  // JSON文字列
  retryCount: integer('retry_count').notNull().default(0),
  
  // メタデータ
  pageUrl: text('page_url'),
  pageTitle: text('page_title'),
  thumbnailUrl: text('thumbnail_url'),
  durationSec: real('duration_sec'),
  headers: text('headers'),        // JSON文字列
  variant: text('variant'),        // JSON文字列 (VideoVariant)
  qualityRule: text('quality_rule'), // JSON文字列 (CustomQualityRule)
  metadata: text('metadata'),      // JSON文字列 (任意メタデータ)
  
  // タイムスタンプ（UNIX秒）
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`),
  startedAt: integer('started_at'),
  pausedAt: integer('paused_at'),
  completedAt: integer('completed_at'),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`),
});

// TypeScript型定義
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

### 2.2 セグメントテーブル

```ts
// src/main/db/schema/segments.ts
import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const segments = sqliteTable('segments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  
  // セグメント情報
  segmentIndex: integer('segment_index').notNull(),
  url: text('url').notNull(),
  durationSec: real('duration_sec'),
  sizeBytes: integer('size_bytes'),
  
  // ステータス
  status: text('status', { 
    enum: ['pending', 'downloading', 'completed', 'error'] 
  }).notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),
  
  // ファイル情報
  tempPath: text('temp_path'),
  errorMessage: text('error_message'),
  
  // タイムスタンプ
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`),
  downloadedAt: integer('downloaded_at'),
}, (table) => {
  return {
    taskSegmentUnique: primaryKey({ columns: [table.taskId, table.segmentIndex] }),
  };
});

export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
```

### 2.3 その他のテーブル

```ts
// src/main/db/schema/settings.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),  // JSON文字列
  type: text('type', {
    enum: ['string', 'number', 'boolean', 'object', 'array', 'null']
  }),
  description: text('description'),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`),
  updatedBy: text('updated_by').default('system'),
});

// src/main/db/schema/detections.ts
export const detections = sqliteTable('detections', {
  id: text('id').primaryKey(),  // dedupKey
  url: text('url').notNull(),
  mediaType: text('media_type', { 
    enum: ['hls', 'dash', 'file'] 
  }).notNull(),
  pageUrl: text('page_url'),
  pageTitle: text('page_title'),
  thumbnailUrl: text('thumbnail_url'),
  durationSec: real('duration_sec'),
  fileSizeBytes: integer('file_size_bytes'),
  variants: text('variants'),     // JSON文字列 (VideoVariant[])
  headers: text('headers'),       // JSON文字列
  skipReason: text('skip_reason', {
    enum: ['drm', '403', 'cors', 'mime-mismatch', 'widevine-hint', 'live']
  }),
  detectedAt: integer('detected_at').notNull().default(sql`(strftime('%s','now'))`),
  lastSeenAt: integer('last_seen_at').notNull().default(sql`(strftime('%s','now'))`),
  downloadCount: integer('download_count').notNull().default(0),
  autoDelete: integer('auto_delete').notNull().default(0),  // 0/1 as boolean
});

// src/main/db/schema/namingRules.ts
export const namingRules = sqliteTable('naming_rules', {
  id: text('id').primaryKey(),
  sitePattern: text('site_pattern').notNull(),  // 正規表現
  tokens: text('tokens').notNull(),             // JSON配列
  template: text('template').notNull().default('{title}.{ext}'),
  enabled: integer('enabled').notNull().default(1),  // 0/1 as boolean
  priority: integer('priority').notNull().default(0),
  description: text('description'),
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`),
});

// src/main/db/schema/statistics.ts
export const statistics = sqliteTable('statistics', {
  date: text('date').primaryKey(),  // YYYY-MM-DD
  totalDownloads: integer('total_downloads').notNull().default(0),
  completedCount: integer('completed_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  canceledCount: integer('canceled_count').notNull().default(0),
  totalBytes: integer('total_bytes').notNull().default(0),
  totalTimeMs: integer('total_time_ms').notNull().default(0),
  averageSpeedBps: real('average_speed_bps').notNull().default(0),
});

export const statisticsDomains = sqliteTable('statistics_domains', {
  date: text('date').notNull().references(() => statistics.date, { onDelete: 'cascade' }),
  domain: text('domain').notNull(),
  count: integer('count').notNull().default(0),
  bytes: integer('bytes').notNull().default(0),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.date, table.domain] }),
  };
});

export const statisticsMediaTypes = sqliteTable('statistics_media_types', {
  date: text('date').notNull().references(() => statistics.date, { onDelete: 'cascade' }),
  mediaType: text('media_type', { 
    enum: ['hls', 'dash', 'file'] 
  }).notNull(),
  count: integer('count').notNull().default(0),
  bytes: integer('bytes').notNull().default(0),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.date, table.mediaType] }),
  };
});

// src/main/db/schema/auditLogs.ts
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp').notNull().default(sql`(strftime('%s','now'))`),
  level: text('level', { 
    enum: ['debug', 'info', 'warn', 'error'] 
  }).notNull(),
  category: text('category').notNull(),  // 'download', 'detection', 'settings', 'security'
  event: text('event').notNull(),
  message: text('message'),
  taskId: text('task_id'),
  userId: text('user_id'),
  context: text('context'),  // JSON文字列
  errorCode: text('error_code'),
  errorStack: text('error_stack'),
});

// src/main/db/schema/index.ts
export * from './tasks';
export * from './segments';
export * from './settings';
export * from './detections';
export * from './namingRules';
export * from './statistics';
export * from './auditLogs';
```

### 2.4 カスタムSQL（制約、インデックス、ビュー、トリガー）

```sql
-- src/main/db/migrations/custom/001_add_constraints.sql

-- JSON検証制約
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_percent 
  CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_error_details_json 
  CHECK (error_details IS NULL OR json_valid(error_details));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_headers_json 
  CHECK (headers IS NULL OR json_valid(headers));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_variant_json 
  CHECK (variant IS NULL OR json_valid(variant));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_quality_rule_json 
  CHECK (quality_rule IS NULL OR json_valid(quality_rule));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_metadata_json 
  CHECK (metadata IS NULL OR json_valid(metadata));

ALTER TABLE detections ADD CONSTRAINT chk_detections_variants_json 
  CHECK (variants IS NULL OR json_valid(variants));
ALTER TABLE detections ADD CONSTRAINT chk_detections_headers_json 
  CHECK (headers IS NULL OR json_valid(headers));

ALTER TABLE naming_rules ADD CONSTRAINT chk_naming_rules_tokens_json 
  CHECK (json_valid(tokens));

ALTER TABLE audit_logs ADD CONSTRAINT chk_audit_logs_context_json 
  CHECK (context IS NULL OR json_valid(context));

-- 生成列: domain（tasks）
ALTER TABLE tasks ADD COLUMN domain TEXT GENERATED ALWAYS AS (
  CASE WHEN url LIKE 'http%'
    THEN substr(url, instr(url, '://')+3,
         CASE WHEN instr(substr(url, instr(url,'://')+3), '/')>0
              THEN instr(substr(url, instr(url,'://')+3), '/')-1
              ELSE length(url) END)
    ELSE NULL END
) STORED;
```

```sql
-- src/main/db/migrations/custom/002_add_indexes.sql

-- タスク関連インデックス
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_domain ON tasks(domain);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority 
  ON tasks(status, priority DESC) 
  WHERE status IN ('queued','paused');

-- セグメント関連インデックス
CREATE INDEX IF NOT EXISTS idx_segments_task_status ON segments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_segments_status 
  ON segments(status) 
  WHERE status IN ('pending','downloading');

-- 検出履歴関連インデックス
CREATE INDEX IF NOT EXISTS idx_detections_detected_at ON detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_detections_page_url ON detections(page_url);
CREATE INDEX IF NOT EXISTS idx_detections_auto_delete ON detections(auto_delete, detected_at);

-- ルール関連インデックス
CREATE INDEX IF NOT EXISTS idx_naming_rules_enabled_priority ON naming_rules(enabled, priority DESC);

-- 監査ログ関連インデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);

-- 統計関連インデックス
CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date DESC);
```

```sql
-- src/main/db/migrations/custom/003_add_views.sql

-- アクティブタスクビュー
CREATE VIEW IF NOT EXISTS active_tasks AS
SELECT 
  t.id, t.url, t.media_type, t.filename, t.status, t.percent, t.speed_bps,
  t.eta_ms, t.downloaded_bytes, t.total_bytes,
  COUNT(s.id) AS total_segments,
  SUM(CASE WHEN s.status='completed' THEN 1 ELSE 0 END) AS completed_segments
FROM tasks t
LEFT JOIN segments s ON t.id = s.task_id
WHERE t.status IN ('running','paused','queued')
GROUP BY t.id;

-- 日次統計ビュー
CREATE VIEW IF NOT EXISTS daily_stats AS
SELECT 
  date(datetime(t.created_at,'unixepoch')) AS date,
  COUNT(*) AS total_tasks,
  SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN t.status='error' THEN 1 ELSE 0 END) AS errors,
  SUM(t.downloaded_bytes) AS total_bytes,
  AVG(t.speed_bps) AS avg_speed
FROM tasks t
GROUP BY date;
```

```sql
-- src/main/db/migrations/custom/004_add_triggers.sql

-- updated_at自動更新トリガー
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tasks SET updated_at = (strftime('%s','now')) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
AFTER UPDATE ON settings
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE settings SET updated_at = (strftime('%s','now')) WHERE key = NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS trg_naming_rules_updated_at
AFTER UPDATE ON naming_rules
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE naming_rules SET updated_at = (strftime('%s','now')) WHERE id = NEW.id;
END;

-- 統計更新トリガー（タスク完了時）
CREATE TRIGGER IF NOT EXISTS trg_tasks_completed_stats
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN NEW.status='completed' AND OLD.status IS NOT 'completed'
BEGIN
  -- メイン統計テーブル更新
  INSERT INTO statistics(date, total_downloads, completed_count, total_bytes)
  VALUES (
    date(datetime(COALESCE(NEW.completed_at, strftime('%s','now')),'unixepoch')),
    1, 1, COALESCE(NEW.downloaded_bytes,0)
  )
  ON CONFLICT(date) DO UPDATE SET
    total_downloads = total_downloads + 1,
    completed_count = completed_count + 1,
    total_bytes = total_bytes + COALESCE(NEW.downloaded_bytes,0);

  -- ドメイン別統計更新
  INSERT INTO statistics_domains(date, domain, count, bytes)
  VALUES (
    date(datetime(COALESCE(NEW.completed_at, strftime('%s','now')),'unixepoch')),
    NEW.domain, 1, COALESCE(NEW.downloaded_bytes,0)
  )
  ON CONFLICT(date,domain) DO UPDATE SET
    count = count + 1,
    bytes = bytes + COALESCE(NEW.downloaded_bytes,0);

  -- メディアタイプ別統計更新
  INSERT INTO statistics_media_types(date, media_type, count, bytes)
  VALUES (
    date(datetime(COALESCE(NEW.completed_at, strftime('%s','now')),'unixepoch')),
    NEW.media_type, 1, COALESCE(NEW.downloaded_bytes,0)
  )
  ON CONFLICT(date,media_type) DO UPDATE SET
    count = count + 1,
    bytes = bytes + COALESCE(NEW.downloaded_bytes,0);
END;

-- エラー統計更新トリガー
CREATE TRIGGER IF NOT EXISTS trg_tasks_error_stats
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN NEW.status='error' AND OLD.status IS NOT 'error'
BEGIN
  INSERT INTO statistics(date, total_downloads, error_count)
  VALUES (date(datetime('now','unixepoch')), 1, 1)
  ON CONFLICT(date) DO UPDATE SET
    total_downloads = total_downloads + 1,
    error_count = error_count + 1;
END;
```

---

## 3. リポジトリ実装

### 3.1 タスクリポジトリ

```ts
// src/main/db/repositories/task.repository.ts
import { db } from '../client';
import { tasks, segments } from '../schema';
import { eq, inArray, sql, desc, and } from 'drizzle-orm';
import type { Task, NewTask } from '../schema/tasks';
import type { DownloadSpec, DownloadProgress } from '@/types';

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

    // ステータスに応じたタイムスタンプ更新
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
```

### 3.2 設定リポジトリ

```ts
// src/main/db/repositories/settings.repository.ts
import { db } from '../client';
import { settings } from '../schema';
import { eq } from 'drizzle-orm';

export class SettingsRepository {
  async get<T = any>(key: string): Promise<T | null> {
    const result = await db.select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    
    if (!result[0]) return null;
    
    try {
      return JSON.parse(result[0].value) as T;
    } catch {
      return result[0].value as T;
    }
  }

  async set<T = any>(key: string, value: T, description?: string): Promise<void> {
    const type = Array.isArray(value) ? 'array'
      : value === null ? 'null'
      : typeof value;
    
    const jsonValue = JSON.stringify(value);
    
    await db.insert(settings)
      .values({
        key,
        value: jsonValue,
        type: type as any,
        description,
        updatedAt: Math.floor(Date.now() / 1000),
        updatedBy: 'user',
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: jsonValue,
          type: type as any,
          updatedAt: Math.floor(Date.now() / 1000),
          updatedBy: 'user',
        },
      });
  }

  async getAll(): Promise<Record<string, any>> {
    const rows = await db.select().from(settings);
    
    const result: Record<string, any> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    
    return result;
  }

  async setDefaults(defaults: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(defaults)) {
      const existing = await this.get(key);
      if (existing === null) {
        await this.set(key, value);
      }
    }
  }
}
```

### 3.3 セグメントリポジトリ

```ts
// src/main/db/repositories/segment.repository.ts
import { db } from '../client';
import { segments } from '../schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { Segment, NewSegment } from '../schema/segments';

export class SegmentRepository {
  async createBatch(taskId: string, segmentUrls: string[]): Promise<void> {
    const values: NewSegment[] = segmentUrls.map((url, index) => ({
      taskId,
      segmentIndex: index,
      url,
      status: 'pending' as const,
      retryCount: 0,
    }));

    await db.insert(segments).values(values);
  }

  async updateStatus(
    taskId: string,
    segmentIndex: number,
    status: Segment['status'],
    error?: string
  ): Promise<void> {
    const updates: Partial<Segment> = { status };
    
    if (status === 'completed') {
      updates.downloadedAt = Math.floor(Date.now() / 1000);
    }
    
    if (status === 'error' && error) {
      updates.errorMessage = error;
    }

    await db.update(segments)
      .set(updates)
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.segmentIndex, segmentIndex)
      ));
  }

  async getByTaskId(taskId: string): Promise<Segment[]> {
    return db.select()
      .from(segments)
      .where(eq(segments.taskId, taskId))
      .orderBy(segments.segmentIndex);
  }

  async getProgress(taskId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
  }> {
    const allSegments = await this.getByTaskId(taskId);
    
    return {
      total: allSegments.length,
      completed: allSegments.filter(s => s.status === 'completed').length,
      failed: allSegments.filter(s => s.status === 'error').length,
      pending: allSegments.filter(s => s.status === 'pending').length,
    };
  }

  async incrementRetry(taskId: string, segmentIndex: number): Promise<void> {
    await db.update(segments)
      .set({
        retryCount: sql`${segments.retryCount} + 1`,
        status: 'pending',
        errorMessage: null,
      })
      .where(and(
        eq(segments.taskId, taskId),
        eq(segments.segmentIndex, segmentIndex)
      ));
  }

  async cleanup(taskId: string): Promise<void> {
    await db.delete(segments)
      .where(eq(segments.taskId, taskId));
  }
}
```

---

## 4. メンテナンス機能

### 4.1 バックアップ管理

```ts
// src/main/db/maintenance/backup.ts
import fs from 'fs';
import path from 'path';
import { sqlite } from '../client';

export class BackupManager {
  constructor(
    private backupDir: string,
    private mainDbPath: string,
    private maxBackups = 7
  ) {
    // バックアップディレクトリ作成
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  createBackup(): string {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    
    const backupPath = path.join(this.backupDir, `app_${timestamp}.db`);
    
    // VACUUM INTOでバックアップ作成（最適化込み）
    sqlite.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    
    this.cleanup();
    
    return backupPath;
  }

  private cleanup(): void {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => /^app_\d{8}_\d{6}\.db$/.test(f))
      .sort()
      .reverse();
    
    // 古いバックアップを削除
    for (const file of files.slice(this.maxBackups)) {
      fs.unlinkSync(path.join(this.backupDir, file));
    }
  }

  restore(backupPath: string): void {
    // 1. 現在の接続を閉じる
    sqlite.close();
    
    // 2. WAL/SHMファイルを削除
    for (const ext of ['-wal', '-shm']) {
      const filePath = this.mainDbPath + ext;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // 3. バックアップファイルで上書き
    fs.copyFileSync(backupPath, this.mainDbPath);
    
    // 4. 再接続は上位層で実施
  }

  listBackups(): Array<{ path: string; size: number; created: Date }> {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => /^app_\d{8}_\d{6}\.db$/.test(f));
    
    return files.map(file => {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      
      return {
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
      };
    }).sort((a, b) => b.created.getTime() - a.created.getTime());
  }
}
```

### 4.2 整合性チェック

```ts
// src/main/db/maintenance/integrity.ts
import { sqlite } from '../client';

export class IntegrityChecker {
  check(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // PRAGMA integrity_check
      const integrityResult = sqlite.pragma('integrity_check');
      const integrityOk = Array.isArray(integrityResult) 
        && integrityResult[0]?.integrity_check === 'ok';
      
      if (!integrityOk) {
        errors.push('Database integrity check failed');
        if (Array.isArray(integrityResult)) {
          integrityResult.forEach(r => {
            if (r.integrity_check !== 'ok') {
              errors.push(r.integrity_check);
            }
          });
        }
      }
      
      // 外部キー制約チェック
      const fkResult = sqlite.pragma('foreign_key_check');
      if (Array.isArray(fkResult) && fkResult.length > 0) {
        errors.push('Foreign key violations detected');
        fkResult.forEach(violation => {
          errors.push(`Table: ${violation.table}, Parent: ${violation.parent}`);
        });
      }
      
      return {
        ok: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Integrity check error: ${error.message}`);
      return { ok: false, errors };
    }
  }

  repair(): void {
    // インデックス再構築
    sqlite.exec('REINDEX');
    
    // データベース最適化
    sqlite.exec('VACUUM');
    
    // 統計情報更新
    sqlite.exec('ANALYZE');
  }

  getStats(): {
    pageCount: number;
    pageSize: number;
    totalSize: number;
    cacheSize: number;
    walSize: number;
  } {
    const pageCount = sqlite.pragma('page_count')[0].page_count;
    const pageSize = sqlite.pragma('page_size')[0].page_size;
    const cacheSize = sqlite.pragma('cache_size')[0].cache_size;
    
    // WALサイズ確認
    let walSize = 0;
    try {
      const walPath = sqlite.name + '-wal';
      if (fs.existsSync(walPath)) {
        walSize = fs.statSync(walPath).size;
      }
    } catch {}
    
    return {
      pageCount,
      pageSize,
      totalSize: pageCount * pageSize,
      cacheSize: Math.abs(cacheSize) * pageSize, // 負の値はKB単位
      walSize,
    };
  }
}
```

### 4.3 定期クリーンアップ

```ts
// src/main/db/maintenance/cleanup.ts
import { sqlite, db } from '../client';
import { tasks, segments, detections, auditLogs } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

export class CleanupManager {
  async cleanupOldData(options: {
    detectionsOlderThanDays?: number;
    completedTasksOlderThanDays?: number;
    auditLogsOlderThanDays?: number;
  } = {}): Promise<{
    deletedDetections: number;
    deletedSegments: number;
    deletedAuditLogs: number;
  }> {
    const {
      detectionsOlderThanDays = 30,
      completedTasksOlderThanDays = 7,
      auditLogsOlderThanDays = 30,
    } = options;

    let deletedDetections = 0;
    let deletedSegments = 0;
    let deletedAuditLogs = 0;

    // 古い検出履歴を削除（auto_delete=1のもの）
    if (detectionsOlderThanDays > 0) {
      const cutoff = Math.floor(Date.now() / 1000) - (detectionsOlderThanDays * 24 * 60 * 60);
      const result = await db.delete(detections)
        .where(and(
          eq(detections.autoDelete, 1),
          sql`${detections.detectedAt} < ${cutoff}`
        ));
      deletedDetections = result.changes;
    }

    // 完了タスクのセグメントを削除
    if (completedTasksOlderThanDays > 0) {
      const cutoff = Math.floor(Date.now() / 1000) - (completedTasksOlderThanDays * 24 * 60 * 60);
      const result = sqlite.prepare(`
        DELETE FROM segments 
        WHERE task_id IN (
          SELECT id FROM tasks 
          WHERE status = 'completed' 
            AND completed_at < ?
        )
      `).run(cutoff);
      deletedSegments = result.changes;
    }

    // 古い監査ログを削除
    if (auditLogsOlderThanDays > 0) {
      const cutoff = Math.floor(Date.now() / 1000) - (auditLogsOlderThanDays * 24 * 60 * 60);
      const result = await db.delete(auditLogs)
        .where(sql`${auditLogs.timestamp} < ${cutoff}`);
      deletedAuditLogs = result.changes;
    }

    // VACUUM実行（断片化解消）
    sqlite.exec('VACUUM');

    return {
      deletedDetections,
      deletedSegments,
      deletedAuditLogs,
    };
  }

  async optimizeDatabase(): Promise<void> {
    // WALチェックポイント実行
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
    
    // 統計情報更新
    sqlite.exec('ANALYZE');
    
    // インクリメンタルVACUUM
    sqlite.pragma('incremental_vacuum');
  }
}
```

---

## 5. マイグレーション戦略

### 5.1 初期マイグレーション

```bash
# スキーマからSQLを生成
npx drizzle-kit generate:sqlite

# マイグレーション実行
npx drizzle-kit push:sqlite
```

### 5.2 カスタムマイグレーション実行

```ts
// src/main/db/migrations/runner.ts
import fs from 'fs';
import path from 'path';
import { sqlite } from '../client';

export class MigrationRunner {
  private customMigrationsDir = path.join(__dirname, 'custom');
  
  async runCustomMigrations(): Promise<void> {
    // カスタムマイグレーションテーブル作成
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS custom_migrations (
        id INTEGER PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )
    `);
    
    // 適用済みマイグレーション取得
    const applied = new Set(
      sqlite.prepare('SELECT filename FROM custom_migrations')
        .all()
        .map((r: any) => r.filename)
    );
    
    // SQLファイル一覧取得
    const files = fs.readdirSync(this.customMigrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // 未適用のマイグレーション実行
    for (const file of files) {
      if (!applied.has(file)) {
        const sql = fs.readFileSync(
          path.join(this.customMigrationsDir, file),
          'utf-8'
        );
        
        sqlite.transaction(() => {
          sqlite.exec(sql);
          sqlite.prepare(
            'INSERT INTO custom_migrations (filename) VALUES (?)'
          ).run(file);
        })();
        
        console.log(`Applied migration: ${file}`);
      }
    }
  }
}
```

### 5.3 v1.1からv2.0への移行

```sql
-- migration_v1_to_v2.sql

-- 1. 時刻列の変換（TEXT → INTEGER）
-- tasksテーブル
ALTER TABLE tasks RENAME TO tasks_old;
CREATE TABLE tasks (
  -- ... Drizzleで生成されたスキーマ ...
);

INSERT INTO tasks 
SELECT 
  id, url, media_type, filename, save_dir, output_path,
  status, priority, downloaded_bytes, total_bytes, speed_bps,
  percent, eta_ms, error_code, error_message, error_details,
  retry_count, page_url, page_title, thumbnail_url, duration_sec,
  headers, variant, quality_rule, metadata,
  strftime('%s', created_at) as created_at,
  CASE WHEN started_at IS NOT NULL THEN strftime('%s', started_at) ELSE NULL END as started_at,
  CASE WHEN paused_at IS NOT NULL THEN strftime('%s', paused_at) ELSE NULL END as paused_at,
  CASE WHEN completed_at IS NOT NULL THEN strftime('%s', completed_at) ELSE NULL END as completed_at,
  strftime('%s', updated_at) as updated_at
FROM tasks_old;

DROP TABLE tasks_old;

-- 2. 統計テーブルの正規化
-- 既存のJSONデータを新テーブルに移行
INSERT INTO statistics_domains (date, domain, count, bytes)
SELECT 
  date,
  json_extract(value, '$.domain') as domain,
  json_extract(value, '$.count') as count,
  json_extract(value, '$.bytes') as bytes
FROM statistics, json_each(statistics.domain_stats)
WHERE domain_stats IS NOT NULL;

INSERT INTO statistics_media_types (date, media_type, count, bytes)
SELECT 
  date,
  json_extract(value, '$.type') as media_type,
  json_extract(value, '$.count') as count,
  json_extract(value, '$.bytes') as bytes
FROM statistics, json_each(statistics.media_type_stats)
WHERE media_type_stats IS NOT NULL;

-- 3. 旧カラム削除
ALTER TABLE statistics DROP COLUMN domain_stats;
ALTER TABLE statistics DROP COLUMN media_type_stats;
```

---

## 6. テスト戦略

### 6.1 ユニットテスト

```ts
// src/main/db/__tests__/task.repository.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { TaskRepository } from '../repositories/task.repository';

describe('TaskRepository', () => {
  let db: ReturnType<typeof drizzle>;
  let repo: TaskRepository;
  
  beforeEach(() => {
    // インメモリDBでテスト
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    
    // スキーマ作成
    sqlite.exec(/* スキーマSQL */);
    
    repo = new TaskRepository(db);
  });
  
  it('should create a task', async () => {
    const id = await repo.create({
      url: 'https://example.com/video.m3u8',
      type: 'hls',
      saveDir: '/downloads',
    });
    
    expect(id).toBeDefined();
    
    const task = await repo.getById(id);
    expect(task).toBeDefined();
    expect(task?.url).toBe('https://example.com/video.m3u8');
  });
  
  it('should handle JSON fields correctly', async () => {
    const id = await repo.create({
      url: 'https://example.com/video.mp4',
      type: 'file',
      saveDir: '/downloads',
      metadata: { title: 'Test Video', tags: ['test', 'video'] },
    });
    
    const task = await repo.getById(id);
    const metadata = JSON.parse(task?.metadata || '{}');
    
    expect(metadata.title).toBe('Test Video');
    expect(metadata.tags).toEqual(['test', 'video']);
  });
});
```

### 6.2 マイグレーションテスト

```ts
// src/main/db/__tests__/migration.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { MigrationRunner } from '../migrations/runner';

describe('Migrations', () => {
  let sqlite: Database.Database;
  let runner: MigrationRunner;
  
  beforeEach(() => {
    sqlite = new Database(':memory:');
    runner = new MigrationRunner(sqlite);
  });
  
  it('should apply all migrations in order', async () => {
    await runner.runCustomMigrations();
    
    // ビューが作成されているか確認
    const views = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='view'"
    ).all();
    
    expect(views).toContainEqual({ name: 'active_tasks' });
    expect(views).toContainEqual({ name: 'daily_stats' });
  });
  
  it('should not reapply migrations', async () => {
    await runner.runCustomMigrations();
    await runner.runCustomMigrations(); // 2回目
    
    // エラーが発生しないこと
    expect(true).toBe(true);
  });
});
```

---

## 7. パフォーマンス最適化

### 7.1 クエリ最適化

```ts
// バッチ操作の例
export class BatchOperations {
  // プリペアドステートメントのキャッシュ
  private statements = new Map<string, any>();
  
  async batchInsertTasks(specs: DownloadSpec[]): Promise<void> {
    // トランザクション内でバッチ挿入
    await db.transaction(async (tx) => {
      for (const spec of specs) {
        await tx.insert(tasks).values({
          id: crypto.randomUUID(),
          url: spec.url,
          mediaType: spec.type,
          // ...
        });
      }
    });
  }
  
  // SQLiteの制限を考慮した大量更新
  async batchUpdateProgress(updates: Array<{ id: string; progress: number }>) {
    // SQLiteのプレースホルダ制限（999個）を考慮
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      await db.transaction(async (tx) => {
        for (const { id, progress } of batch) {
          await tx.update(tasks)
            .set({ percent: progress })
            .where(eq(tasks.id, id));
        }
      });
    }
  }
}
```

### 7.2 インデックス利用の確認

```ts
export class QueryAnalyzer {
  analyze(query: string): void {
    const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
    
    const hasTableScan = plan.some((row: any) => 
      /SCAN TABLE/i.test(row.detail || '')
    );
    
    if (hasTableScan) {
      console.warn('⚠️ Table scan detected:', plan);
    }
  }
  
  // よく使うクエリのインデックス確認
  checkCommonQueries(): void {
    const queries = [
      'SELECT * FROM tasks WHERE status = "running"',
      'SELECT * FROM tasks WHERE priority > 0 ORDER BY priority DESC',
      'SELECT * FROM segments WHERE task_id = "test" AND status = "pending"',
    ];
    
    for (const query of queries) {
      console.log(`Analyzing: ${query}`);
      this.analyze(query);
    }
  }
}
```

---

## 8. セキュリティ考慮事項

### 8.1 SQLインジェクション対策

```ts
// ❌ 危険な例
const sql = `SELECT * FROM tasks WHERE id = '${userId}'`;

// ✅ 安全な例（Drizzle ORM）
const result = await db.select()
  .from(tasks)
  .where(eq(tasks.id, userId));

// ✅ 安全な例（プリペアドステートメント）
const stmt = sqlite.prepare('SELECT * FROM tasks WHERE id = ?');
const result = stmt.get(userId);
```

### 8.2 データ暗号化（オプション）

```ts
import crypto from 'crypto';

export class EncryptionHelper {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;
  
  constructor(key: string) {
    // 鍵はKeytarなどのセキュアストレージから取得
    this.key = crypto.scryptSync(key, 'salt', 32);
  }
  
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
    });
  }
  
  decrypt(encryptedData: string): string {
    const { iv, authTag, data } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

---

## 9. 監視とロギング

```ts
// src/main/db/monitoring/db-monitor.ts
export class DatabaseMonitor {
  private auditRepo: AuditLogRepository;
  
  async logQuery(category: string, event: string, context?: any): Promise<void> {
    await this.auditRepo.create({
      level: 'info',
      category,
      event,
      context: context ? JSON.stringify(context) : undefined,
    });
  }
  
  async logError(error: Error, taskId?: string): Promise<void> {
    await this.auditRepo.create({
      level: 'error',
      category: 'database',
      event: 'error',
      message: error.message,
      errorCode: (error as any).code,
      errorStack: error.stack,
      taskId,
    });
  }
  
  getMetrics(): {
    dbSize: number;
    walSize: number;
    cacheHitRate: number;
    activeConnections: number;
  } {
    const stats = new IntegrityChecker().getStats();
    
    return {
      dbSize: stats.totalSize,
      walSize: stats.walSize,
      cacheHitRate: this.calculateCacheHitRate(),
      activeConnections: 1, // better-sqlite3は単一接続
    };
  }
  
  private calculateCacheHitRate(): number {
    const stats = sqlite.prepare('SELECT * FROM sqlite_stat1').all();
    // 実装は環境依存
    return 0.95; // 仮の値
  }
}
```

---

## 10. まとめ

### 移行のメリット

1. **型安全性**: Drizzle ORMによる完全な型推論
2. **マイグレーション管理**: drizzle-kitによる自動化
3. **開発効率**: TypeScriptでのスキーマ定義
4. **保守性**: リポジトリパターンによる抽象化
5. **テスタビリティ**: インメモリDBでの高速テスト

### 注意点

1. **Raw SQL必須**: 生成列、ビュー、トリガーは手動管理
2. **JSON検証**: CHECK制約は手動追加が必要
3. **パフォーマンス**: 大量データ処理時はraw SQLも検討
4. **better-sqlite3制限**: 単一接続のみ（並行性に注意）

### 今後の拡張

1. **マイグレーション自動化**: CI/CDパイプライン統合
2. **メトリクス収集**: PrometheusやDatadog連携
3. **レプリケーション**: 読み取り専用レプリカの追加
4. **キャッシュ層**: Redis/Memcached統合

---

## 更新履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 2.0 | 2025-01-23 | Drizzle ORM対応、TypeScript型定義追加 |
| 1.1 | 2025-01-23 | UNIX時間統一、JSON検証、統計正規化 |
| 1.0 | 2025-01-23 | 初版作成 |