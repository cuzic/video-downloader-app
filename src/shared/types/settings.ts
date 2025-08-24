/**
 * Settings type definitions and Zod schemas
 * Provides comprehensive validation for all application settings
 */
import { z } from 'zod';

// ============================================================================
// General Settings Schema
// ============================================================================
export const GeneralSettingsSchema = z.object({
  downloadDirectory: z.string().default(''),
  maxConcurrentDownloads: z.number().min(1).max(10).default(3),
  autoStartDownload: z.boolean().default(true),
  notificationEnabled: z.boolean().default(true),
  closeToTray: z.boolean().default(false),
  startMinimized: z.boolean().default(false),
});

// ============================================================================
// Quality Settings Schema
// ============================================================================
export const QualitySettingsSchema = z.object({
  preference: z.enum(['highest', 'lowest', 'custom']).default('highest'),
  customResolution: z.string().optional(),
  customBandwidth: z.number().optional(),
  fallbackQuality: z.enum(['next-lower', 'next-higher', 'abort']).default('next-lower'),
  minResolution: z.string().optional(),
  maxResolution: z.string().optional(),
  preferredCodec: z.string().optional(),
  customRules: z
    .array(
      z.object({
        domain: z.string(),
        resolution: z.string().optional(),
        bandwidth: z.number().optional(),
        codecs: z.string().optional(),
      })
    )
    .default([]),
});

// ============================================================================
// Network Settings Schema
// ============================================================================
export const NetworkSettingsSchema = z.object({
  proxy: z
    .object({
      enabled: z.boolean().default(false),
      type: z.enum(['http', 'https', 'socks4', 'socks5']).default('http'),
      host: z.string().default(''),
      port: z.number().min(1).max(65535).default(8080),
      auth: z
        .object({
          username: z.string().default(''),
          password: z.string().default(''),
        })
        .optional(),
    })
    .optional(),
  userAgent: z.string().optional(),
  headers: z.record(z.string()).default({}),
  timeout: z.number().min(5000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(1000).max(60000).default(2000),
});

// ============================================================================
// UI Settings Schema
// ============================================================================
export const UISettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['en', 'ja', 'zh-CN', 'ko']).default('en'),
  windowBounds: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().min(800).default(1200),
      height: z.number().min(600).default(800),
    })
    .default({}),
  showInTray: z.boolean().default(true),
  minimizeOnClose: z.boolean().default(false),
});

// ============================================================================
// Advanced Settings Schema
// ============================================================================
export const AdvancedSettingsSchema = z.object({
  ffmpegPath: z.string().default('ffmpeg'),
  ffmpegArgs: z.array(z.string()).default([]),
  concurrentSegments: z.number().int().min(1).max(16).default(4),
  enableDebugMode: z.boolean().default(false),
  logLevel: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  enableTelemetry: z.boolean().default(true),
  updateChannel: z.enum(['stable', 'beta', 'alpha']).default('stable'),
});

// ============================================================================
// Complete App Settings Schema
// ============================================================================
export const AppSettingsSchema = z.object({
  general: GeneralSettingsSchema.default({}),
  quality: QualitySettingsSchema.default({}),
  network: NetworkSettingsSchema.default({}),
  ui: UISettingsSchema.default({}),
  advanced: AdvancedSettingsSchema.default({}),
});

// ============================================================================
// TypeScript Type Exports
// ============================================================================
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type QualitySettings = z.infer<typeof QualitySettingsSchema>;
export type NetworkSettings = z.infer<typeof NetworkSettingsSchema>;
export type UISettings = z.infer<typeof UISettingsSchema>;
export type AdvancedSettings = z.infer<typeof AdvancedSettingsSchema>;

// ============================================================================
// Setting Keys Type
// ============================================================================
export type SettingKey = keyof AppSettings;
export type SettingSectionKey = 'general' | 'quality' | 'network' | 'ui' | 'advanced';

// ============================================================================
// Settings Change Event Types
// ============================================================================
export interface SettingsChangeEvent {
  section: SettingSectionKey;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Settings Migration Types
// ============================================================================
export interface SettingsMigration {
  version: string;
  description: string;
  migrate: (settings: unknown) => unknown;
}

// ============================================================================
// Default Settings Export
// ============================================================================
export const DEFAULT_SETTINGS: AppSettings = AppSettingsSchema.parse({});

// ============================================================================
// Validation Helpers
// ============================================================================
export function validateSettings(settings: unknown): SettingsValidationResult {
  try {
    AppSettingsSchema.parse(settings);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}

export function validateSettingsSection(
  section: SettingSectionKey,
  value: unknown
): SettingsValidationResult {
  const schemas: Record<SettingSectionKey, z.ZodSchema> = {
    general: GeneralSettingsSchema,
    quality: QualitySettingsSchema,
    network: NetworkSettingsSchema,
    ui: UISettingsSchema,
    advanced: AdvancedSettingsSchema,
  };

  try {
    schemas[section].parse(value);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}
