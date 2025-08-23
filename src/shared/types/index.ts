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
export type { AppSettings } from './settings.types';

// Media types
export type { MediaType } from './media.types';

// Error types
export type { ErrorCode } from './error.types';

// Re-export interfaces as types
export type { IpcRequest, IpcResponse } from './ipc.types';
