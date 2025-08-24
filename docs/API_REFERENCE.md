# API Reference

## Overview

This document provides comprehensive API documentation for the Video Downloader application, focusing on the IPC (Inter-Process Communication) handlers that facilitate communication between the main and renderer processes.

## Table of Contents

- [IPC Channels](#ipc-channels)
- [Download API](#download-api)
- [Settings API](#settings-api)
- [System API](#system-api)
- [Database API](#database-api)
- [Security API](#security-api)
- [Types and Interfaces](#types-and-interfaces)

## IPC Channels

All IPC communication follows a consistent naming convention and type-safe pattern.

### Channel Naming Convention

```typescript
const CHANNELS = {
  DOWNLOAD: {
    START: 'download:start',
    PAUSE: 'download:pause',
    RESUME: 'download:resume',
    CANCEL: 'download:cancel',
    STATUS: 'download:status',
    PROGRESS: 'download:progress'
  },
  SETTINGS: {
    GET: 'settings:get',
    SET: 'settings:set',
    RESET: 'settings:reset'
  },
  SYSTEM: {
    INFO: 'system:info',
    PATHS: 'system:paths',
    OPEN_EXTERNAL: 'system:open-external'
  }
};
```

## Download API

### `download:start`

Initiates a new download task.

**Request:**
```typescript
interface DownloadStartRequest {
  url: string;
  outputPath: string;
  options?: {
    headers?: Record<string, string>;
    quality?: 'auto' | '1080p' | '720p' | '480p' | '360p';
    format?: 'mp4' | 'webm' | 'mkv';
    audioOnly?: boolean;
  };
}
```

**Response:**
```typescript
interface DownloadStartResponse {
  taskId: string;
  status: 'queued' | 'started';
  estimatedSize?: number;
  createdAt: string;
}
```

**Example:**
```typescript
const result = await window.api.download.start({
  url: 'https://example.com/video.m3u8',
  outputPath: '/Users/user/Downloads/video.mp4',
  options: {
    quality: '1080p',
    format: 'mp4'
  }
});
```

### `download:pause`

Pauses an active download.

**Request:**
```typescript
interface DownloadPauseRequest {
  taskId: string;
}
```

**Response:**
```typescript
interface DownloadPauseResponse {
  success: boolean;
  status: 'paused';
}
```

### `download:resume`

Resumes a paused download.

**Request:**
```typescript
interface DownloadResumeRequest {
  taskId: string;
}
```

**Response:**
```typescript
interface DownloadResumeResponse {
  success: boolean;
  status: 'downloading';
}
```

### `download:cancel`

Cancels and removes a download task.

**Request:**
```typescript
interface DownloadCancelRequest {
  taskId: string;
  deletePartialFile?: boolean;
}
```

**Response:**
```typescript
interface DownloadCancelResponse {
  success: boolean;
  filesDeleted?: boolean;
}
```

### `download:status`

Gets the current status of a download task.

**Request:**
```typescript
interface DownloadStatusRequest {
  taskId: string;
}
```

**Response:**
```typescript
interface DownloadStatusResponse {
  taskId: string;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  progress: number; // 0-100
  bytesDownloaded: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds
  error?: string;
}
```

### `download:progress` (Event)

Progress events sent from main to renderer.

**Event Data:**
```typescript
interface DownloadProgressEvent {
  taskId: string;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  eta: number;
}
```

**Listening:**
```typescript
window.api.download.onProgress((event, data) => {
  console.log(`Download ${data.taskId}: ${data.progress}%`);
});
```

## Settings API

### `settings:get`

Retrieves application settings.

**Request:**
```typescript
interface SettingsGetRequest {
  key?: string; // Optional specific key, returns all if not provided
}
```

**Response:**
```typescript
interface SettingsGetResponse {
  [key: string]: any;
  // Common settings
  downloadPath?: string;
  maxConcurrentDownloads?: number;
  autoRetry?: boolean;
  retryAttempts?: number;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
}
```

### `settings:set`

Updates application settings.

**Request:**
```typescript
interface SettingsSetRequest {
  key: string;
  value: any;
}
```

**Response:**
```typescript
interface SettingsSetResponse {
  success: boolean;
  key: string;
  value: any;
}
```

### `settings:reset`

Resets settings to defaults.

**Request:**
```typescript
interface SettingsResetRequest {
  keys?: string[]; // Optional specific keys, resets all if not provided
}
```

**Response:**
```typescript
interface SettingsResetResponse {
  success: boolean;
  resetCount: number;
}
```

## System API

### `system:info`

Gets system information.

**Request:**
```typescript
interface SystemInfoRequest {}
```

**Response:**
```typescript
interface SystemInfoResponse {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: 'darwin' | 'win32' | 'linux';
  arch: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
}
```

### `system:paths`

Gets application paths.

**Request:**
```typescript
interface SystemPathsRequest {}
```

**Response:**
```typescript
interface SystemPathsResponse {
  app: string;
  userData: string;
  downloads: string;
  temp: string;
  logs: string;
  cache: string;
}
```

### `system:open-external`

Opens a URL in the default browser.

**Request:**
```typescript
interface SystemOpenExternalRequest {
  url: string;
}
```

**Response:**
```typescript
interface SystemOpenExternalResponse {
  success: boolean;
}
```

## Database API

### Database Repositories

Each entity has a repository with standard CRUD operations:

```typescript
interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}
```

### Task Repository

```typescript
interface TaskRepository extends Repository<Task> {
  findByStatus(status: TaskStatus): Promise<Task[]>;
  findActive(): Promise<Task[]>;
  updateProgress(taskId: string, progress: number): Promise<void>;
  markCompleted(taskId: string): Promise<void>;
  markFailed(taskId: string, error: string): Promise<void>;
}
```

### Settings Repository

```typescript
interface SettingsRepository {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  getAll(): Promise<Record<string, any>>;
  reset(keys?: string[]): Promise<void>;
}
```

## Security API

### Path Validation

```typescript
interface PathValidator {
  isPathSafe(path: string): boolean;
  sanitizeFilename(filename: string): string;
  generateSafeFilePath(dir: string, filename: string): string | null;
  validateOutputPath(path: string): ValidationResult;
}
```

### URL Validation

```typescript
interface URLValidator {
  isValidUrl(url: string): boolean;
  isSafeUrl(url: string): boolean;
  checkSSRF(url: string): Promise<boolean>;
  validateStreamUrl(url: string): ValidationResult;
}
```

### DRM Detection

```typescript
interface DRMDetector {
  checkForDRM(url: string): Promise<boolean>;
  detectProtection(manifest: string): DRMInfo | null;
}
```

## Types and Interfaces

### Core Types

```typescript
// Task status enumeration
type TaskStatus = 
  | 'queued' 
  | 'downloading' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

// Download specification
interface DownloadSpec {
  url: string;
  outputPath: string;
  headers?: Record<string, string>;
  quality?: VideoQuality;
  format?: VideoFormat;
  audioOnly?: boolean;
}

// Task entity
interface Task {
  id: string;
  url: string;
  outputPath: string;
  status: TaskStatus;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Segment for multi-part downloads
interface Segment {
  id: string;
  taskId: string;
  index: number;
  url: string;
  size: number;
  downloaded: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  retryCount: number;
}
```

### Validation Types

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

interface DRMInfo {
  protected: boolean;
  system?: 'widevine' | 'playready' | 'fairplay';
  message?: string;
}
```

### Event Types

```typescript
interface IPCEvent<T = any> {
  channel: string;
  data: T;
  timestamp: number;
}

interface ProgressEvent {
  taskId: string;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  eta: number;
  segmentProgress?: {
    completed: number;
    total: number;
  };
}
```

## Error Handling

All IPC handlers follow a consistent error handling pattern:

```typescript
interface IPCError {
  code: string;
  message: string;
  details?: any;
}

// Common error codes
enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DRM_PROTECTED = 'DRM_PROTECTED',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  SSRF_DETECTED = 'SSRF_DETECTED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

## Usage Examples

### Complete Download Flow

```typescript
// Start a download
const { taskId } = await window.api.download.start({
  url: 'https://example.com/video.m3u8',
  outputPath: '/Downloads/video.mp4'
});

// Listen for progress
window.api.download.onProgress((event, data) => {
  if (data.taskId === taskId) {
    updateProgressBar(data.progress);
  }
});

// Pause if needed
await window.api.download.pause({ taskId });

// Resume
await window.api.download.resume({ taskId });

// Check status
const status = await window.api.download.status({ taskId });
console.log(`Download is ${status.status} at ${status.progress}%`);
```

### Settings Management

```typescript
// Get all settings
const settings = await window.api.settings.get({});

// Update download path
await window.api.settings.set({
  key: 'downloadPath',
  value: '/Users/user/Movies'
});

// Reset to defaults
await window.api.settings.reset({});
```

## Testing

All IPC handlers can be tested using the mock system:

```typescript
import { createMockFn } from '@/test/mock-utils';

// Mock IPC handler
const mockHandler = createMockFn(() => ({
  taskId: 'test-123',
  status: 'queued'
}));

// Test the handler
const result = await mockHandler({ url: 'test.m3u8' });
expect(result.taskId).toBe('test-123');
```

## Related Documentation

- [IPC Specification](./design/video-downloader/ipc-specification.md)
- [Security Policy](./design/video-downloader/security-policy.md)
- [Database Schema](./design/video-downloader/database-schema.sql)
- [Architecture](./design/video-downloader/architecture.md)