// Shared type definitions for IPC communication
// Named exports only (no default exports in shared)

// Download types
export type {
  DownloadSpec,
  DownloadTaskDTO,
  DownloadProgress,
  DownloadError,
  MediaVariant,
  QualityRule,
  RetryConfig,
} from './download.types';

// Settings types
export type {
  AppSettings,
  DownloadSettings,
  NotificationSettings,
  AdvancedSettings,
  SettingValue,
} from './settings.types';

// Media types
export type {
  MediaType,
  MediaFormat,
  MediaInfo,
  StreamInfo,
  PlaylistInfo,
  SegmentInfo,
  QualityLevel,
  AudioCodec,
  VideoCodec,
} from './media.types';

// Error types
export type {
  ErrorCode,
  ErrorSeverity,
  AppError,
  DownloadErrorCode,
  ValidationErrorCode,
  SystemErrorCode,
} from './error.types';
