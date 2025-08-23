import { z } from 'zod';

// Task validation schemas
export const TaskIdSchema = z.string().uuid();

export const TaskStatusSchema = z.enum([
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'canceled',
  'error',
]);

export const MediaTypeSchema = z.enum(['hls', 'dash', 'file']);

export const CreateTaskSchema = z.object({
  url: z.string().url(),
  mediaType: MediaTypeSchema,
  filename: z.string().min(1).optional(),
  saveDir: z.string().min(1).optional(),
  headers: z.record(z.string()).optional(),
  variant: z.any().optional(),
  qualityRule: z.any().optional(),
  metadata: z.any().optional(),
  priority: z.number().int().min(0).max(100).default(0),
});

// Settings validation schemas
export const SettingKeySchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9._-]+$/);

export const SettingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.any()),
  z.record(z.any()),
  z.null(),
]);

// Detection validation schemas
export const SkipReasonSchema = z.enum([
  'drm',
  '403',
  'cors',
  'mime-mismatch',
  'widevine-hint',
  'live',
]);

export const CreateDetectionSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  mediaType: MediaTypeSchema,
  pageUrl: z.string().url().optional(),
  pageTitle: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSec: z.number().positive().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  variants: z.array(z.any()).optional(),
  headers: z.record(z.string()).optional(),
  skipReason: SkipReasonSchema.optional(),
});

// History validation schemas
export const HistoryEventSchema = z.enum([
  'created',
  'started',
  'paused',
  'resumed',
  'completed',
  'failed',
  'canceled',
  'progress',
  'error',
]);

export const CreateHistoryEntrySchema = z.object({
  taskId: TaskIdSchema.optional(),
  event: HistoryEventSchema,
  details: z.any().optional(),
});

// Segment validation schemas
export const SegmentStatusSchema = z.enum([
  'pending',
  'downloading',
  'completed',
  'error',
]);

export const CreateSegmentSchema = z.object({
  segmentIndex: z.number().int().min(0),
  url: z.string().url(),
  durationSec: z.number().positive().optional(),
  sizeBytes: z.number().int().positive().optional(),
});

// Audit log validation schemas
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export const CreateAuditLogSchema = z.object({
  level: LogLevelSchema,
  category: z.string().min(1).max(50),
  event: z.string().min(1).max(100),
  message: z.string().optional(),
  taskId: TaskIdSchema.optional(),
  userId: z.string().optional(),
  context: z.any().optional(),
  errorCode: z.string().optional(),
  errorStack: z.string().optional(),
});

// Statistics validation schemas
export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Path validation
export const SafePathSchema = z.string().refine((path) => {
  // Prevent directory traversal
  const normalized = path.replace(/\\/g, '/');
  return !normalized.includes('../') && !normalized.includes('..\\');
}, 'Path must not contain directory traversal sequences');

// URL validation with additional checks
export const SafeUrlSchema = z.string().url().refine((url) => {
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}, 'URL must use http or https protocol');

// Validate download spec
export const validateDownloadSpec = (spec: any) => {
  const schema = z.object({
    url: SafeUrlSchema,
    type: MediaTypeSchema,
    filename: z.string().min(1).optional(),
    saveDir: SafePathSchema.optional(),
    headers: z.record(z.string()).optional(),
    variant: z.any().optional(),
    qualityRule: z.any().optional(),
    metadata: z.any().optional(),
    priority: z.number().int().min(0).max(100).optional(),
  });
  
  return schema.parse(spec);
};

// Validate app settings
export const validateAppSettings = (settings: any) => {
  const schema = z.object({
    downloadDirectory: SafePathSchema.optional(),
    maxConcurrentDownloads: z.number().int().min(1).max(10).optional(),
    autoStartDownload: z.boolean().optional(),
    notificationEnabled: z.boolean().optional(),
    ffmpegPath: z.string().optional(),
    ffmpegArgs: z.array(z.string()).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().optional(),
  });
  
  return schema.parse(settings);
};

// Export validation functions
export const validators = {
  task: {
    create: (data: any) => CreateTaskSchema.parse(data),
    validateId: (id: any) => TaskIdSchema.parse(id),
    validateStatus: (status: any) => TaskStatusSchema.parse(status),
  },
  setting: {
    validateKey: (key: any) => SettingKeySchema.parse(key),
    validateValue: (value: any) => SettingValueSchema.parse(value),
  },
  detection: {
    create: (data: any) => CreateDetectionSchema.parse(data),
  },
  history: {
    create: (data: any) => CreateHistoryEntrySchema.parse(data),
  },
  segment: {
    create: (data: any) => CreateSegmentSchema.parse(data),
    validateStatus: (status: any) => SegmentStatusSchema.parse(status),
  },
  auditLog: {
    create: (data: any) => CreateAuditLogSchema.parse(data),
  },
  path: {
    validate: (path: any) => SafePathSchema.parse(path),
  },
  url: {
    validate: (url: any) => SafeUrlSchema.parse(url),
  },
};