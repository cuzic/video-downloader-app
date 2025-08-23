// Settings and configuration type definitions

import type { QualityPreference, CustomQualityRule, RetryPolicy } from './download.types';

export type Theme = 'light' | 'dark' | 'system';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type DuplicateAction = 'ask' | 'skip' | 'rename' | 'overwrite';

export interface WindowConfig {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
  fullscreen?: boolean;
  alwaysOnTop?: boolean;
  displayId?: number;
}

export interface DetectionConfig {
  enabled: boolean;
  minFileSize?: number;       // bytes
  maxFileSize?: number;       // bytes
  mimeTypes?: string[];
  ignoreDomains?: string[];
  allowDomains?: string[];
  autoDetect: boolean;
}

export interface DuplicateRenameRule {
  pattern: string;             // e.g., "{name} ({n}).{ext}"
  start?: number;              // starting number (default: 1)
}

export interface ProxyConfig {
  enabled: boolean;
  type: 'http' | 'https' | 'socks4' | 'socks5' | 'system' | 'pac';
  host?: string;
  port?: number;
  pacUrl?: string;
  auth?: {
    username: string;
    password: string;
  };
  bypassList?: string[];
}

export interface AppSettings {
  // Basic settings
  downloadDirectory: string;
  maxConcurrentDownloads: number;
  autoStartDownload: boolean;
  notificationEnabled: boolean;
  
  // FFmpeg settings
  ffmpegPath: string;
  ffmpegArgs?: string[];
  
  // Proxy settings
  proxy?: ProxyConfig;
  
  // UI settings
  theme: Theme;
  language: string;
  windowConfig?: WindowConfig;
  
  // Advanced settings
  userAgent?: string;
  downloadQualityPreference: QualityPreference;
  qualityRule?: CustomQualityRule;
  duplicateAction: DuplicateAction;
  duplicateRenameRule?: DuplicateRenameRule;
  
  // Notification settings
  completedNotification: {
    enabled: boolean;
    autoOpenFolder: boolean;
  };
  
  // Auto update
  autoUpdate: {
    enabled: boolean;
    checkIntervalHours: number;
  };
  
  // Detection settings
  detection: DetectionConfig;
  
  // Retry settings
  downloadRetry: RetryPolicy;
  segmentRetry: {
    maxAttempts: number;
    timeoutMs: number;
  };
}