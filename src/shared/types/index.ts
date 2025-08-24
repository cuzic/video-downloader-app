// Shared type definitions for IPC communication
// Named exports only (no default exports in shared)

// Download types
export type {
  DownloadSpec,
  DownloadTaskDTO,
  DownloadProgress,
  DownloadError,
} from './download.types';

// Settings types
export type {
  AppSettings,
  GeneralSettings,
  QualitySettings,
  NetworkSettings,
  UISettings,
  AdvancedSettings,
  SettingKey,
  SettingSectionKey,
  SettingsChangeEvent,
  SettingsValidationResult,
  SettingsMigration,
} from './settings';

// Media types
export type { MediaType } from './media.types';

// Error types
export type { ErrorCode } from './error.types';

// Re-export interfaces as types
export type { IpcRequest, IpcResponse } from './ipc.types';

// Logging types
export type { ULog, LogLevel, LogMetadata, LogMessage } from './logging';
