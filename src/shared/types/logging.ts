/**
 * Logging types shared between main and renderer processes
 */

/**
 * Logging function signature
 */
export interface LogFunction {
  (msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Logging API with correlation ID support
 */
export interface LogWithCid {
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  debug: LogFunction;
}

/**
 * Universal logging API exposed to renderer process
 */
export interface ULog {
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  debug: LogFunction;
  withCid: (cid: string) => LogWithCid;
}

/**
 * Log levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Log metadata
 */
export interface LogMetadata {
  [key: string]: unknown;
  cid?: string;
  scope?: string;
  userId?: string;
}

/**
 * IPC log message format
 */
export interface LogMessage {
  msg: string;
  meta?: Record<string, unknown>;
  cid?: string;
}
