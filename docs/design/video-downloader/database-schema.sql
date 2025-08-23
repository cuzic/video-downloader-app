-- Video Downloader SQLite Database Schema
-- better-sqlite3を使用した永続化層の設計

-- ===============================================
-- ダウンロードタスクテーブル（メイン）
-- ===============================================
CREATE TABLE IF NOT EXISTS tasks (
    -- 基本情報
    id TEXT PRIMARY KEY,                    -- UUID v4
    url TEXT NOT NULL,                      -- ダウンロード元URL
    type TEXT NOT NULL,                     -- 'hls' | 'dash' | 'file'
    title TEXT,                             -- 動画タイトル
    quality TEXT,                           -- 選択された品質（resolution/bitrate）
    
    -- ステータス管理
    state TEXT NOT NULL DEFAULT 'PENDING',  -- 状態遷移
    -- PENDING → PARSING → READY → RUNNING → PAUSED → COMPLETED / FAILED / CANCELED
    sub_state TEXT,                         -- RUNNING時のサブ状態
    -- connecting | fetching | merging | postprocessing
    
    -- ファイル情報
    filename TEXT NOT NULL,                 -- 保存ファイル名
    save_dir TEXT NOT NULL,                 -- 保存先ディレクトリ
    tmp_path TEXT,                          -- 一時ファイルパス
    final_path TEXT,                        -- 最終ファイルパス
    
    -- サイズと進捗
    total_bytes INTEGER,                    -- 総サイズ（バイト）
    downloaded_bytes INTEGER DEFAULT 0,     -- ダウンロード済みサイズ
    progress_percent REAL DEFAULT 0,        -- 進捗率（0-100）
    
    -- パフォーマンス
    speed_bps INTEGER,                      -- 現在の速度（bits per second）
    eta_ms INTEGER,                         -- 推定残り時間（ミリ秒）
    download_time_ms INTEGER,               -- 実際のダウンロード時間
    
    -- 優先度とスケジューリング
    priority INTEGER DEFAULT 0,             -- 優先度（高い値が優先）
    max_concurrent_segments INTEGER DEFAULT 3, -- 同時セグメント数
    
    -- エラー管理
    error_code TEXT,                        -- エラーコード
    error_message TEXT,                     -- エラーメッセージ
    retry_count INTEGER DEFAULT 0,          -- リトライ回数
    max_retries INTEGER DEFAULT 3,          -- 最大リトライ回数
    
    -- タイムスタンプ
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    paused_at DATETIME,
    completed_at DATETIME,
    
    -- メタデータ（JSON形式）
    headers_json TEXT,                      -- HTTPヘッダー
    variant_json TEXT,                      -- 選択されたバリアント情報
    retry_policy_json TEXT,                 -- リトライポリシー
    metadata_json TEXT,                     -- その他のメタデータ
    
    CHECK (type IN ('hls', 'dash', 'file')),
    CHECK (state IN ('PENDING', 'PARSING', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELED'))
);

-- ===============================================
-- タスクのソース情報（認証・Cookie等）
-- ===============================================
CREATE TABLE IF NOT EXISTS task_sources (
    task_id TEXT PRIMARY KEY,
    referer TEXT,                           -- リファラー
    user_agent TEXT,                        -- User-Agent
    headers_json TEXT,                      -- その他のヘッダー（JSON）
    cookie_partition TEXT,                  -- Cookieパーティション識別子
    auth_type TEXT,                         -- 認証タイプ（none/basic/bearer/custom）
    -- 認証情報は保存せず、keytarで管理
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ===============================================
-- セグメント管理（HLS/DASH用）
-- ===============================================
CREATE TABLE IF NOT EXISTS segments (
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,                   -- セグメントインデックス
    url TEXT NOT NULL,                      -- セグメントURL
    duration_ms INTEGER,                    -- セグメント長さ（ミリ秒）
    bytes INTEGER,                          -- セグメントサイズ
    hash TEXT,                              -- ファイルハッシュ（検証用）
    state TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | DOWNLOADING | COMPLETED | FAILED
    error_count INTEGER DEFAULT 0,          -- エラー回数
    last_error TEXT,                        -- 最後のエラー
    downloaded_at DATETIME,                 -- ダウンロード完了時刻
    
    PRIMARY KEY (task_id, idx),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CHECK (state IN ('PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED'))
);

-- ===============================================
-- ファイル管理
-- ===============================================
CREATE TABLE IF NOT EXISTS files (
    task_id TEXT PRIMARY KEY,
    tmp_path TEXT NOT NULL,                 -- 一時ファイルパス
    final_path TEXT,                        -- 最終ファイルパス
    bytes INTEGER,                          -- ファイルサイズ
    hash TEXT,                              -- ファイルハッシュ（SHA256）
    mime_type TEXT,                         -- MIMEタイプ
    duration_ms INTEGER,                    -- 動画の長さ（ミリ秒）
    width INTEGER,                          -- 動画の幅
    height INTEGER,                         -- 動画の高さ
    codec_info TEXT,                        -- コーデック情報（JSON）
    completed_at DATETIME,                  -- 完了時刻
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ===============================================
-- エラーログ
-- ===============================================
CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    phase TEXT NOT NULL,                    -- 'detection' | 'parsing' | 'download' | 'postprocess' | 'system'
    code TEXT,                              -- エラーコード
    message TEXT NOT NULL,                  -- エラーメッセージ
    detail_json TEXT,                       -- 詳細情報（JSON）
    stack_trace TEXT,                       -- スタックトレース
    retry_able BOOLEAN DEFAULT FALSE,       -- リトライ可能か
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- ===============================================
-- 検出された動画候補
-- ===============================================
CREATE TABLE IF NOT EXISTS detected_videos (
    id TEXT PRIMARY KEY,                    -- dedupKey（重複防止用）
    url TEXT NOT NULL UNIQUE,               -- 動画URL
    type TEXT NOT NULL,                     -- 'hls' | 'dash' | 'file'
    page_url TEXT,                          -- 検出元ページURL
    page_title TEXT,                        -- ページタイトル
    thumbnail_url TEXT,                     -- サムネイルURL
    duration_ms INTEGER,                    -- 動画の長さ
    size_bytes INTEGER,                     -- ファイルサイズ（推定）
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    variants_json TEXT,                     -- 利用可能な品質リスト（JSON）
    headers_json TEXT,                      -- 必要なHTTPヘッダー（JSON）
    downloaded BOOLEAN DEFAULT FALSE,       -- ダウンロード済みフラグ
    skip_reason TEXT,                       -- スキップ理由（DRM等）
    
    CHECK (type IN ('hls', 'dash', 'file'))
);

-- ===============================================
-- アプリケーション設定（Key-Value形式）
-- ===============================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,                    -- JSON形式で保存
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- デフォルト設定の挿入
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('download_directory', json_quote('~/Downloads/VideoDownloader')),
    ('max_concurrent_downloads', '3'),
    ('max_concurrent_segments', '3'),
    ('auto_start_download', 'false'),
    ('notification_enabled', 'true'),
    ('ffmpeg_path', json_quote('ffmpeg')),
    ('proxy_enabled', 'false'),
    ('ui_theme', json_quote('light')),
    ('language', json_quote('ja')),
    ('auto_update_enabled', 'true'),
    ('download_retry_policy', json_object(
        'max_attempts', 3,
        'backoff', 'exponential',
        'initial_delay_ms', 1000,
        'max_delay_ms', 30000
    )),
    ('segment_retry_policy', json_object(
        'max_attempts', 5,
        'timeout_ms', 30000
    )),
    ('quality_preference', json_quote('highest')),
    ('duplicate_action', json_quote('ask')),
    ('smart_naming_enabled', 'true'),
    ('smart_naming_template', json_quote('{site}-{title}-{quality}-{date}')),
    ('bandwidth_limit_enabled', 'false'),
    ('bandwidth_limit_mbps', '0'),
    ('completed_notification', json_object(
        'enabled', true,
        'auto_open_folder', false
    ));

-- ===============================================
-- Smart Naming トークン定義
-- ===============================================
CREATE TABLE IF NOT EXISTS naming_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_pattern TEXT NOT NULL,             -- サイトURLパターン（正規表現）
    token_name TEXT NOT NULL,               -- トークン名（{title}等）
    selector TEXT,                          -- CSSセレクタ
    regex_pattern TEXT,                     -- 正規表現パターン
    regex_group INTEGER DEFAULT 0,          -- 抽出グループ番号
    fallback_value TEXT,                    -- フォールバック値
    priority INTEGER DEFAULT 0,             -- 優先度
    enabled BOOLEAN DEFAULT TRUE,
    
    UNIQUE(site_pattern, token_name)
);

-- サンプルトークン定義
INSERT OR IGNORE INTO naming_tokens (site_pattern, token_name, selector, fallback_value) VALUES
    ('.*youtube\.com.*', 'title', 'h1.title', 'video'),
    ('.*youtube\.com.*', 'channel', 'ytd-channel-name', 'unknown'),
    ('.*vimeo\.com.*', 'title', 'h1', 'video'),
    ('.*', 'title', 'title', 'video'),
    ('.*', 'date', NULL, '{yyyy}-{mm}-{dd}');

-- ===============================================
-- ダウンロード履歴
-- ===============================================
CREATE TABLE IF NOT EXISTS download_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    url TEXT NOT NULL,
    title TEXT,
    filename TEXT NOT NULL,
    save_path TEXT NOT NULL,
    type TEXT NOT NULL,
    file_size INTEGER,
    download_time_ms INTEGER,
    average_speed_bps INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- ===============================================
-- 統計情報
-- ===============================================
CREATE TABLE IF NOT EXISTS statistics (
    date DATE PRIMARY KEY,
    total_downloads INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    total_time_ms INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    hls_count INTEGER DEFAULT 0,
    dash_count INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0
);

-- ===============================================
-- インデックス（パフォーマンス最適化）
-- ===============================================

-- タスク関連
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_state_priority ON tasks(state, priority DESC);

-- セグメント関連
CREATE INDEX IF NOT EXISTS idx_segments_task_state ON segments(task_id, state);
CREATE INDEX IF NOT EXISTS idx_segments_state ON segments(state);

-- 検出動画関連
CREATE INDEX IF NOT EXISTS idx_detected_videos_detected_at ON detected_videos(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_detected_videos_page_url ON detected_videos(page_url);
CREATE INDEX IF NOT EXISTS idx_detected_videos_downloaded ON detected_videos(downloaded);

-- エラーログ関連
CREATE INDEX IF NOT EXISTS idx_errors_task_id ON errors(task_id);
CREATE INDEX IF NOT EXISTS idx_errors_occurred_at ON errors(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_phase ON errors(phase);

-- 履歴関連
CREATE INDEX IF NOT EXISTS idx_download_history_completed_at ON download_history(completed_at DESC);

-- ===============================================
-- ビュー
-- ===============================================

-- アクティブタスクビュー
CREATE VIEW IF NOT EXISTS active_tasks AS
SELECT 
    t.id,
    t.url,
    t.title,
    t.filename,
    t.state,
    t.sub_state,
    t.progress_percent,
    t.speed_bps,
    t.eta_ms,
    t.priority,
    t.started_at,
    COUNT(CASE WHEN s.state = 'COMPLETED' THEN 1 END) as completed_segments,
    COUNT(s.idx) as total_segments
FROM tasks t
LEFT JOIN segments s ON t.id = s.task_id
WHERE t.state IN ('RUNNING', 'READY', 'PAUSED', 'PENDING', 'PARSING')
GROUP BY t.id
ORDER BY 
    CASE t.state 
        WHEN 'RUNNING' THEN 1 
        WHEN 'PAUSED' THEN 2 
        WHEN 'READY' THEN 3
        WHEN 'PARSING' THEN 4
        WHEN 'PENDING' THEN 5
    END,
    t.priority DESC,
    t.created_at ASC;

-- ダウンロード統計ビュー
CREATE VIEW IF NOT EXISTS download_stats AS
SELECT 
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN state = 'COMPLETED' THEN 1 END) as completed_count,
    COUNT(CASE WHEN state = 'FAILED' THEN 1 END) as failed_count,
    COUNT(CASE WHEN state IN ('RUNNING', 'READY', 'PAUSED', 'PENDING', 'PARSING') THEN 1 END) as active_count,
    SUM(CASE WHEN state = 'COMPLETED' THEN downloaded_bytes ELSE 0 END) as total_downloaded_bytes,
    AVG(CASE WHEN state = 'COMPLETED' AND download_time_ms > 0 
        THEN downloaded_bytes * 8.0 / download_time_ms * 1000 
        ELSE NULL END) as avg_speed_bps
FROM tasks;

-- 最近の検出動画ビュー
CREATE VIEW IF NOT EXISTS recent_detections AS
SELECT 
    id,
    url,
    type,
    page_title,
    detected_at,
    downloaded,
    skip_reason
FROM detected_videos
WHERE detected_at > datetime('now', '-7 days')
    AND skip_reason IS NULL
ORDER BY detected_at DESC
LIMIT 100;

-- セグメント進捗ビュー
CREATE VIEW IF NOT EXISTS segment_progress AS
SELECT 
    task_id,
    COUNT(*) as total_segments,
    COUNT(CASE WHEN state = 'COMPLETED' THEN 1 END) as completed_segments,
    COUNT(CASE WHEN state = 'FAILED' THEN 1 END) as failed_segments,
    COUNT(CASE WHEN state = 'DOWNLOADING' THEN 1 END) as downloading_segments,
    MIN(CASE WHEN state = 'PENDING' THEN idx END) as next_segment_idx,
    ROUND(COUNT(CASE WHEN state = 'COMPLETED' THEN 1 END) * 100.0 / COUNT(*), 2) as progress_percent
FROM segments
GROUP BY task_id;

-- ===============================================
-- トリガー
-- ===============================================

-- タスクの更新時刻を自動更新
CREATE TRIGGER IF NOT EXISTS update_task_timestamp
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
    UPDATE tasks 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- 状態変更時のタイムスタンプ記録
CREATE TRIGGER IF NOT EXISTS record_state_timestamps
AFTER UPDATE OF state ON tasks
FOR EACH ROW
BEGIN
    UPDATE tasks
    SET 
        started_at = CASE 
            WHEN NEW.state = 'RUNNING' AND OLD.state != 'RUNNING' AND started_at IS NULL
            THEN CURRENT_TIMESTAMP 
            ELSE started_at 
        END,
        paused_at = CASE 
            WHEN NEW.state = 'PAUSED' 
            THEN CURRENT_TIMESTAMP 
            ELSE paused_at 
        END,
        completed_at = CASE 
            WHEN NEW.state = 'COMPLETED' 
            THEN CURRENT_TIMESTAMP 
            ELSE completed_at 
        END
    WHERE id = NEW.id;
END;

-- 完了時に履歴に追加
CREATE TRIGGER IF NOT EXISTS add_to_history_on_complete
AFTER UPDATE OF state ON tasks
FOR EACH ROW
WHEN NEW.state = 'COMPLETED' AND OLD.state != 'COMPLETED'
BEGIN
    INSERT INTO download_history (
        task_id, url, title, filename, save_path, type,
        file_size, download_time_ms, average_speed_bps
    )
    SELECT 
        NEW.id,
        NEW.url,
        NEW.title,
        NEW.filename,
        NEW.final_path,
        NEW.type,
        NEW.downloaded_bytes,
        CASE 
            WHEN NEW.started_at IS NOT NULL 
            THEN CAST((julianday(CURRENT_TIMESTAMP) - julianday(NEW.started_at)) * 86400000 AS INTEGER)
            ELSE NULL
        END,
        CASE 
            WHEN NEW.started_at IS NOT NULL AND NEW.downloaded_bytes > 0
            THEN CAST(NEW.downloaded_bytes * 8.0 / 
                ((julianday(CURRENT_TIMESTAMP) - julianday(NEW.started_at)) * 86400) AS INTEGER)
            ELSE NULL
        END;
END;

-- 統計情報の更新
CREATE TRIGGER IF NOT EXISTS update_statistics
AFTER INSERT ON download_history
FOR EACH ROW
BEGIN
    INSERT INTO statistics (date, total_downloads, total_bytes, total_time_ms, failed_count)
    VALUES (date('now'), 0, 0, 0, 0)
    ON CONFLICT(date) DO NOTHING;
    
    UPDATE statistics
    SET 
        total_downloads = total_downloads + 1,
        total_bytes = total_bytes + COALESCE(NEW.file_size, 0),
        total_time_ms = total_time_ms + COALESCE(NEW.download_time_ms, 0),
        hls_count = hls_count + CASE WHEN NEW.type = 'hls' THEN 1 ELSE 0 END,
        dash_count = dash_count + CASE WHEN NEW.type = 'dash' THEN 1 ELSE 0 END,
        file_count = file_count + CASE WHEN NEW.type = 'file' THEN 1 ELSE 0 END
    WHERE date = date('now');
END;

-- 設定更新時のタイムスタンプ
CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
AFTER UPDATE ON settings
FOR EACH ROW
BEGIN
    UPDATE settings
    SET updated_at = CURRENT_TIMESTAMP
    WHERE key = NEW.key;
END;