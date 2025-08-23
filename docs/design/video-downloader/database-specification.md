# Video Downloader SQLiteデータベース仕様書（改訂版 v1.1）

* **対象**: Video Downloader（Electron アプリ）
* **作成日**: 2025-01-23 (JST)
* **改訂要旨**: すべての時刻を **UNIX 時間（秒）** に統一 / JSON 列に `CHECK(json_valid(...))` を付与 / 統計の **正規化テーブル** 追加 / `updated_at` の **BEFORE UPDATE トリガー** 化 / バックアップ&リストア手順の安全化 / 監査ログの削除は定期ジョブへ移行

---

## 1. 概要

### 1.1 目的
Video Downloaderアプリの内部データ管理用SQLiteデータベース仕様を定義する。

### 1.2 技術スタック
* **DB**: SQLite 3.40+
* **Node.jsライブラリ**: better-sqlite3 v9.x
* **マイグレーション**: 内製マイグレーションシステム
* **バックアップ**: 自動バックアップ + `VACUUM INTO`

### 1.3 ファイル配置
```
~/AppData/Roaming/VideoDownloader/            (Windows)
~/Library/Application Support/VideoDownloader/ (macOS)
~/.config/VideoDownloader/                     (Linux)
  ├── database/
  │   ├── app.db           # メイン DB
  │   ├── app.db-wal       # Write-Ahead Log
  │   ├── app.db-shm       # 共有メモリ
  │   └── backups/
  │       ├── app_20250123_120000.db
  │       └── app_20250122_120000.db
```

---

## 2. データベース設定

### 2.1 接続 & PRAGMA

```ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

class DatabaseConnection {
  db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'database', 'app.db');
    this.db = new Database(dbPath, { verbose: process.env.NODE_ENV==='development' ? console.log : undefined });
    this.configure();
  }

  private configure() {
    // 重要: 既存 DB に auto_vacuum を有効化する場合は一度 VACUUM 必要
    this.db.pragma('journal_mode = WAL');            // クラッシュ耐性 & 併用性
    this.db.pragma('synchronous = NORMAL');          // 性能と安全のバランス
    this.db.pragma('foreign_keys = ON');             // 外部キー制約
    this.db.pragma('cache_size = -10000');           // 約 10MB (KB 指定)
    this.db.pragma('busy_timeout = 5000');           // ロック待ち
    this.db.pragma('page_size = 4096');              // デフォルト整合
    this.db.pragma('auto_vacuum = INCREMENTAL');     // 断片化抑制（新規 DB か、設定変更時に VACUUM 実行）
    this.db.pragma('mmap_size = 30000000');          // 30MB（環境次第で無視される）
    // wal_autocheckpoint を必要に応じ調整（既定は 1000 ページ）
    // this.db.pragma('wal_autocheckpoint = 1000');
  }
}
```

```

> 注: 既存 DB で `auto_vacuum` を変更した場合、**直後に `VACUUM`** を行わないと反映されません。

### 2.2 トランザクション管理

```ts
class TransactionManager {
  constructor(private db: Database.Database) {}

  immediate<T>(fn: () => T): T {
    const run = this.db.transaction(fn).immediate; // better-sqlite3 の即時トランザクション
    return run();
  }
  exclusive<T>(fn: () => T): T {
    const run = this.db.transaction(fn).exclusive; // 書き込み専用ロック
    return run();
  }
  deferred<T>(fn: () => T): T {
    const run = this.db.transaction(fn);          // 既定は遅延
    return run();
  }
}
```

```

---

## 3. テーブル定義

> **時刻カラムはすべて INTEGER（UNIX 秒）**。アプリ側で必要に応じて ISO8601 へ整形。

### 3.1 ダウンロードタスク `tasks`

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL, -- UUID v4

  -- 基本
  url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('hls','dash','file')),
  filename TEXT,
  save_dir TEXT NOT NULL,
  output_path TEXT,

  -- ステータス
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','paused','completed','error','canceled')),
  priority INTEGER NOT NULL DEFAULT 0,

  -- 進捗
  downloaded_bytes INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER,
  speed_bps REAL,                                   -- 単位: Bytes/s
  percent REAL CHECK(percent IS NULL OR (percent>=0 AND percent<=100)),
  eta_ms INTEGER,

  -- エラー
  error_code TEXT,
  error_message TEXT,
  error_details TEXT CHECK (error_details IS NULL OR json_valid(error_details)),
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- メタ
  page_url TEXT,
  page_title TEXT,
  thumbnail_url TEXT,
  duration_sec REAL,
  headers TEXT CHECK (headers IS NULL OR json_valid(headers)),
  variant TEXT CHECK (variant IS NULL OR json_valid(variant)),
  quality_rule TEXT CHECK (quality_rule IS NULL OR json_valid(quality_rule)),
  metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata)),

  -- 時刻（UNIX 秒）
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  started_at INTEGER,
  paused_at INTEGER,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),

  -- 生成列: ドメイン
  domain TEXT GENERATED ALWAYS AS (
    CASE WHEN url LIKE 'http%'
      THEN substr(url, instr(url, '://')+3,
           CASE WHEN instr(substr(url, instr(url,'://')+3), '/')>0
                THEN instr(substr(url, instr(url,'://')+3), '/')-1
                ELSE length(url) END)
      ELSE NULL END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority         ON tasks(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_domain           ON tasks(domain);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at       ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority  ON tasks(status, priority DESC)
  WHERE status IN ('queued','paused');
```

### 3.2 セグメント管理 `segments`

```sql
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,

  segment_index INTEGER NOT NULL,
  url TEXT NOT NULL,
  duration_sec REAL,
  size_bytes INTEGER,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','downloading','completed','error')),
  retry_count INTEGER NOT NULL DEFAULT 0,

  temp_path TEXT,
  error_message TEXT,

  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  downloaded_at INTEGER,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_segments_task_status ON segments(task_id, status);
CREATE INDEX IF NOT EXISTS idx_segments_status      ON segments(status)
  WHERE status IN ('pending','downloading');
```

### 3.3 設定管理 `settings`

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,               -- "category.key"
  value TEXT NOT NULL,                         -- JSON 文字列
  type  TEXT CHECK(type IN ('string','number','boolean','object','array','null')),
  description TEXT,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_by TEXT DEFAULT 'system'
);

-- デフォルト（例）
INSERT OR IGNORE INTO settings (key,value,type,description) VALUES
 ('general.downloadDirectory', '""', 'string',  'Default download directory'),
 ('general.maxConcurrentDownloads', '3', 'number','Maximum concurrent downloads'),
 ('general.autoStartDownload', 'true', 'boolean','Auto start downloads'),
 ('general.notificationEnabled', 'true', 'boolean','Enable notifications'),
 ('ffmpeg.path', '"ffmpeg"', 'string','FFmpeg executable path'),
 ('ffmpeg.args', '[]', 'array','Additional FFmpeg arguments'),
 ('ui.theme', '"system"', 'string','UI theme'),
 ('ui.language', '"en"', 'string','UI language'),
 ('quality.preference', '"highest"', 'string','Quality preference'),
 ('quality.customRule', 'null', 'null','Custom quality rules'),
 ('network.proxy', 'null', 'null','Proxy configuration'),
 ('network.userAgent', 'null', 'null','Custom user agent'),
 ('detection.enabled', 'true', 'boolean','Enable video detection'),
 ('detection.minFileSize', '1048576', 'number','Minimum file size (bytes)'),
 ('detection.maxFileSize', '10737418240', 'number','Maximum file size (bytes)'),
 ('retry.downloadMaxAttempts', '3', 'number','Max download retry attempts'),
 ('retry.segmentMaxAttempts', '5', 'number','Max segment retry attempts'),
 ('retry.segmentTimeoutMs', '30000', 'number','Segment timeout (ms)');
```

### 3.4 検出履歴 `detections`

```sql
CREATE TABLE IF NOT EXISTS detections (
  id TEXT PRIMARY KEY NOT NULL, -- dedupKey
  url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('hls','dash','file')),
  page_url TEXT,
  page_title TEXT,
  thumbnail_url TEXT,
  duration_sec REAL,
  file_size_bytes INTEGER,
  variants TEXT CHECK (variants IS NULL OR json_valid(variants)), -- VideoVariant[]
  headers  TEXT CHECK (headers IS NULL OR json_valid(headers)),
  skip_reason TEXT CHECK (skip_reason IN ('drm','403','cors','mime-mismatch','widevine-hint','live')),
  detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  download_count INTEGER NOT NULL DEFAULT 0,
  auto_delete INTEGER NOT NULL DEFAULT 0 -- 0/1
);

CREATE INDEX IF NOT EXISTS idx_detections_detected_at ON detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_detections_page_url    ON detections(page_url);
CREATE INDEX IF NOT EXISTS idx_detections_auto_delete ON detections(auto_delete, detected_at);
```

### 3.5 Smart Naming ルール `naming_rules`

```sql
CREATE TABLE IF NOT EXISTS naming_rules (
  id TEXT PRIMARY KEY NOT NULL,
  site_pattern TEXT NOT NULL,                 -- 正規表現
  tokens TEXT NOT NULL CHECK(json_valid(tokens)),  -- JSON 配列
  template TEXT NOT NULL DEFAULT '{title}.{ext}',
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_naming_rules_enabled_priority ON naming_rules(enabled, priority DESC);
```

### 3.6 ダウンロード統計（正規化）

```sql
-- 日次集計 (JSON フィールドは廃止)
CREATE TABLE IF NOT EXISTS statistics (
  date TEXT PRIMARY KEY NOT NULL, -- YYYY-MM-DD
  total_downloads INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  canceled_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  total_time_ms INTEGER NOT NULL DEFAULT 0,
  average_speed_bps REAL NOT NULL DEFAULT 0
);

-- ドメイン別日次集計
CREATE TABLE IF NOT EXISTS statistics_domains (
  date TEXT NOT NULL,
  domain TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, domain),
  FOREIGN KEY (date) REFERENCES statistics(date) ON DELETE CASCADE
);

-- メディアタイプ別日次集計
CREATE TABLE IF NOT EXISTS statistics_media_types (
  date TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('hls','dash','file')),
  count INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, media_type),
  FOREIGN KEY (date) REFERENCES statistics(date) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date DESC);
```

### 3.7 監査ログ `audit_logs`

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  level TEXT NOT NULL CHECK(level IN ('debug','info','warn','error')),
  category TEXT NOT NULL, -- 'download','detection','settings','security'
  event TEXT NOT NULL,
  message TEXT,
  task_id TEXT,
  user_id TEXT,
  context TEXT CHECK (context IS NULL OR json_valid(context)),
  error_code TEXT,
  error_stack TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level     ON audit_logs(level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category  ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id   ON audit_logs(task_id);
```

> 旧: INSERT トリガーでの自動削除は高負荷となり得るため **廃止**。削除はメンテナンスジョブで実施（§10）。

---

## 4. ビュー

### 4.1 アクティブタスク

```sql
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
```

### 4.2 日次タスク統計

```sql
CREATE VIEW IF NOT EXISTS daily_stats AS
SELECT
  date(datetime(t.created_at,'unixepoch')) AS date,
  COUNT(*) AS total_tasks,
  SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN t.status='error' THEN 1 ELSE 0 END)     AS errors,
  SUM(t.downloaded_bytes) AS total_bytes,
  AVG(t.speed_bps) AS avg_speed
FROM tasks t
GROUP BY date;
```

```

---

## 5. トリガー

### 5.1 `updated_at` 自動更新（無限ループ防止）

```sql
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at -- ユーザー側で直接更新しなかった場合
BEGIN
  UPDATE tasks SET updated_at = (strftime('%s','now')) WHERE id = NEW.id;
END;
```

### 5.2 ステータス変更での統計更新

```sql
-- 完了時: 日次統計 + ドメイン/メディアタイプ集計反映
CREATE TRIGGER IF NOT EXISTS trg_tasks_completed_stats
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN NEW.status='completed' AND OLD.status IS NOT 'completed'
BEGIN
  INSERT INTO statistics(date,total_downloads,completed_count,total_bytes)
  VALUES (date(datetime(COALESCE(NEW.completed_at, strftime('%s','now')),'unixepoch')),1,1,COALESCE(NEW.downloaded_bytes,0))
  ON CONFLICT(date) DO UPDATE SET
    total_downloads = total_downloads + 1,
    completed_count = completed_count + 1,
    total_bytes = total_bytes + COALESCE(NEW.downloaded_bytes,0);

  INSERT INTO statistics_domains(date,domain,count,bytes)
  VALUES (date(datetime(COALESCE(NEW.completed_at, strftime('%s','now')),'unixepoch')), NEW.domain, 1, COALESCE(NEW.downloaded_bytes,0))
  ON CONFLICT(date,domain) DO UPDATE SET
    count = count + 1,
    bytes = bytes + COALESCE(NEW.downloaded_bytes,0);

  INSERT INTO statistics_media_types(date,media_type,count,bytes)
  VALUES (date(datetime(COALESCE(NEW.completed_at, strftime('%s','now')),'unixepoch')), NEW.media_type, 1, COALESCE(NEW.downloaded_bytes,0))
  ON CONFLICT(date,media_type) DO UPDATE SET
    count = count + 1,
    bytes = bytes + COALESCE(NEW.downloaded_bytes,0);
END;
```

> 必要なら `error`/`canceled` も同様に反映するトリガーを追加してください。

---

## 6. マイグレーション管理

### 6.1 テーブル

```sql
CREATE TABLE IF NOT EXISTS migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
```

### 6.2 実装例

```ts
interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

class MigrationManager {
  constructor(private db: Database.Database) {}

  private ensureTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now')));`);
  }

  private currentVersion(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(version),0) AS v FROM migrations').get();
    return row.v as number;
  }

  migrate(migrations: Migration[]) {
    this.ensureTable();
    const cur = this.currentVersion();
    const pending = migrations.filter(m => m.version > cur).sort((a,b)=>a.version-b.version);
    const run = this.db.transaction(() => {
      for (const m of pending) {
        m.up(this.db);
        this.db.prepare('INSERT INTO migrations(version,name) VALUES (?,?)').run(m.version, m.name);
      }
    }).exclusive; // 一括で排他
    run();
  }
}
```

---

## 7. バックアップ & リカバリ

### 7.1 自動バックアップ

```ts
class BackupManager {
  constructor(private db: Database.Database, private backupDir: string, private mainPath: string, private maxBackups = 7) {}

  createBackup(): string {
    const ts = new Date().toISOString().replace(/[:.]/g,'').replace('T','_').slice(0,15);
    const dst = path.join(this.backupDir, `app_${ts}.db`);
    this.db.exec(`VACUUM INTO '${dst.replace(/'/g, "''")}'`); // エスケープ注意
    this.cleanup();
    return dst;
  }

  cleanup() {
    const files = fs.readdirSync(this.backupDir).filter(f=>/^app_\d{8}_\d{6}\.db$/.test(f)).sort().reverse();
    for (const f of files.slice(this.maxBackups)) fs.unlinkSync(path.join(this.backupDir,f));
  }

  restore(backupPath: string) {
    // 1) 接続を閉じる
    this.db.close();
    // 2) wal/shm を削除
    for (const ext of ['-wal','-shm']) { const p = this.mainPath+ext; if (fs.existsSync(p)) fs.unlinkSync(p); }
    // 3) 上書きコピー
    fs.copyFileSync(backupPath, this.mainPath);
    // 4) 新規接続は上位で再生成
  }
}
```

### 7.2 整合性チェック

```ts
class IntegrityChecker {
  constructor(private db: Database.Database) {}
  check(): boolean {
    const res = this.db.pragma('integrity_check');
    const ok = Array.isArray(res) ? res[0]?.integrity_check === 'ok' : false;
    const fk = this.db.pragma('foreign_key_check');
    return ok && (!Array.isArray(fk) || fk.length === 0);
  }
  repair() { this.db.exec('REINDEX'); this.db.exec('VACUUM'); this.db.exec('ANALYZE'); }
}
```

---

## 8. パフォーマンス最適化

### 8.1 ステートメントキャッシュ & バッチ

```ts
class QueryOptimizer {
  private stmts = new Map<string, Database.Statement>();
  constructor(private db: Database.Database) {}
  prepare(key: string, sql: string) { if (!this.stmts.has(key)) this.stmts.set(key, this.db.prepare(sql)); return this.stmts.get(key)!; }
  insertTasksBatch(tasks: {id:string;url:string;media_type:string;filename?:string;save_dir:string;}[]) {
    const insert = this.prepare('insertTask', `INSERT INTO tasks (id,url,media_type,filename,save_dir) VALUES (?,?,?,?,?)`);
    const run = this.db.transaction((rows:any[])=>{ for (const t of rows) insert.run(t.id,t.url,t.media_type,t.filename,t.save_dir); });
    run(tasks);
  }
}
```

### 8.2 クエリプラン確認

```ts
class QueryAnalyzer {
  constructor(private db: Database.Database) {}
  explain(sql: string, params?: any[]) {
    const plan = params ? this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) : this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    const hasScan = plan.some((r:any)=>/SCAN TABLE/i.test(r.detail||''));
    if (hasScan) console.warn('⚠️ Table scan detected:', plan);
  }
}
```

---

## 9. セキュリティ考慮

### 9.1 SQL インジェクション

```ts
// ✅ プレースホルダ使用
const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
const row = stmt.get(taskId);
```

### 9.2 フィールド暗号化（オプション）

* 機微情報は **列単位の AES-256-GCM** を使用（鍵は Keytar に保存。鍵 ID のみ DB に格納）。
* 鍵ローテーション手順を別紙で定義。
---

## 10. メンテナンス

### 10.1 サイズ管理 & クリーニング

```ts
class MaintenanceManager {
  constructor(private db: Database.Database, private dbPath: string) {}
  getDbSize(): number { return fs.statSync(this.dbPath).size; }
  cleanup() {
    // 自動削除フラグ付き検出の期限切れ清掃
    this.db.prepare(`DELETE FROM detections WHERE auto_delete=1 AND detected_at < (strftime('%s','now') - 30*24*3600)`).run();
    // 完了セグメントの清掃
    this.db.prepare(`DELETE FROM segments WHERE task_id IN (SELECT id FROM tasks WHERE status='completed' AND completed_at < (strftime('%s','now') - 7*24*3600))`).run();
    this.db.exec('VACUUM');
  }
}
```

### 10.2 監査ログの保持

* 例: 30 日で削除

```ts
function cleanupAuditLogs(db: Database.Database, days=30) {
  db.prepare(`DELETE FROM audit_logs WHERE timestamp < (strftime('%s','now') - ?*24*3600)`).run(days);
}
```

---

## 11. エラーハンドリング

```ts
enum DatabaseError {
  CONSTRAINT_VIOLATION = 'SQLITE_CONSTRAINT',
  BUSY = 'SQLITE_BUSY',
  LOCKED = 'SQLITE_LOCKED',
  CORRUPT = 'SQLITE_CORRUPT',
  DISK_FULL = 'SQLITE_FULL',
}

class DatabaseErrorHandler {
  constructor(private db: Database.Database) {}
  handle(error: any) {
    switch (error?.code) {
      case DatabaseError.CONSTRAINT_VIOLATION: console.error('Constraint violation', error); break;
      case DatabaseError.BUSY:
      case DatabaseError.LOCKED: console.warn('DB locked, consider retry/backoff'); break;
      case DatabaseError.CORRUPT: console.error('DB corrupted, restore from backup'); break;
      case DatabaseError.DISK_FULL: console.error('Disk full'); break;
      default: console.error('Unknown DB error', error);
    }
  }
}
```

## 12. 使用例

### 12.1 タスクの作成と更新
```typescript
class TaskRepository {
  createTask(spec: DownloadSpec): string {
    const id = crypto.randomUUID();
    
    this.db.prepare(`
      INSERT INTO tasks (
        id, url, media_type, filename, save_dir,
        headers, variant, quality_rule, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      spec.url,
      spec.type,
      spec.filename,
      spec.saveDir,
      JSON.stringify(spec.headers || {}),
      JSON.stringify(spec.variant || null),
      JSON.stringify(spec.qualityRule || null),
      JSON.stringify(spec.metadata || {})
    );
    
    return id;
  }
  
  updateProgress(taskId: string, progress: DownloadProgress): void {
    this.db.prepare(`
      UPDATE tasks SET
        downloaded_bytes = ?,
        total_bytes = ?,
        speed_bps = ?,
        percent = ?,
        eta_ms = ?
      WHERE id = ?
    `).run(
      progress.downloadedBytes,
      progress.totalBytes,
      progress.speedBps,
      progress.percent,
      progress.etaMs,
      taskId
    );
  }
}
```

### 12.2 設定取得/更新

```ts
class SettingsRepository {
  constructor(private db: Database.Database) {}
  get<T>(key: string): T | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? JSON.parse(row.value) as T : null;
  }
  set<T>(key: string, value: T): void {
    const type = Array.isArray(value) ? 'array' : (value===null ? 'null' : typeof value);
    this.db.prepare(`
      INSERT INTO settings(key,value,type) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, type=excluded.type, updated_at=(strftime('%s','now'))
    `).run(key, JSON.stringify(value), type);
  }
}
```

---

## 13. 互換性/移行メモ（v1.0 → v1.1）

* **時刻列**: TEXT → INTEGER(UNIX 秒)。既存列は `ALTER TABLE ... RENAME` + 新列追加 & データ移送で移行。
* **statistics の JSON 集計列**: 廃止し、`statistics_domains` / `statistics_media_types` に移管（移行スクリプトで日次再集計）。
* **updated_at トリガー**: AFTER → AFTER/条件付き UPDATE（またはアプリ側で常に更新）。
* **cleanup_old_audit_logs トリガー**: 廃止 → メンテナンスジョブへ。

---

## 更新履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.1 | 2025-01-23 | UNIX時間統一、JSON検証、統計正規化、トリガー最適化 |
| 1.0 | 2025-01-23 | 初版作成 |