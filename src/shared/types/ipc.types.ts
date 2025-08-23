import type { 
  DownloadSpec, 
  DownloadProgress, 
  DownloadTask,
  AppSettings,
  Detection,
  VideoVariant,
} from './index';

// Event callback types
export type EventCallback<T> = (data: T) => void;
export type UnsubscribeFn = () => void;

// Error types
export enum ErrorCode {
  // Network errors (1xxx)
  NETWORK_ERROR = 'E1000',
  NETWORK_TIMEOUT = 'E1001',
  NETWORK_OFFLINE = 'E1002',
  
  // File system errors (2xxx)
  FILE_NOT_FOUND = 'E2000',
  FILE_ACCESS_DENIED = 'E2001',
  DISK_FULL = 'E2002',
  PATH_INVALID = 'E2003',
  
  // Validation errors (3xxx)
  INVALID_URL = 'E3000',
  INVALID_PATH = 'E3001',
  INVALID_FORMAT = 'E3002',
  
  // Application errors (4xxx)
  INVALID_ARGUMENT = 'E4000',
  OPERATION_FAILED = 'E4001',
  NOT_IMPLEMENTED = 'E4002',
  UNAUTHORIZED = 'E4003',
  
  // Download errors (5xxx)
  DOWNLOAD_FAILED = 'E5000',
  DOWNLOAD_CANCELED = 'E5001',
  FFMPEG_ERROR = 'E5002',
}

export interface IPCError {
  code: ErrorCode;
  message: string;
  details?: any;
  stack?: string;
}

// IPC Response types
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: IPCError;
}

// Download API types
export interface DownloadStartResponse {
  id: string;
}

export interface DownloadListResponse {
  tasks: DownloadTask[];
  total: number;
}

// Detection API types
export interface DetectionListResponse {
  detections: Detection[];
  total: number;
}

// System API types
export interface SystemPathsResponse {
  downloads: string;
  userData: string;
  temp: string;
  home: string;
}

export interface SystemInfoResponse {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  locale: string;
}

// Main Electron API interface
export interface ElectronAPI {
  // Download management
  download: {
    start(spec: DownloadSpec): Promise<DownloadStartResponse>;
    pause(id: string): Promise<void>;
    resume(id: string): Promise<void>;
    cancel(id: string): Promise<void>;
    retry(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    getTask(id: string): Promise<DownloadTask | null>;
    listTasks(status?: string): Promise<DownloadListResponse>;
    clearCompleted(): Promise<number>;
    onProgress(callback: EventCallback<DownloadProgress>): UnsubscribeFn;
    onCompleted(callback: EventCallback<DownloadTask>): UnsubscribeFn;
    onError(callback: EventCallback<{ taskId: string; error: IPCError }>): UnsubscribeFn;
  };
  
  // Detection system
  detection: {
    enable(): Promise<void>;
    disable(): Promise<void>;
    isEnabled(): Promise<boolean>;
    getCandidates(): Promise<DetectionListResponse>;
    clearDetections(): Promise<void>;
    ignoreUrl(url: string): Promise<void>;
    onVideoFound(callback: EventCallback<Detection>): UnsubscribeFn;
    onVideoSkipped(callback: EventCallback<{ url: string; reason: string }>): UnsubscribeFn;
  };
  
  // Settings management
  settings: {
    getAll(): Promise<AppSettings>;
    get<T = any>(key: string): Promise<T>;
    set(key: string, value: any): Promise<void>;
    reset(key?: string): Promise<void>;
    onSettingsChanged(callback: EventCallback<{ key: string; value: any }>): UnsubscribeFn;
  };
  
  // System operations
  system: {
    revealInFolder(path: string): Promise<void>;
    openExternal(url: string): Promise<void>;
    getPaths(): Promise<SystemPathsResponse>;
    getInfo(): Promise<SystemInfoResponse>;
    showSaveDialog(options?: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }): Promise<string | null>;
    showOpenDialog(options?: {
      defaultPath?: string;
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
      filters?: Array<{ name: string; extensions: string[] }>;
    }): Promise<string[] | null>;
    clipboard: {
      writeText(text: string): Promise<void>;
      readText(): Promise<string>;
    };
  };
  
  // Window controls
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    setAlwaysOnTop(flag: boolean): Promise<void>;
    onMaximized(callback: EventCallback<void>): UnsubscribeFn;
    onUnmaximized(callback: EventCallback<void>): UnsubscribeFn;
  };
  
  // App lifecycle
  app: {
    getVersion(): Promise<string>;
    quit(): Promise<void>;
    relaunch(): Promise<void>;
    onBeforeQuit(callback: EventCallback<void>): UnsubscribeFn;
  };
}

// Declare global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}