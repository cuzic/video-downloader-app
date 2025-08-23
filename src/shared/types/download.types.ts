// Download related type definitions

import type { MediaType, VideoVariant } from './media.types';
import type { ErrorCode, SerializedError } from './error.types';

export type DownloadStatus = 
  | 'queued' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'error' 
  | 'canceled';

export type BackoffStrategy = 'exponential' | 'fixed';

export type QualityPreference = 
  | 'highest' 
  | 'lowest' 
  | 'balanced' 
  | 'custom';

export interface RetryPolicy {
  maxAttempts: number;
  backoff: BackoffStrategy;
  initialDelayMs: number;
  maxDelayMs?: number;
  retryOn?: ErrorCode[];
}

export interface CustomQualityRule {
  minBandwidth?: number;
  maxBandwidth?: number;
  minResolution?: string;      // "1280x720"
  maxResolution?: string;
  preferFramerate?: number;
}

export interface DownloadSpec {
  url: string;
  type: MediaType;
  filename?: string;
  saveDir?: string;
  headers?: Record<string, string>;
  variant?: VideoVariant;
  retry?: RetryPolicy;
  priority?: number;
  qualityRule?: CustomQualityRule;
  metadata?: Record<string, any>;
}

export interface SegmentProgress {
  total?: number;              // total segment count
  downloaded: number;          // downloaded segment count
  failed: number;              // failed segment count
  currentIndex?: number;       // current segment index
  targetDurationSec?: number;  // HLS target duration
  mediaSequence?: number;      // HLS media sequence number
}

export interface DownloadProgress {
  percent?: number;            // progress 0-100
  downloadedBytes: number;     // downloaded bytes
  totalBytes?: number;         // total bytes
  speedBps?: number;           // current speed (Bytes/sec)
  etaMs?: number;              // estimated time remaining (ms)
  segments?: SegmentProgress;  // segment progress
}

export interface DownloadError {
  code: ErrorCode | string;
  message: string;
  details?: any;
  retryable: boolean;
  attempt?: number;
}

export interface DownloadTask {
  id: string;
  spec: DownloadSpec;
  status: DownloadStatus;
  progress: DownloadProgress;
  error?: DownloadError;
  createdAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  outputPath?: string;
}

export interface DownloadTaskDTO {
  id: string;
  spec: DownloadSpec;
  status: DownloadStatus;
  progress: DownloadProgress;
  error?: DownloadError | SerializedError;
  createdAt: string;          // ISO8601
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  outputPath?: string;
}