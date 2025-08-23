import { z } from 'zod';

// ============================================================================
// Basic Validators
// ============================================================================

export const taskIdSchema = z.string().uuid('Invalid task ID format');

export const urlSchema = z.string().url('Invalid URL format');

export const filePathSchema = z.string().min(1, 'File path cannot be empty');

export const systemPathNameSchema = z.enum(['home', 'downloads', 'documents', 'videos']);

// ============================================================================
// Download Validators
// ============================================================================

export const mediaTypeSchema = z.enum(['video', 'audio', 'image', 'document', 'other']);

export const downloadStatusSchema = z.enum([
  'pending',
  'downloading',
  'paused',
  'completed',
  'failed',
  'canceled',
]);

export const videoVariantSchema = z.object({
  format: z.string(),
  quality: z.string().optional(),
  resolution: z.string().optional(),
  fps: z.number().optional(),
  bitrate: z.number().optional(),
  codec: z.string().optional(),
  size: z.number().optional(),
});

export const audioVariantSchema = z.object({
  format: z.string(),
  quality: z.string().optional(),
  bitrate: z.number().optional(),
  codec: z.string().optional(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
});

export const qualityRuleSchema = z.object({
  preferredQuality: z.string().optional(),
  maxQuality: z.string().optional(),
  minQuality: z.string().optional(),
  preferredFormat: z.string().optional(),
  avoidFormats: z.array(z.string()).optional(),
});

export const retryConfigSchema = z.object({
  maxAttempts: z.number().min(0).max(10).default(3),
  delayMs: z.number().min(0).default(1000),
  backoffMultiplier: z.number().min(1).default(2),
});

export const downloadSpecSchema = z.object({
  url: urlSchema,
  type: mediaTypeSchema,
  filename: z.string().optional(),
  saveDir: filePathSchema,
  headers: z.record(z.string()).optional(),
  variant: z.union([videoVariantSchema, audioVariantSchema]).optional(),
  retry: retryConfigSchema.optional(),
  priority: z.number().min(0).max(10).default(5),
  qualityRule: qualityRuleSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export const downloadProgressSchema = z.object({
  percent: z.number().min(0).max(100).optional(),
  downloadedBytes: z.number().min(0),
  totalBytes: z.number().min(0).optional(),
  speedBps: z.number().min(0).optional(),
  etaMs: z.number().min(0).optional(),
});

export const downloadErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  retryable: z.boolean(),
  attempt: z.number().optional(),
});

// ============================================================================
// Settings Validators
// ============================================================================

export const themeSchema = z.enum(['light', 'dark', 'system']);

export const languageSchema = z.enum(['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de']);

export const windowStateSchema = z.object({
  width: z.number().min(600),
  height: z.number().min(400),
  x: z.number().optional(),
  y: z.number().optional(),
  maximized: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
});

export const appSettingsSchema = z.object({
  downloadPath: z.string(),
  maxConcurrentDownloads: z.number().min(1).max(10),
  autoStart: z.boolean(),
  notifications: z.boolean(),
  theme: themeSchema,
  language: languageSchema,
  windowState: windowStateSchema,
  proxy: z
    .object({
      enabled: z.boolean(),
      protocol: z.enum(['http', 'https', 'socks4', 'socks5']).optional(),
      host: z.string().optional(),
      port: z.number().min(1).max(65535).optional(),
      auth: z
        .object({
          username: z.string(),
          password: z.string(),
        })
        .optional(),
    })
    .optional(),
  advanced: z
    .object({
      enableHardwareAcceleration: z.boolean(),
      enableDevTools: z.boolean(),
      logLevel: z.enum(['error', 'warn', 'info', 'debug']),
      maxRetries: z.number().min(0).max(10),
      retryDelay: z.number().min(0),
      connectionTimeout: z.number().min(1000),
      chunkSize: z.number().min(1024),
      userAgent: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Detection Validators
// ============================================================================

export const detectionSourceSchema = z.enum(['browser', 'clipboard', 'file', 'manual']);

export const detectionSchema = z.object({
  id: z.string(),
  url: urlSchema,
  type: mediaTypeSchema,
  source: detectionSourceSchema,
  title: z.string().optional(),
  duration: z.number().optional(),
  thumbnail: z.string().optional(),
  variants: z.array(z.union([videoVariantSchema, audioVariantSchema])).optional(),
  metadata: z.record(z.any()).optional(),
  detectedAt: z.string().datetime(),
});

export const drmDetectionSchema = z.object({
  detected: z.boolean(),
  type: z.string().optional(),
  url: urlSchema,
  metadata: z.record(z.any()).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate input against a schema
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: messages.join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Create a partial schema from a full schema
 */
export function partial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{
  [K in keyof T]: z.ZodOptional<T[K]>;
}> {
  return schema.partial();
}

/**
 * Create a strict schema that doesn't allow extra properties
 */
export function strict<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<T, 'strict'> {
  return schema.strict();
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(path: string): string {
  // Remove any directory traversal patterns
  return path.replace(/\.\.[/\\]/g, '').replace(/^[/\\]+/, '');
}

/**
 * Validate and sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove invalid characters for filenames
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

// ============================================================================
// Type Exports
// ============================================================================

export type DownloadSpec = z.infer<typeof downloadSpecSchema>;
export type DownloadProgress = z.infer<typeof downloadProgressSchema>;
export type DownloadError = z.infer<typeof downloadErrorSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type Detection = z.infer<typeof detectionSchema>;
export type DrmDetection = z.infer<typeof drmDetectionSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type DownloadStatus = z.infer<typeof downloadStatusSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Language = z.infer<typeof languageSchema>;
