// Video Downloader TypeScript インターフェース定義
// JSONシリアライズ安全性とIPC通信を考慮した型定義

// ============================================
// 共通: JSON/IPC セーフ型
// ============================================

export type ISO8601 = string; // e.g., "2025-01-23T12:34:56.789Z"
export type Bytes = number;   // バイト数を明示的に表現
export type Bps = number;     // Bytes per second

export enum ErrorCode {
  // ネットワークエラー (1xxx)
  NETWORK_ERROR = 'E1000',
  TIMEOUT = 'E1001',
  CONNECTION_REFUSED = 'E1002',
  DNS_LOOKUP_FAILED = 'E1003',
  
  // ファイルシステムエラー (2xxx)
  FILE_NOT_FOUND = 'E2000',
  PERMISSION_DENIED = 'E2001',
  DISK_FULL = 'E2002',
  PATH_TOO_LONG = 'E2003',
  
  // ダウンロードエラー (3xxx)
  INVALID_URL = 'E3000',
  UNSUPPORTED_PROTOCOL = 'E3001',
  DRM_PROTECTED = 'E3002',
  LIVE_STREAM = 'E3003',
  
  // アプリケーションエラー (4xxx)
  INVALID_ARGUMENT = 'E4000',
  TASK_NOT_FOUND = 'E4001',
  ALREADY_EXISTS = 'E4002',
  OPERATION_CANCELLED = 'E4003',
}

export interface SerializedError {
  code?: ErrorCode | string;
  name?: string;
  message: string;
  stack?: string;
  details?: any;
}

// ============================================
// 基本型定義
// ============================================

export type MediaType = "hls" | "dash" | "file";
export type DownloadStatus = "queued" | "running" | "paused" | "completed" | "error" | "canceled";
export type SkipReason = "drm" | "403" | "cors" | "mime-mismatch" | "widevine-hint" | "live";
export type BackoffStrategy = "exponential" | "fixed";
export type QualityPreference = "highest" | "lowest" | "balanced" | "custom";
export type DuplicateAction = "ask" | "skip" | "rename" | "overwrite";
export type Theme = "light" | "dark" | "system";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type NotificationType = "info" | "success" | "warning" | "error";

// ============================================
// 動画検出関連
// ============================================

/**
 * 動画バリアント（品質選択肢）
 */
export interface VideoVariant {
  bandwidth?: number;        // bits per second
  resolution?: string;       // "1920x1080"
  codecs?: string;          // コーデック情報
  frameRate?: number;       // フレームレート
  label?: string;           // 表示用ラベル "1080p"
  audioOnly?: boolean;      // 音声のみトラック
  manifestUrl?: string;     // HLS/DASH用マニフェストURL
}

/**
 * 検出された動画候補（内部用）
 */
export interface MediaCandidate {
  id: string;               // 一意識別子 (dedupKey)
  url: string;              // 動画URL
  mediaType: MediaType;     // メディアタイプ
  pageUrl?: string;         // 検出元ページURL
  pageTitle?: string;       // ページタイトル
  thumbnailUrl?: string;    // サムネイルURL
  duration?: number;        // 動画の長さ（秒）
  fileSize?: number;        // ファイルサイズ（バイト）
  variants?: VideoVariant[]; // 利用可能な品質
  headers?: Record<string, string>; // 必要なHTTPヘッダー（正規化済み）
  detectedAt: Date;         // 検出時刻
}

/**
 * 検出された動画候補（IPC/保存用DTO）
 */
export interface MediaCandidateDTO {
  id: string;
  url: string;
  mediaType: MediaType;
  pageUrl?: string;
  pageTitle?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  fileSizeBytes?: Bytes;
  variants?: VideoVariant[];
  headers?: Record<string, string>; // 小文字キーに正規化済み
  detectedAt: ISO8601;               // Date → string
}

/**
 * 検出設定
 */
export interface DetectionConfig {
  enabled: boolean;
  minFileSize?: Bytes;
  maxFileSize?: Bytes;
  mimeTypes?: string[];
  ignoreDomains?: string[];
  allowDomains?: string[];    // ホワイトリスト運用時
  autoDetect: boolean;
}

// ============================================
// ダウンロード関連
// ============================================

/**
 * リトライポリシー
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoff: BackoffStrategy;
  initialDelayMs: number;
  maxDelayMs?: number;
  retryOn?: ErrorCode[];      // 列挙型を使用
}

/**
 * カスタム品質ルール（"custom"選択時の基準）
 */
export interface CustomQualityRule {
  minBandwidth?: number;
  maxBandwidth?: number;
  minResolution?: string;      // "1280x720"
  maxResolution?: string;
  preferFramerate?: number;
}

/**
 * ダウンロード仕様
 */
export interface DownloadSpec {
  url: string;
  type: MediaType;
  filename?: string;
  saveDir?: string;
  headers?: Record<string, string>; // 小文字キー推奨
  variant?: VideoVariant;
  retry?: RetryPolicy;
  priority?: number;
  qualityRule?: CustomQualityRule;
  metadata?: Record<string, any>;
}

/**
 * セグメント進捗（HLS/DASH用）
 */
export interface SegmentProgress {
  total?: number;              // 総セグメント数（未知の場合あり）
  downloaded: number;          // ダウンロード済みセグメント数
  failed: number;              // 失敗したセグメント数
  currentIndex?: number;       // 現在のセグメントインデックス
  targetDurationSec?: number;  // HLS用：ターゲット時間
  mediaSequence?: number;      // HLS用：メディアシーケンス番号
}

/**
 * ダウンロード進捗
 */
export interface DownloadProgress {
  percent?: number;            // 進捗率 0-100
  downloadedBytes: Bytes;      // ダウンロード済みバイト数
  totalBytes?: Bytes;          // 総バイト数
  speedBps?: Bps;              // 現在の速度（Bytes/sec）
  etaMs?: number;              // 推定残り時間（ミリ秒）
  segments?: SegmentProgress;  // セグメント進捗
}

/**
 * ダウンロードエラー
 */
export interface DownloadError {
  code: ErrorCode | string;    // ErrorCode優先、外部依存はstring
  message: string;
  details?: any;
  retryable: boolean;
  attempt?: number;
}

/**
 * ダウンロードタスク（内部用）
 */
export interface DownloadTask {
  id: string;
  spec: DownloadSpec;
  status: DownloadStatus;
  progress: DownloadProgress;
  error?: DownloadError;
  createdAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  outputPath?: string;
}

/**
 * ダウンロードタスク（IPC/保存用DTO）
 */
export interface DownloadTaskDTO {
  id: string;
  spec: DownloadSpec;
  status: DownloadStatus;
  progress: DownloadProgress;
  error?: DownloadError | SerializedError;
  createdAt: ISO8601;          // Date → string
  startedAt?: ISO8601;
  pausedAt?: ISO8601;
  completedAt?: ISO8601;
  outputPath?: string;
}

// ============================================
// ウィンドウ管理
// ============================================

/**
 * ウィンドウ設定
 */
export interface WindowConfig {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
  fullscreen?: boolean;
  alwaysOnTop?: boolean;
  displayId?: number;          // マルチディスプレイ固定
}

/**
 * ブラウザウィンドウ状態
 */
export interface BrowserState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

// ============================================
// 設定管理
// ============================================

/**
 * 重複ファイル名のリネームルール
 */
export interface DuplicateRenameRule {
  pattern: string;             // e.g., "{name} ({n}).{ext}"
  start?: number;              // 開始番号（デフォルト: 1）
}

/**
 * プロキシ設定
 */
export interface ProxyConfig {
  enabled: boolean;
  type: "http" | "https" | "socks4" | "socks5" | "system" | "pac";
  host?: string;
  port?: number;
  pacUrl?: string;             // type === "pac" 用
  auth?: {
    username: string;
    password: string;
  };
  bypassList?: string[];       // e.g., ["*.local", "localhost", "10.*"]
}

/**
 * アプリケーション設定
 */
export interface AppSettings {
  // 基本設定
  downloadDirectory: string;
  maxConcurrentDownloads: number;
  autoStartDownload: boolean;
  notificationEnabled: boolean;
  
  // FFmpeg設定
  ffmpegPath: string;
  ffmpegArgs?: string[];
  
  // プロキシ設定
  proxy?: ProxyConfig;
  
  // UI設定
  theme: Theme;
  language: string;
  windowConfig?: WindowConfig;
  
  // 詳細設定
  userAgent?: string;
  downloadQualityPreference: QualityPreference;
  qualityRule?: CustomQualityRule;
  duplicateAction: DuplicateAction;
  duplicateRenameRule?: DuplicateRenameRule;
  
  // 通知設定
  completedNotification: {
    enabled: boolean;
    autoOpenFolder: boolean;
  };
  
  // 自動更新
  autoUpdate: {
    enabled: boolean;
    checkIntervalHours: number;
  };
  
  // 検出設定
  detection: DetectionConfig;
  
  // リトライ設定
  downloadRetry: RetryPolicy;
  segmentRetry: {
    maxAttempts: number;
    timeoutMs: number;
  };
}

// ============================================
// ロギング
// ============================================

/**
 * ログエントリー（内部用）
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
}

/**
 * ログエントリー（保存用DTO）
 */
export interface LogEntryDTO {
  level: LogLevel;
  message: string;
  timestamp: ISO8601;
  context?: Record<string, any>;
  error?: SerializedError;
}

// ============================================
// 通知
// ============================================

/**
 * 通知コマンド（IPCで実行可能なアクション）
 */
export type NotificationCommand = 
  | { type: "reveal-in-folder"; path: string }
  | { type: "open-url"; url: string }
  | { type: "open-preferences"; tab?: string }
  | { type: "retry-download"; taskId: string }
  | { type: "none" };

/**
 * 通知メッセージ
 */
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  durationMs?: number;
  action?: {
    label: string;
    command: NotificationCommand;  // Function不可、コマンドで表現
  };
}

// ============================================
// 統計情報
// ============================================

/**
 * ダウンロード統計
 */
export interface DownloadStats {
  totalDownloads: number;
  completedCount: number;
  errorCount: number;
  activeCount: number;
  totalBytes: Bytes;
  totalTimeMs: number;
  averageSpeedBps: Bps;
}

// ============================================
// システム情報
// ============================================

/**
 * GPU情報
 */
export interface GpuInfo {
  vendor?: string;
  model?: string;
  driverVersion?: string;
}

/**
 * システム情報
 */
export interface SystemInfo {
  platform: NodeJS.Platform;
  arch: string;
  version: string;              // アプリバージョン
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  ffmpegVersion?: string;
  availableDiskSpaceBytes?: Bytes;
  cpuCount?: number;
  totalMemBytes?: Bytes;
  gpuInfo?: GpuInfo[];
}

// ============================================
// ライセンスと法的情報
// ============================================

/**
 * ライセンス情報
 */
export interface LicenseInfo {
  appName: string;
  version: string;
  license: string;
  copyright: string;
  disclaimer: string;
  thirdPartyLicenses: Array<{
    name: string;
    license: string;
    url?: string;
  }>;
}

// ============================================
// Smart Naming
// ============================================

/**
 * Smart Namingトークン
 */
export interface NamingToken {
  name: string;                // トークン名
  value: string;               // 抽出された値
  source?: string;             // 抽出元（selector, meta, etc）
}

/**
 * Smart Namingルール
 */
export interface NamingRule {
  id: string;
  sitePattern: string;         // URLパターン（正規表現）
  tokens: Array<{
    name: string;
    selector?: string;
    regex?: string;
    fallback?: string;
  }>;
  enabled: boolean;
}

// ============================================
// DTO変換ユーティリティ型
// ============================================

/**
 * Date型をISO8601文字列に変換する型ユーティリティ
 */
export type DateToString<T> = T extends Date
  ? ISO8601
  : T extends Date | undefined
  ? ISO8601 | undefined
  : T extends object
  ? { [K in keyof T]: DateToString<T[K]> }
  : T;

/**
 * Error型をSerializedErrorに変換する型ユーティリティ
 */
export type ErrorToSerialized<T> = T extends Error
  ? SerializedError
  : T extends Error | undefined
  ? SerializedError | undefined
  : T extends object
  ? { [K in keyof T]: ErrorToSerialized<T[K]> }
  : T;

// ============================================
// 変換関数インターフェース
// ============================================

/**
 * DTO変換関数
 */
export interface DtoConverter<T, D> {
  toDto(entity: T): D;
  fromDto(dto: D): T;
}

/**
 * ヘッダー正規化関数
 */
export function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
}

/**
 * エラーのシリアライズ
 */
export function serializeError(error: Error): SerializedError {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: (error as any).code,
    details: (error as any).details,
  };
}

/**
 * 日付のISO8601変換
 */
export function toISO8601(date: Date): ISO8601 {
  return date.toISOString();
}

/**
 * ISO8601から日付への変換
 */
export function fromISO8601(iso: ISO8601): Date {
  return new Date(iso);
}