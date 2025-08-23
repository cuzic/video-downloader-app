// Video Downloader Zodスキーマ定義
// IPC通信での入力検証用

import { z } from 'zod';
import { 
  ErrorCode,
  MediaType,
  DownloadStatus,
  SkipReason,
  BackoffStrategy,
  QualityPreference,
  DuplicateAction,
  Theme,
  LogLevel,
  NotificationType
} from './interfaces';

// ============================================
// 基本型のスキーマ
// ============================================

export const ISO8601Schema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  'Invalid ISO8601 format'
);

export const BytesSchema = z.number().int().min(0);
export const BpsSchema = z.number().min(0);

export const ErrorCodeSchema = z.nativeEnum(ErrorCode);
export const MediaTypeSchema = z.enum(['hls', 'dash', 'file']);
export const DownloadStatusSchema = z.enum(['queued', 'running', 'paused', 'completed', 'error', 'canceled']);
export const SkipReasonSchema = z.enum(['drm', '403', 'cors', 'mime-mismatch', 'widevine-hint', 'live']);
export const BackoffStrategySchema = z.enum(['exponential', 'fixed']);
export const QualityPreferenceSchema = z.enum(['highest', 'lowest', 'balanced', 'custom']);
export const DuplicateActionSchema = z.enum(['ask', 'skip', 'rename', 'overwrite']);
export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export const NotificationTypeSchema = z.enum(['info', 'success', 'warning', 'error']);

// ============================================
// エラー関連
// ============================================

export const SerializedErrorSchema = z.object({
  code: z.union([ErrorCodeSchema, z.string()]).optional(),
  name: z.string().optional(),
  message: z.string(),
  stack: z.string().optional(),
  details: z.any().optional(),
});

// ============================================
// 動画検出関連
// ============================================

export const VideoVariantSchema = z.object({
  bandwidth: z.number().optional(),
  resolution: z.string().regex(/^\d+x\d+$/).optional(),
  codecs: z.string().optional(),
  frameRate: z.number().positive().optional(),
  label: z.string().optional(),
  audioOnly: z.boolean().optional(),
  manifestUrl: z.string().url().optional(),
});

export const MediaCandidateDTOSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  mediaType: MediaTypeSchema,
  pageUrl: z.string().url().optional(),
  pageTitle: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSec: z.number().positive().optional(),
  fileSizeBytes: BytesSchema.optional(),
  variants: z.array(VideoVariantSchema).optional(),
  headers: z.record(z.string()).optional(),
  detectedAt: ISO8601Schema,
});

export const DetectionConfigSchema = z.object({
  enabled: z.boolean(),
  minFileSize: BytesSchema.optional(),
  maxFileSize: BytesSchema.optional(),
  mimeTypes: z.array(z.string()).optional(),
  ignoreDomains: z.array(z.string()).optional(),
  allowDomains: z.array(z.string()).optional(),
  autoDetect: z.boolean(),
});

// ============================================
// ダウンロード関連
// ============================================

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(0).max(10),
  backoff: BackoffStrategySchema,
  initialDelayMs: z.number().int().min(100),
  maxDelayMs: z.number().int().min(1000).optional(),
  retryOn: z.array(ErrorCodeSchema).optional(),
});

export const CustomQualityRuleSchema = z.object({
  minBandwidth: z.number().positive().optional(),
  maxBandwidth: z.number().positive().optional(),
  minResolution: z.string().regex(/^\d+x\d+$/).optional(),
  maxResolution: z.string().regex(/^\d+x\d+$/).optional(),
  preferFramerate: z.number().positive().optional(),
});

export const DownloadSpecSchema = z.object({
  url: z.string().url(),
  type: MediaTypeSchema,
  filename: z.string().min(1).max(255).optional(),
  saveDir: z.string().min(1).optional(),
  headers: z.record(z.string()).optional(),
  variant: VideoVariantSchema.optional(),
  retry: RetryPolicySchema.optional(),
  priority: z.number().int().optional(),
  qualityRule: CustomQualityRuleSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export const SegmentProgressSchema = z.object({
  total: z.number().int().positive().optional(),
  downloaded: z.number().int().min(0),
  failed: z.number().int().min(0),
  currentIndex: z.number().int().min(0).optional(),
  targetDurationSec: z.number().positive().optional(),
  mediaSequence: z.number().int().min(0).optional(),
});

export const DownloadProgressSchema = z.object({
  percent: z.number().min(0).max(100).optional(),
  downloadedBytes: BytesSchema,
  totalBytes: BytesSchema.optional(),
  speedBps: BpsSchema.optional(),
  etaMs: z.number().int().positive().optional(),
  segments: SegmentProgressSchema.optional(),
});

export const DownloadErrorSchema = z.object({
  code: z.union([ErrorCodeSchema, z.string()]),
  message: z.string(),
  details: z.any().optional(),
  retryable: z.boolean(),
  attempt: z.number().int().min(0).optional(),
});

export const DownloadTaskDTOSchema = z.object({
  id: z.string().uuid(),
  spec: DownloadSpecSchema,
  status: DownloadStatusSchema,
  progress: DownloadProgressSchema,
  error: z.union([DownloadErrorSchema, SerializedErrorSchema]).optional(),
  createdAt: ISO8601Schema,
  startedAt: ISO8601Schema.optional(),
  pausedAt: ISO8601Schema.optional(),
  completedAt: ISO8601Schema.optional(),
  outputPath: z.string().optional(),
});

// ============================================
// ウィンドウ管理
// ============================================

export const WindowConfigSchema = z.object({
  width: z.number().int().min(100).max(10000),
  height: z.number().int().min(100).max(10000),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  maximized: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
  alwaysOnTop: z.boolean().optional(),
  displayId: z.number().int().optional(),
});

export const BrowserStateSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  isLoading: z.boolean(),
});

// ============================================
// 設定管理
// ============================================

export const DuplicateRenameRuleSchema = z.object({
  pattern: z.string().min(1),
  start: z.number().int().min(0).default(1).optional(),
});

export const ProxyConfigSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['http', 'https', 'socks4', 'socks5', 'system', 'pac']),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  pacUrl: z.string().url().optional(),
  auth: z.object({
    username: z.string(),
    password: z.string(),
  }).optional(),
  bypassList: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (!data.enabled) return true;
    if (data.type === 'pac') return !!data.pacUrl;
    if (data.type === 'system') return true;
    return !!data.host && !!data.port;
  },
  {
    message: 'Invalid proxy configuration',
  }
);

export const AppSettingsSchema = z.object({
  // 基本設定
  downloadDirectory: z.string().min(1),
  maxConcurrentDownloads: z.number().int().min(1).max(10),
  autoStartDownload: z.boolean(),
  notificationEnabled: z.boolean(),
  
  // FFmpeg設定
  ffmpegPath: z.string().min(1),
  ffmpegArgs: z.array(z.string()).optional(),
  
  // プロキシ設定
  proxy: ProxyConfigSchema.optional(),
  
  // UI設定
  theme: ThemeSchema,
  language: z.string().min(2).max(5),
  windowConfig: WindowConfigSchema.optional(),
  
  // 詳細設定
  userAgent: z.string().optional(),
  downloadQualityPreference: QualityPreferenceSchema,
  qualityRule: CustomQualityRuleSchema.optional(),
  duplicateAction: DuplicateActionSchema,
  duplicateRenameRule: DuplicateRenameRuleSchema.optional(),
  
  // 通知設定
  completedNotification: z.object({
    enabled: z.boolean(),
    autoOpenFolder: z.boolean(),
  }),
  
  // 自動更新
  autoUpdate: z.object({
    enabled: z.boolean(),
    checkIntervalHours: z.number().int().min(1).max(168),
  }),
  
  // 検出設定
  detection: DetectionConfigSchema,
  
  // リトライ設定
  downloadRetry: RetryPolicySchema,
  segmentRetry: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    timeoutMs: z.number().int().min(1000).max(300000),
  }),
});

// ============================================
// ロギング
// ============================================

export const LogEntryDTOSchema = z.object({
  level: LogLevelSchema,
  message: z.string(),
  timestamp: ISO8601Schema,
  context: z.record(z.any()).optional(),
  error: SerializedErrorSchema.optional(),
});

// ============================================
// 通知
// ============================================

export const NotificationCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reveal-in-folder'),
    path: z.string(),
  }),
  z.object({
    type: z.literal('open-url'),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal('open-preferences'),
    tab: z.string().optional(),
  }),
  z.object({
    type: z.literal('retry-download'),
    taskId: z.string(),
  }),
  z.object({
    type: z.literal('none'),
  }),
]);

export const NotificationMessageSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(100),
  message: z.string().max(500).optional(),
  durationMs: z.number().int().min(1000).max(30000).optional(),
  action: z.object({
    label: z.string().min(1).max(50),
    command: NotificationCommandSchema,
  }).optional(),
});

// ============================================
// 統計情報
// ============================================

export const DownloadStatsSchema = z.object({
  totalDownloads: z.number().int().min(0),
  completedCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  activeCount: z.number().int().min(0),
  totalBytes: BytesSchema,
  totalTimeMs: z.number().int().min(0),
  averageSpeedBps: BpsSchema,
});

// ============================================
// システム情報
// ============================================

export const GpuInfoSchema = z.object({
  vendor: z.string().optional(),
  model: z.string().optional(),
  driverVersion: z.string().optional(),
});

export const SystemInfoSchema = z.object({
  platform: z.enum(['aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', 'win32']),
  arch: z.string(),
  version: z.string(),
  electronVersion: z.string(),
  nodeVersion: z.string(),
  chromeVersion: z.string(),
  ffmpegVersion: z.string().optional(),
  availableDiskSpaceBytes: BytesSchema.optional(),
  cpuCount: z.number().int().positive().optional(),
  totalMemBytes: BytesSchema.optional(),
  gpuInfo: z.array(GpuInfoSchema).optional(),
});

// ============================================
// Smart Naming
// ============================================

export const NamingTokenSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  source: z.string().optional(),
});

export const NamingRuleSchema = z.object({
  id: z.string(),
  sitePattern: z.string().min(1),
  tokens: z.array(z.object({
    name: z.string().min(1),
    selector: z.string().optional(),
    regex: z.string().optional(),
    fallback: z.string().optional(),
  })),
  enabled: z.boolean(),
});

// ============================================
// IPC リクエスト/レスポンス スキーマ
// ============================================

// ダウンロード関連
export const DownloadStartRequestSchema = DownloadSpecSchema;
export const DownloadStartResponseSchema = z.object({
  id: z.string().uuid(),
});

export const DownloadActionRequestSchema = z.string().uuid();
export const DownloadGetByIdResponseSchema = DownloadTaskDTOSchema.nullable();

// 設定関連
export const SettingsGetByKeyRequestSchema = z.string();
export const SettingsSetRequestSchema = z.object({
  key: z.string(),
  value: z.any(),
});

// ブラウザ関連
export const BrowserNavigateRequestSchema = z.string().url();

// システム関連
export const SystemRevealInFolderRequestSchema = z.string().min(1);
export const SystemOpenExternalRequestSchema = z.string().url();
export const SystemGetPathRequestSchema = z.enum(['home', 'downloads', 'documents', 'videos']);

// Smart Naming関連
export const NamingExtractTokensRequestSchema = z.string();
export const NamingPreviewRequestSchema = z.object({
  template: z.string(),
  tokens: z.record(z.string()),
});

// ============================================
// バリデーション関数
// ============================================

/**
 * IPCリクエストのバリデーション
 */
export function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const error = new Error('Validation failed');
    (error as any).code = ErrorCode.INVALID_ARGUMENT;
    (error as any).details = result.error.flatten();
    throw error;
  }
  return result.data;
}

/**
 * 部分的なバリデーション（設定更新用）
 */
export function validatePartial<T>(
  schema: z.ZodType<T>,
  data: unknown
): Partial<T> {
  const partialSchema = schema.partial();
  return validateRequest(partialSchema, data);
}

// ============================================
// 型ガード
// ============================================

export function isValidISO8601(value: unknown): value is string {
  return ISO8601Schema.safeParse(value).success;
}

export function isValidMediaType(value: unknown): value is MediaType {
  return MediaTypeSchema.safeParse(value).success;
}

export function isValidDownloadStatus(value: unknown): value is DownloadStatus {
  return DownloadStatusSchema.safeParse(value).success;
}

// ============================================
// デフォルト値
// ============================================

export const DEFAULT_RETRY_POLICY: z.infer<typeof RetryPolicySchema> = {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryOn: [ErrorCode.NETWORK_ERROR, ErrorCode.TIMEOUT],
};

export const DEFAULT_WINDOW_CONFIG: z.infer<typeof WindowConfigSchema> = {
  width: 1280,
  height: 720,
  maximized: false,
  fullscreen: false,
  alwaysOnTop: false,
};

export const DEFAULT_DUPLICATE_RENAME_RULE: z.infer<typeof DuplicateRenameRuleSchema> = {
  pattern: '{name} ({n}).{ext}',
  start: 1,
};